import type {
  ChoiceInteraction,
  Episode,
  EpisodeManifest,
  MusicTheme,
  StoryScene,
  SpeakerPosition,
  VoiceManifest,
} from "../types/story";
import { collectVoiceCues } from "./voice";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const musicThemes = new Set<MusicTheme>([
  "village",
  "care",
  "wonder",
  "comic",
  "repair",
  "festival",
  "ember",
  "storm",
  "calm",
  "lantern",
]);
const speakerPositions = new Set<SpeakerPosition>(["left", "center", "right", "narrator"]);

export function validateManifest(value: unknown): EpisodeManifest {
  if (!isRecord(value) || !Array.isArray(value.episodes)) {
    throw new Error("에피소드 목록 형식이 올바르지 않아요.");
  }

  const ids = new Set<string>();
  let featuredCount = 0;
  for (const item of value.episodes) {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.dataPath !== "string") {
      throw new Error("에피소드 카드에 id와 dataPath가 필요해요.");
    }
    if (ids.has(item.id)) throw new Error(`중복된 에피소드 ID: ${item.id}`);
    if ("ttsEnabled" in item && typeof item.ttsEnabled !== "boolean") {
      throw new Error(`${item.id}의 자동 낭독 설정은 참 또는 거짓이어야 해요.`);
    }
    ids.add(item.id);
    if (item.featured === true) featuredCount += 1;
  }
  if (featuredCount !== 1) throw new Error("추천 에피소드는 정확히 하나여야 해요.");

  return value as unknown as EpisodeManifest;
}

function validateScene(scene: StoryScene, sceneIds: Set<string>) {
  if (!scene.id || !scene.title || !scene.image || !scene.imageAlt) {
    throw new Error("모든 장면에는 id, title, image, imageAlt가 필요해요.");
  }
  if (!Array.isArray(scene.captions) || scene.captions.length === 0) {
    throw new Error(`${scene.id} 장면에는 자막이 필요해요.`);
  }
  if (scene.captions.some((caption) => typeof caption !== "string" || !caption.trim())) {
    throw new Error(`${scene.id} 장면의 모든 자막에는 내용이 필요해요.`);
  }
  if (scene.captionSpeakers !== undefined) {
    if (
      !Array.isArray(scene.captionSpeakers) ||
      scene.captionSpeakers.length !== scene.captions.length ||
      scene.captionSpeakers.some(
        (speaker) => typeof speaker !== "string" || !speaker.trim(),
      )
    ) {
      throw new Error(`${scene.id} 장면의 자막 화자는 자막마다 하나씩 필요해요.`);
    }
  }
  if (scene.speakerPositions !== undefined) {
    const sceneSpeakers = new Set(scene.captionSpeakers ?? []);
    if (
      !isRecord(scene.speakerPositions) ||
      Object.entries(scene.speakerPositions).some(
        ([speaker, position]) =>
          !speaker.trim() ||
          !speakerPositions.has(position as SpeakerPosition) ||
          !sceneSpeakers.has(speaker),
      )
    ) {
      throw new Error(`${scene.id} 장면의 화자 말풍선 위치가 올바르지 않아요.`);
    }
  }
  if (!musicThemes.has(scene.music)) {
    throw new Error(`${scene.id} 장면의 음악 테마가 올바르지 않아요.`);
  }
  if (scene.nextSceneId && !sceneIds.has(scene.nextSceneId)) {
    throw new Error(`${scene.id}의 다음 장면 ${scene.nextSceneId}을 찾을 수 없어요.`);
  }

  if (scene.type === "choice" || scene.type === "ending") {
    if (!scene.interaction || !["choice", "reflection"].includes(scene.interaction.kind)) {
      throw new Error(`${scene.id}에는 선택 상호작용이 필요해요.`);
    }
    const interaction = scene.interaction as ChoiceInteraction;
    if (interaction.options.length < 2 || interaction.options.length > 3) {
      throw new Error(`${scene.id}의 선택지는 2~3개여야 해요.`);
    }
    const optionIds = new Set<string>();
    for (const option of interaction.options) {
      if (!option.id || !option.label || !option.feedback) {
        throw new Error(`${scene.id}의 모든 선택에는 id, label, feedback이 필요해요.`);
      }
      if (optionIds.has(option.id)) throw new Error(`${scene.id}에 중복 선택 ID가 있어요.`);
      optionIds.add(option.id);
      if (option.nextSceneId && !sceneIds.has(option.nextSceneId)) {
        throw new Error(`${option.id}의 다음 장면을 찾을 수 없어요.`);
      }
      if (option.guidance === "reflect") {
        if (
          !option.failure?.title?.trim() ||
          !option.failure.ending?.trim() ||
          !option.failure.lesson?.trim()
        ) {
          throw new Error(`${option.id}에는 실패 결말과 교훈이 필요해요.`);
        }
      } else if (option.failure) {
        throw new Error(`${option.id}의 올바른 선택에는 실패 결말을 넣을 수 없어요.`);
      }
    }

    if (scene.type === "choice") {
      const preferredCount = interaction.options.filter(
        (option) => option.guidance === "preferred",
      ).length;
      const reflectCount = interaction.options.filter(
        (option) => option.guidance === "reflect",
      ).length;
      if (preferredCount !== 1 || preferredCount + reflectCount !== interaction.options.length) {
        throw new Error(`${scene.id}에는 정답 1개와 실패 선택지만 있어야 해요.`);
      }
    }
  }

  if (scene.type === "activity") {
    if (!scene.interaction || scene.interaction.kind !== "tap") {
      throw new Error(`${scene.id}에는 터치 활동이 필요해요.`);
    }
    if (scene.interaction.tapsRequired < 1 || scene.interaction.tapsRequired > 5) {
      throw new Error(`${scene.id}의 터치 횟수는 1~5회여야 해요.`);
    }
  }
}

export function validateEpisode(value: unknown): Episode {
  if (!isRecord(value) || !Array.isArray(value.scenes) || typeof value.id !== "string") {
    throw new Error("에피소드 데이터 형식이 올바르지 않아요.");
  }

  const episode = value as unknown as Episode;
  const sceneIds = new Set<string>();
  for (const scene of episode.scenes) {
    if (sceneIds.has(scene.id)) throw new Error(`중복된 장면 ID: ${scene.id}`);
    sceneIds.add(scene.id);
  }
  if (!sceneIds.has(episode.startSceneId)) throw new Error("시작 장면을 찾을 수 없어요.");
  for (const scene of episode.scenes) validateScene(scene, sceneIds);

  const reachable = new Set<string>();
  const visit = (sceneId: string) => {
    if (reachable.has(sceneId)) return;
    reachable.add(sceneId);
    const scene = episode.scenes.find((candidate) => candidate.id === sceneId);
    if (!scene) return;
    if (scene.nextSceneId) visit(scene.nextSceneId);
    if (scene.interaction && "options" in scene.interaction) {
      for (const option of scene.interaction.options) {
        if (option.nextSceneId) visit(option.nextSceneId);
      }
    }
  };
  visit(episode.startSceneId);
  if (reachable.size !== episode.scenes.length) {
    throw new Error("시작점에서 닿을 수 없는 장면이 있어요.");
  }
  if (!episode.scenes.some((scene) => scene.type === "ending")) {
    throw new Error("에피소드에는 마무리 장면이 필요해요.");
  }

  return episode;
}

export function validateVoiceManifest(value: unknown, episode: Episode): VoiceManifest {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.episodeId !== episode.id ||
    value.contentVersion !== episode.contentVersion ||
    value.model !== "gpt-4o-mini-tts" ||
    value.format !== "mp3" ||
    typeof value.speed !== "number" ||
    value.speed < 0.25 ||
    value.speed > 4 ||
    typeof value.voice !== "string" ||
    typeof value.promptVersion !== "string" ||
    typeof value.instructionsHash !== "string" ||
    !Array.isArray(value.entries)
  ) {
    throw new Error(`${episode.meta.title}의 음성 목록 형식이 올바르지 않아요.`);
  }

  const expectedCues = new Map(collectVoiceCues(episode).map((cue) => [cue.key, cue.text]));
  const seen = new Set<string>();
  for (const entry of value.entries) {
    if (
      !isRecord(entry) ||
      typeof entry.key !== "string" ||
      typeof entry.text !== "string" ||
      typeof entry.inputHash !== "string" ||
      !(entry.file === null || typeof entry.file === "string")
    ) {
      throw new Error(`${episode.meta.title}의 음성 항목 형식이 올바르지 않아요.`);
    }
    if (seen.has(entry.key)) throw new Error(`중복된 음성 키: ${entry.key}`);
    if (expectedCues.get(entry.key) !== entry.text) {
      throw new Error(`${entry.key} 음성과 현재 이야기 문장이 일치하지 않아요.`);
    }
    if (entry.file && !/^\/episodes\/[a-z0-9-]+\/audio\/.+\.mp3$/.test(entry.file)) {
      throw new Error(`${entry.key} 음성 파일 경로가 올바르지 않아요.`);
    }
    seen.add(entry.key);
  }
  if (seen.size !== expectedCues.size || [...expectedCues.keys()].some((key) => !seen.has(key))) {
    throw new Error(`${episode.meta.title}의 음성 항목이 빠졌어요.`);
  }

  return value as unknown as VoiceManifest;
}

export function getCompletionVisual(episode: Episode, completedSceneId?: string) {
  const completedScene = completedSceneId
    ? episode.scenes.find((scene) => scene.id === completedSceneId)
    : undefined;
  const endingScene = [...episode.scenes].reverse().find((scene) => scene.type === "ending");
  const visualScene = completedScene?.type === "ending" ? completedScene : endingScene;

  return visualScene
    ? { image: visualScene.image, imageAlt: visualScene.imageAlt }
    : { image: episode.meta.cover, imageAlt: `${episode.meta.title} 동화 표지` };
}

export function getCaptionSpeaker(scene: StoryScene, captionIndex: number) {
  return scene.captionSpeakers?.[captionIndex]?.trim() || "이야기 할머니";
}

export function getSpeakerPosition(scene: StoryScene, captionIndex: number): SpeakerPosition {
  const speaker = getCaptionSpeaker(scene, captionIndex);
  return scene.speakerPositions?.[speaker] ??
    (speaker === "이야기 할머니" ? "narrator" : "center");
}

export async function loadManifest(): Promise<EpisodeManifest> {
  const response = await fetch("/episodes/index.json");
  if (!response.ok) throw new Error("동화책 목록을 불러오지 못했어요.");
  return validateManifest(await response.json());
}

export async function loadEpisode(dataPath: string): Promise<Episode> {
  const response = await fetch(dataPath);
  if (!response.ok) throw new Error("이야기를 불러오지 못했어요.");
  const episode = validateEpisode(await response.json());
  const voiceManifestPath = dataPath.replace(/episode\.json(?:\?.*)?$/, "audio/manifest.json");

  const voiceResponse = await fetch(voiceManifestPath).catch(() => null);
  if (voiceResponse?.ok) {
    try {
      episode.voice = validateVoiceManifest(await voiceResponse.json(), episode);
    } catch {
      // 이야기 본문이 바뀐 뒤 아직 음성 파일을 다시 만들지 않았더라도
      // 자막과 부모 낭독으로 에피소드는 끝까지 열려야 합니다.
      episode.voice = undefined;
    }
  }

  return episode;
}
