import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODEL = "gpt-4o-mini-tts";
const DEFAULT_VOICE = "marin";
const FORMAT = "mp3";
const SPEED = 0.96;
const PROMPT_VERSION = "ko-child-story-v1";
const INSTRUCTIONS =
  "표준 한국어로 읽어 주세요. 6~9세 어린이에게 들려주는 따뜻하고 다정한 동화 구연자입니다. " +
  "말속도는 차분하지만 늘어지지 않게, 발음은 또렷하고 자연스럽게 해 주세요. " +
  "쉼표에서는 짧게, 문장 사이에서는 충분히 쉬세요. 질문은 부드러운 호기심을 담되 끝음을 과장하지 마세요. " +
  "슬프거나 긴장되는 장면도 무섭게 연기하지 말고 안심되는 톤을 유지하세요. " +
  "등장인물 대사는 억양만 살짝 구분하고 과장된 캐릭터 목소리는 피하세요. " +
  "의성어와 고유명사를 분명히 발음하고, 원문에 없는 말이나 효과음은 덧붙이지 마세요.";
const SPEECH_ENDPOINT = "https://api.openai.com/v1/audio/speech";
const DEFAULT_CONCURRENCY = 3;
const MAX_ATTEMPTS = 5;
const EXPECTED_EPISODE_IDS = [
  "bori-cloud-mountain",
  "broken-moon",
  "heungbu-nolbu",
];
const EXPECTED_CUE_COUNT = 165;
const BUILT_IN_VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
]);

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(SCRIPT_DIR, "..");
const PUBLIC_DIR = path.join(PROJECT_DIR, "public");
const EPISODE_INDEX_PATH = path.join(PUBLIC_DIR, "episodes", "index.json");
const INSTRUCTIONS_HASH = sha256(INSTRUCTIONS);

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function parseMode(argv) {
  const mode = argv[2];
  if (mode === "plan" || mode === "generate") return mode;
  throw new Error("사용법: node scripts/generate-tts.mjs <plan|generate>");
}

function readPositiveInteger(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > 10) {
    throw new Error(`${name}은 1~10 사이의 정수여야 합니다.`);
  }
  return value;
}

function resolveVoice() {
  const voice = process.env.OPENAI_TTS_VOICE?.trim() || DEFAULT_VOICE;
  if (!BUILT_IN_VOICES.has(voice)) {
    throw new Error(
      `OPENAI_TTS_VOICE가 지원 목록에 없습니다: ${[...BUILT_IN_VOICES].join(", ")}`,
    );
  }
  return voice;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function resolvePublicDataPath(dataPath) {
  if (typeof dataPath !== "string" || !dataPath.startsWith("/episodes/")) {
    throw new Error(`잘못된 에피소드 dataPath입니다: ${String(dataPath)}`);
  }

  const resolved = path.resolve(PUBLIC_DIR, dataPath.slice(1));
  const relative = path.relative(PUBLIC_DIR, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`public 디렉터리 밖의 dataPath는 읽을 수 없습니다: ${dataPath}`);
  }
  return resolved;
}

function assertText(value, key) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`비어 있거나 문자열이 아닌 TTS 문구입니다: ${key}`);
  }
  if (value.length > 4096) {
    throw new Error(`TTS 문구가 API의 4096자 제한을 넘습니다: ${key}`);
  }
  return value;
}

function extractCues(episode) {
  if (!Array.isArray(episode.scenes)) {
    throw new Error(`${episode.id}: scenes 배열이 없습니다.`);
  }

  const cues = [];
  const keys = new Set();
  const add = (key, text) => {
    if (keys.has(key)) throw new Error(`${episode.id}: 중복 cue key: ${key}`);
    keys.add(key);
    cues.push({ key, text: assertText(text, key) });
  };

  for (const scene of episode.scenes) {
    if (typeof scene.id !== "string" || !Array.isArray(scene.captions)) {
      throw new Error(`${episode.id}: 잘못된 장면 데이터가 있습니다.`);
    }

    scene.captions.forEach((caption, index) => {
      add(`${scene.id}:caption:${String(index).padStart(2, "0")}`, caption);
    });

    const interaction = scene.interaction;
    if (interaction && Array.isArray(interaction.options)) {
      for (const option of interaction.options) {
        if (option.guidance === "reflect" && option.failure) {
          const { title, ending, lesson } = option.failure;
          add(
            `${scene.id}:option:${option.id}:failure`,
            `${title}. ${ending} ${lesson}`,
          );
        } else {
          add(`${scene.id}:option:${option.id}:feedback`, option.feedback);
        }
      }
    }

    if (interaction?.kind === "tap") {
      add(`${scene.id}:activity:feedback`, interaction.feedback);
    }
  }

  return cues;
}

function inputHash({ text, voice }) {
  return sha256(
    JSON.stringify({
      model: MODEL,
      voice,
      response_format: FORMAT,
      speed: SPEED,
      promptVersion: PROMPT_VERSION,
      instructions: INSTRUCTIONS,
      input: text,
    }),
  );
}

function audioDiskRelativePath(hash) {
  return `files/${hash}.${FORMAT}`;
}

function audioPublicPath(episodeId, hash) {
  return `/episodes/${episodeId}/audio/${audioDiskRelativePath(hash)}`;
}

function createManifest(episode, cues, voice) {
  return {
    schemaVersion: 1,
    episodeId: episode.id,
    contentVersion: episode.contentVersion,
    model: MODEL,
    voice,
    format: FORMAT,
    speed: SPEED,
    promptVersion: PROMPT_VERSION,
    instructionsHash: INSTRUCTIONS_HASH,
    generatedAt: null,
    entries: cues.map(({ key, text }) => ({
      key,
      text,
      inputHash: inputHash({ text, voice }),
      file: null,
    })),
  };
}

async function loadPlans(voice) {
  const index = await readJson(EPISODE_INDEX_PATH);
  if (!Array.isArray(index.episodes)) {
    throw new Error("에피소드 index.json에 episodes 배열이 없습니다.");
  }

  const enabled = index.episodes.filter((item) => item.enabled !== false);
  const ids = enabled.map((item) => item.id);
  if (
    ids.length !== EXPECTED_EPISODE_IDS.length ||
    ids.some((id, index) => id !== EXPECTED_EPISODE_IDS[index])
  ) {
    throw new Error(
      `TTS 대상 에피소드가 예상과 다릅니다. 예상: ${EXPECTED_EPISODE_IDS.join(", ")} / 실제: ${ids.join(", ")}`,
    );
  }

  const plans = [];
  for (const item of enabled) {
    const episodePath = resolvePublicDataPath(item.dataPath);
    const episode = await readJson(episodePath);
    if (episode.id !== item.id || typeof episode.contentVersion !== "string") {
      throw new Error(`${item.id}: id 또는 contentVersion이 올바르지 않습니다.`);
    }

    const cues = extractCues(episode);
    const audioDir = path.join(PUBLIC_DIR, "episodes", episode.id, "audio");
    plans.push({
      episode,
      audioDir,
      manifestPath: path.join(audioDir, "manifest.json"),
      manifest: createManifest(episode, cues, voice),
    });
  }

  const totalCues = plans.reduce((sum, plan) => sum + plan.manifest.entries.length, 0);
  if (totalCues !== EXPECTED_CUE_COUNT) {
    throw new Error(
      `추출된 cue 수가 예상과 다릅니다. 예상: ${EXPECTED_CUE_COUNT}, 실제: ${totalCues}`,
    );
  }

  return plans;
}

async function readExistingManifest(manifestPath) {
  try {
    return await readJson(manifestPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new Error(`${manifestPath}을 읽지 못했습니다: ${error.message}`);
  }
}

async function isNonemptyFile(filePath) {
  try {
    const fileStat = await stat(filePath);
    return fileStat.isFile() && fileStat.size > 0;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function matchingEntry(existingManifest, entry) {
  if (!Array.isArray(existingManifest?.entries)) return null;
  return (
    existingManifest.entries.find(
      (candidate) =>
        candidate?.key === entry.key && candidate?.inputHash === entry.inputHash,
    ) ?? null
  );
}

async function hydrateExistingFiles(plan) {
  const existingManifest = await readExistingManifest(plan.manifestPath);
  let complete = true;

  for (const entry of plan.manifest.entries) {
    const existingEntry = matchingEntry(existingManifest, entry);
    const expectedFile = audioPublicPath(plan.episode.id, entry.inputHash);
    const existingFile = existingEntry?.file;
    if (
      existingFile === expectedFile &&
      (await isNonemptyFile(path.join(plan.audioDir, audioDiskRelativePath(entry.inputHash))))
    ) {
      entry.file = expectedFile;
    } else {
      entry.file = null;
      complete = false;
    }
  }

  if (
    complete &&
    typeof existingManifest?.generatedAt === "string" &&
    existingManifest.generatedAt !== ""
  ) {
    plan.manifest.generatedAt = existingManifest.generatedAt;
  }
  return existingManifest;
}

async function writeJsonAtomic(filePath, value) {
  const contents = `${JSON.stringify(value, null, 2)}\n`;
  try {
    if ((await readFile(filePath, "utf8")) === contents) return false;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, contents, "utf8");
    await rename(temporaryPath, filePath);
  } finally {
    await unlink(temporaryPath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  }
  return true;
}

async function planManifests(plans) {
  let changed = 0;
  for (const plan of plans) {
    await hydrateExistingFiles(plan);
    if (await writeJsonAtomic(plan.manifestPath, plan.manifest)) changed += 1;
    const ready = plan.manifest.entries.filter((entry) => entry.file !== null).length;
    console.log(
      `[plan] ${plan.episode.id}: ${plan.manifest.entries.length}개 cue, 기존 파일 ${ready}개`,
    );
  }
  console.log(`[plan] 총 ${EXPECTED_CUE_COUNT}개 cue, manifest 변경 ${changed}개`);
}

function retryDelayMs(response, attempt) {
  const retryAfter = response?.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1000, 0), 60_000);
    const dateMs = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateMs)) return Math.min(Math.max(dateMs, 0), 60_000);
  }
  const exponential = Math.min(1000 * 2 ** (attempt - 1), 16_000);
  return exponential + Math.floor(Math.random() * 250);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestSpeech({ apiKey, entry, voice }) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await fetch(SPEECH_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          input: entry.text,
          voice,
          instructions: INSTRUCTIONS,
          response_format: FORMAT,
          speed: SPEED,
        }),
      });
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(`${entry.key}: 네트워크 오류로 음성을 생성하지 못했습니다.`);
      }
      await wait(retryDelayMs(null, attempt));
      continue;
    }

    if (response.ok) {
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length === 0) throw new Error(`${entry.key}: 빈 음성 응답을 받았습니다.`);
      return bytes;
    }

    const retryable = response.status === 429 || response.status >= 500;
    await response.body?.cancel().catch(() => {});
    if (!retryable || attempt === MAX_ATTEMPTS) {
      const requestId = response.headers.get("x-request-id");
      throw new Error(
        `${entry.key}: OpenAI Speech API 오류 ${response.status}${requestId ? ` (request ${requestId})` : ""}`,
      );
    }
    await wait(retryDelayMs(response, attempt));
  }

  throw new Error(`${entry.key}: 음성을 생성하지 못했습니다.`);
}

async function writeAudioAtomic(destination, bytes) {
  await mkdir(path.dirname(destination), { recursive: true });
  const temporaryPath = path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, bytes);
    if (await isNonemptyFile(destination)) return false;
    await unlink(destination).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
    await rename(temporaryPath, destination);
  } finally {
    await unlink(temporaryPath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  }
  return true;
}

async function runWithConcurrency(items, concurrency, worker) {
  let nextIndex = 0;
  async function runWorker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
}

async function generateAudio(plans, apiKey, voice, concurrency) {
  const jobsByHash = new Map();
  for (const plan of plans) {
    await hydrateExistingFiles(plan);
    for (const entry of plan.manifest.entries) {
      const relativeFile = audioDiskRelativePath(entry.inputHash);
      const destination = path.join(plan.audioDir, relativeFile);
      if (!(await isNonemptyFile(destination))) {
        jobsByHash.set(entry.inputHash, { entry, destination });
      }
    }
  }

  const jobs = [...jobsByHash.values()];
  let created = 0;
  let completed = 0;
  const createJob = async (job) => {
    const bytes = await requestSpeech({ apiKey, entry: job.entry, voice });
    if (await writeAudioAtomic(job.destination, bytes)) created += 1;
    completed += 1;
    console.log(`[generate] ${completed}/${jobs.length} ${job.entry.key}`);
  };

  if (jobs.length > 0) {
    console.log(`[generate] canary 1개로 ${MODEL} 접근과 한국어 음성 생성을 먼저 확인합니다.`);
    await createJob(jobs[0]);
    await runWithConcurrency(jobs.slice(1), concurrency, createJob);
  }

  const generatedAt = new Date().toISOString();
  for (const plan of plans) {
    const previousGeneratedAt = plan.manifest.generatedAt;
    for (const entry of plan.manifest.entries) {
      const relativeFile = audioDiskRelativePath(entry.inputHash);
      if (!(await isNonemptyFile(path.join(plan.audioDir, relativeFile)))) {
        throw new Error(`${entry.key}: 생성 결과 파일을 확인하지 못했습니다.`);
      }
      entry.file = audioPublicPath(plan.episode.id, entry.inputHash);
    }
    plan.manifest.generatedAt = previousGeneratedAt || generatedAt;
    await writeJsonAtomic(plan.manifestPath, plan.manifest);
  }

  console.log(
    `[generate] 총 ${EXPECTED_CUE_COUNT}개 cue, 새 파일 ${created}개, 기존 해시 건너뜀 ${EXPECTED_CUE_COUNT - jobs.length}개`,
  );
}

async function main() {
  const mode = parseMode(process.argv);

  // 생성 모드는 이 검사보다 앞서 어떤 디렉터리, manifest, mp3도 변경하지 않는다.
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (mode === "generate" && !apiKey) {
    throw new Error(
      "OPENAI_API_KEY가 없어 생성을 시작하지 않았습니다. 기존 mp3와 manifest는 변경되지 않았습니다.",
    );
  }

  const voice = resolveVoice();
  const plans = await loadPlans(voice);
  if (mode === "plan") {
    await planManifests(plans);
    return;
  }

  if (typeof fetch !== "function") {
    throw new Error("이 도구는 내장 fetch를 지원하는 Node.js 18 이상이 필요합니다.");
  }
  const concurrency = readPositiveInteger("TTS_CONCURRENCY", DEFAULT_CONCURRENCY);
  await generateAudio(plans, apiKey, voice, concurrency);
}

main().catch((error) => {
  console.error(`[tts] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
