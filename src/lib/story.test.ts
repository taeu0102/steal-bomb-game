import { describe, expect, it } from "vitest";
import brokenMoonData from "../../public/episodes/broken-moon/episode.json";
import episodeData from "../../public/episodes/heungbu-nolbu/episode.json";
import manifestData from "../../public/episodes/index.json";
import { getCompletionVisual, validateEpisode, validateManifest } from "./story";
import type { Episode } from "../types/story";

describe("에피소드 데이터 계약", () => {
  it("에피소드 목록을 검증한다", () => {
    const manifest = validateManifest(manifestData);
    expect(manifest.episodes.some((item) => item.id === "heungbu-nolbu")).toBe(true);
    expect(manifest.episodes.some((item) => item.id === "broken-moon")).toBe(true);
    expect(manifest.episodes.filter((item) => item.featured)).toHaveLength(1);
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
});
