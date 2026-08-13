import { describe, expect, it, vi } from "vitest";
import brokenMoonData from "../../public/episodes/broken-moon/episode.json";
import episodeData from "../../public/episodes/heungbu-nolbu/episode.json";
import manifestData from "../../public/episodes/index.json";
import toriData from "../../public/episodes/tori-firelight-festival/episode.json";
import {
  getCaptionSpeaker,
  getCompletionVisual,
  getSpeakerPosition,
  loadEpisode,
  validateEpisode,
  validateManifest,
} from "./story";
import type { Episode, MusicTheme } from "../types/story";

const episodeModules = import.meta.glob("../../public/episodes/*/episode.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

const registeredEpisodeData = Object.values(episodeModules);

describe("에피소드 데이터 계약", () => {
  it("에피소드 목록을 검증한다", () => {
    const manifest = validateManifest(manifestData);
    const episodeIds = registeredEpisodeData.map((data) => validateEpisode(data).id);

    expect(manifest.episodes).toHaveLength(registeredEpisodeData.length);
    expect(manifest.episodes.map((item) => item.id).sort()).toEqual(episodeIds.sort());
    expect(manifest.episodes.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "heungbu-nolbu",
        "broken-moon",
        "bori-cloud-mountain",
        "tori-firelight-festival",
        "lulu-heart-mail",
      ]),
    );
    expect(manifest.episodes.filter((item) => item.featured)).toHaveLength(1);
  });

  it("에피소드 목록의 선택적 자동 낭독 표시를 검증한다", () => {
    const manifest = structuredClone(manifestData);
    manifest.episodes[0].ttsEnabled = true;
    expect(validateManifest(manifest).episodes[0].ttsEnabled).toBe(true);

    const broken = structuredClone(manifestData) as unknown as {
      episodes: Array<Record<string, unknown>>;
    };
    broken.episodes[0].ttsEnabled = "yes";
    expect(() => validateManifest(broken)).toThrow(/자동 낭독 설정/);
  });

  it("자막마다 화자를 표시하고 기존 장면은 기본 화자를 사용한다", () => {
    const created = structuredClone(episodeData) as unknown as Episode;
    const scene = created.scenes[0];
    scene.captionSpeakers = scene.captions.map((_, index) => index === 0 ? "용이" : "해설");

    const episode = validateEpisode(created);
    expect(getCaptionSpeaker(episode.scenes[0], 0)).toBe("용이");
    expect(getCaptionSpeaker(episode.scenes[0], 1)).toBe("해설");
    expect(getCaptionSpeaker(episode.scenes[1], 0)).toBe("이야기 할머니");
  });

  it("자막 수와 맞지 않거나 빈 자막 화자를 거부한다", () => {
    const missing = structuredClone(episodeData) as unknown as Episode;
    missing.scenes[0].captionSpeakers = ["해설"];
    expect(() => validateEpisode(missing)).toThrow(/자막 화자/);

    const blank = structuredClone(episodeData) as unknown as Episode;
    blank.scenes[0].captionSpeakers = blank.scenes[0].captions.map(() => "해설");
    blank.scenes[0].captionSpeakers[0] = " ";
    expect(() => validateEpisode(blank)).toThrow(/자막 화자/);
  });

  it("화자 말풍선 위치를 데이터로 정하고 안전한 기본 위치를 사용한다", () => {
    const created = structuredClone(toriData) as unknown as Episode;
    const scene = created.scenes[0];
    scene.speakerPositions = { "이야기 할머니": "narrator", "토리": "left" };

    const episode = validateEpisode(created);
    expect(getSpeakerPosition(episode.scenes[0], 0)).toBe("narrator");
    expect(getSpeakerPosition(episode.scenes[0], 1)).toBe("left");

    const legacy = structuredClone(episodeData) as unknown as Episode;
    expect(getSpeakerPosition(legacy.scenes[0], 0)).toBe("narrator");
  });

  it("알 수 없는 화자나 위치를 말풍선 위치로 등록하지 못한다", () => {
    const unknownSpeaker = structuredClone(toriData) as unknown as Episode;
    unknownSpeaker.scenes[0].speakerPositions = { "다른 친구": "left" };
    expect(() => validateEpisode(unknownSpeaker)).toThrow(/말풍선 위치/);

    const invalidPosition = structuredClone(toriData) as unknown as Episode;
    invalidPosition.scenes[0].speakerPositions = {
      "토리": "top",
    } as unknown as Episode["scenes"][number]["speakerPositions"];
    expect(() => validateEpisode(invalidPosition)).toThrow(/말풍선 위치/);
  });

  it("기존 터치 활동에 부모 낭독과 아이 참여 안내를 선택적으로 더한다", () => {
    const created = structuredClone(toriData) as unknown as Episode;
    const activity = created.scenes.find((scene) => scene.type === "activity");
    if (!activity?.interaction || activity.interaction.kind !== "tap") {
      throw new Error("테스트 활동 장면 없음");
    }
    activity.interaction.participation = [
      {
        kind: "parent-read",
        speaker: "토리",
        instruction: "부모님은 숨이 조금 가쁜 아기 용 목소리로 읽어 주세요.",
        line: "후우, 아직 화가 나지만 어떤 말을 할지는 고를 수 있어.",
      },
      {
        kind: "child-repeat",
        instruction: "아이가 토리와 함께 천천히 따라 말해요.",
        line: "나는 잠깐 멈출 수 있어.",
      },
      {
        kind: "child-question",
        instruction: "아이에게 물어보세요. 토리의 몸은 지금 어떻게 달라졌을까요?",
      },
    ];

    const episode = validateEpisode(created);
    const validatedActivity = episode.scenes.find((scene) => scene.id === activity.id);
    expect(validatedActivity?.interaction?.kind).toBe("tap");
    if (validatedActivity?.interaction?.kind !== "tap") return;
    expect(validatedActivity.interaction.participation).toHaveLength(3);
  });

  it("부모 낭독의 화자·대사와 아이 따라 말할 문장이 빠지면 거부한다", () => {
    const missingParentLine = structuredClone(toriData) as unknown as Episode;
    const firstActivity = missingParentLine.scenes.find((scene) => scene.type === "activity");
    if (!firstActivity?.interaction || firstActivity.interaction.kind !== "tap") {
      throw new Error("테스트 활동 장면 없음");
    }
    firstActivity.interaction.participation = [{
      kind: "parent-read",
      speaker: "토리",
      instruction: "토리 목소리로 읽어 주세요.",
    }];
    expect(() => validateEpisode(missingParentLine)).toThrow(/화자와 대사/);

    const missingChildLine = structuredClone(toriData) as unknown as Episode;
    const secondActivity = missingChildLine.scenes.find((scene) => scene.type === "activity");
    if (!secondActivity?.interaction || secondActivity.interaction.kind !== "tap") {
      throw new Error("테스트 활동 장면 없음");
    }
    secondActivity.interaction.participation = [{
      kind: "child-repeat",
      instruction: "아이가 따라 말해요.",
    }];
    expect(() => validateEpisode(missingChildLine)).toThrow(/아이가 말할 문장/);
  });

  it("용 이야기의 다섯 가지 새 음악 테마를 지원한다", () => {
    const created = structuredClone(episodeData) as unknown as Episode;
    const newThemes: MusicTheme[] = ["festival", "ember", "storm", "calm", "lantern"];
    newThemes.forEach((theme, index) => {
      created.scenes[index].music = theme;
    });
    expect(() => validateEpisode(created)).not.toThrow();

    (created.scenes[0] as unknown as { music: string }).music = "thunder";
    expect(() => validateEpisode(created)).toThrow(/음악 테마/);
  });

  it("구름산의 보리는 선택, 활동, 마무리 장면까지 모두 연결된다", () => {
    const episodeData = registeredEpisodeData.find(
      (data) => (data as { id?: string }).id === "bori-cloud-mountain",
    );
    expect(episodeData).toBeDefined();

    const episode = validateEpisode(episodeData);
    const choiceScenes = episode.scenes.filter((scene) => scene.type === "choice");
    const activities = episode.scenes.filter((scene) => scene.type === "activity");
    const endings = episode.scenes.filter((scene) => scene.type === "ending");

    expect(episode.scenes).toHaveLength(13);
    expect(choiceScenes).toHaveLength(4);
    expect(activities).toHaveLength(2);
    expect(endings).toHaveLength(1);
    expect(episode.scenes.at(-1)?.id).toBe(endings[0].id);

    for (const scene of choiceScenes) {
      if (!scene.interaction || !("options" in scene.interaction)) {
        throw new Error(`${scene.id} 선택 상호작용이 없어요.`);
      }
      expect(scene.interaction.options.filter((option) => option.guidance === "preferred")).toHaveLength(1);
      expect(scene.interaction.options.filter((option) => option.guidance === "reflect")).toHaveLength(
        scene.interaction.options.length - 1,
      );
      for (const option of scene.interaction.options.filter(
        (candidate) => candidate.guidance === "reflect",
      )) {
        expect(option.failure?.title.trim()).toBeTruthy();
        expect(option.failure?.ending.trim()).toBeTruthy();
        expect(option.failure?.lesson.trim()).toBeTruthy();
      }
    }

    const reachable = new Set<string>();
    const visit = (sceneId: string) => {
      if (reachable.has(sceneId)) return;
      reachable.add(sceneId);
      const scene = episode.scenes.find((candidate) => candidate.id === sceneId);
      if (!scene) return;
      if (scene.nextSceneId) visit(scene.nextSceneId);
      if (scene.interaction && "options" in scene.interaction) {
        scene.interaction.options.forEach((option) => {
          if (option.nextSceneId) visit(option.nextSceneId);
        });
      }
    };
    visit(episode.startSceneId);
    expect(reachable.size).toBe(episode.scenes.length);
  });

  it("깨진 달을 고치는 아이의 몰입형 장면과 실패 결말을 검증한다", () => {
    const episode = validateEpisode(brokenMoonData);
    const choiceScenes = episode.scenes.filter((scene) => scene.type === "choice");
    const activities = episode.scenes.filter((scene) => scene.type === "activity");
    const failureOptions = choiceScenes.flatMap((scene) =>
      scene.interaction && "options" in scene.interaction
        ? scene.interaction.options.filter((option) => option.guidance === "reflect")
        : [],
    );

    expect(episode.id).toBe("broken-moon");
    expect(episode.scenes).toHaveLength(13);
    expect(choiceScenes).toHaveLength(4);
    expect(activities).toHaveLength(2);
    expect(failureOptions).toHaveLength(8);
    expect(failureOptions.every((option) => Boolean(option.failure))).toBe(true);
    expect(episode.scenes.at(-1)?.type).toBe("ending");
  });

  it("흥부와 놀부의 13개 장면을 모두 연결한다", () => {
    const episode = validateEpisode(episodeData);
    expect(episode.scenes).toHaveLength(13);
    expect(episode.startSceneId).toBe("HB00_TITLE");
    expect(episode.scenes.at(-1)?.type).toBe("ending");
  });

  it("새 에피소드 완료 화면은 그 이야기의 마지막 장면 이미지를 사용한다", () => {
    const createdStory = structuredClone(episodeData) as unknown as Episode;
    createdStory.id = "mended-moon";
    createdStory.meta = {
      ...createdStory.meta,
      title: "깨진 달을 고치는 아이",
      cover: "/episodes/mended-moon/images/cover.webp",
    };
    const ending = createdStory.scenes.find((scene) => scene.type === "ending");
    if (!ending) throw new Error("테스트 마무리 장면 없음");
    ending.image = "/episodes/mended-moon/images/moon-festival.webp";
    ending.imageAlt = "별가루로 이어 붙인 달등 아래에서 마을 사람들이 축제를 여는 모습";

    const episode = validateEpisode(createdStory);
    expect(getCompletionVisual(episode, ending.id)).toEqual({
      image: ending.image,
      imageAlt: ending.imageAlt,
    });
  });

  it("모든 평가 장면은 정답 1개와 즉시 실패 결말을 가진다", () => {
    const episode = validateEpisode(episodeData);
    const choiceScenes = episode.scenes.filter(
      (scene) => scene.interaction && "options" in scene.interaction,
    );
    expect(choiceScenes.length).toBeGreaterThanOrEqual(7);
    for (const scene of choiceScenes) {
      if (!scene.interaction || !("options" in scene.interaction)) continue;
      expect(scene.interaction.options.length).toBeGreaterThanOrEqual(2);
      expect(scene.interaction.options.length).toBeLessThanOrEqual(3);
      if (scene.type === "choice") {
        expect(scene.interaction.options.filter((option) => option.guidance === "preferred")).toHaveLength(1);
      }
      for (const option of scene.interaction.options) {
        expect(option.feedback.trim().length).toBeGreaterThan(15);
        if (scene.type === "choice" && option.guidance === "reflect") {
          expect(option.failure?.title.trim().length).toBeGreaterThan(4);
          expect(option.failure?.ending.trim().length).toBeGreaterThan(20);
          expect(option.failure?.lesson.trim().length).toBeGreaterThan(12);
        }
      }
    }
  });

  it("비권장 선택 14개는 모두 새드 엔딩으로 표시한다", () => {
    const episode = validateEpisode(episodeData);
    const reflectiveOptions = episode.scenes.flatMap((scene) =>
      scene.interaction && "options" in scene.interaction
        ? scene.interaction.options.filter((option) => option.guidance === "reflect")
        : [],
    );
    expect(reflectiveOptions).toHaveLength(14);
    expect(reflectiveOptions.every((option) => Boolean(option.failure))).toBe(true);
  });

  it("마지막 성찰 장면의 세 교훈은 실패로 처리하지 않는다", () => {
    const episode = validateEpisode(episodeData);
    const ending = episode.scenes.find((scene) => scene.id === "HB12_END");
    expect(ending?.type).toBe("ending");
    if (!ending?.interaction || !("options" in ending.interaction)) return;
    expect(ending.interaction.options.every((option) => option.guidance === "neutral")).toBe(true);
    expect(ending.interaction.options.every((option) => !option.failure)).toBe(true);
  });

  it("실패 결말이 빠진 비권장 선택을 거부한다", () => {
    const broken = structuredClone(episodeData) as unknown as Episode;
    const scene = broken.scenes.find((candidate) => candidate.id === "HB02_GATE");
    if (!scene?.interaction || !("options" in scene.interaction)) throw new Error("테스트 장면 없음");
    scene.interaction.options[0].failure = undefined;
    expect(() => validateEpisode(broken)).toThrow(/실패 결말/);
  });

  it("정답이 둘 이상인 평가 장면을 거부한다", () => {
    const broken = structuredClone(episodeData) as unknown as Episode;
    const scene = broken.scenes.find((candidate) => candidate.id === "HB02_GATE");
    if (!scene?.interaction || !("options" in scene.interaction)) throw new Error("테스트 장면 없음");
    scene.interaction.options[0].guidance = "preferred";
    scene.interaction.options[0].failure = undefined;
    expect(() => validateEpisode(broken)).toThrow(/정답 1개/);
  });

  it("존재하지 않는 다음 장면 참조를 거부한다", () => {
    const broken = structuredClone(episodeData);
    broken.scenes[0].nextSceneId = "MISSING_SCENE";
    expect(() => validateEpisode(broken)).toThrow(/찾을 수 없어요/);
  });

  it("토리의 불빛 축제는 대사와 네 번의 마음 선택을 끝까지 연결한다", () => {
    const episode = validateEpisode(toriData);
    const choices = episode.scenes.filter((scene) => scene.type === "choice");
    const activities = episode.scenes.filter((scene) => scene.type === "activity");
    const failures = choices.flatMap((scene) =>
      scene.interaction && "options" in scene.interaction
        ? scene.interaction.options.filter((option) => option.guidance === "reflect")
        : [],
    );
    const speakers = new Set(episode.scenes.flatMap((scene) => scene.captionSpeakers ?? []));

    expect(episode.scenes).toHaveLength(13);
    expect(choices).toHaveLength(4);
    expect(activities).toHaveLength(2);
    expect(failures).toHaveLength(8);
    expect(new Set(failures.map((option) => option.failure?.title)).size).toBe(8);
    expect(speakers.has("이야기 할머니")).toBe(true);
    expect(speakers.has("토리")).toBe(true);
    expect(speakers.has("소미")).toBe(true);
    expect(episode.scenes.at(-1)?.type).toBe("ending");
  });

  it("오래된 음성 목록이 있어도 이야기 본문은 열 수 있다", async () => {
    const staleVoice = {
      schemaVersion: 1,
      episodeId: "heungbu-nolbu",
      contentVersion: "2.0.0",
      model: "gpt-4o-mini-tts",
      voice: "marin",
      format: "mp3",
      speed: 0.96,
      promptVersion: "ko-child-story-v1",
      instructionsHash: "stale",
      generatedAt: null,
      entries: [],
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => structuredClone(episodeData) })
      .mockResolvedValueOnce({ ok: true, json: async () => staleVoice });
    vi.stubGlobal("fetch", fetchMock);

    const loaded = await loadEpisode("/episodes/heungbu-nolbu/episode.json");

    expect(loaded.id).toBe("heungbu-nolbu");
    expect(loaded.voice).toBeUndefined();
    vi.unstubAllGlobals();
  });
});
