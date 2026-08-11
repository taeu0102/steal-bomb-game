import { describe, expect, it } from "vitest";
import episodeData from "../../public/episodes/heungbu-nolbu/episode.json";
import manifestData from "../../public/episodes/index.json";
import { validateEpisode, validateManifest } from "./story";

describe("에피소드 데이터 계약", () => {
  it("에피소드 목록을 검증한다", () => {
    const manifest = validateManifest(manifestData);
    expect(manifest.episodes).toHaveLength(1);
    expect(manifest.episodes[0].id).toBe("heungbu-nolbu");
  });

  it("흥부와 놀부의 13개 장면을 모두 연결한다", () => {
    const episode = validateEpisode(episodeData);
    expect(episode.scenes).toHaveLength(13);
    expect(episode.startSceneId).toBe("HB00_TITLE");
    expect(episode.scenes.at(-1)?.type).toBe("ending");
  });

  it("모든 선택 장면은 2~3개 선택지와 부드러운 피드백을 가진다", () => {
    const episode = validateEpisode(episodeData);
    const choiceScenes = episode.scenes.filter(
      (scene) => scene.interaction && "options" in scene.interaction,
    );
    expect(choiceScenes.length).toBeGreaterThanOrEqual(7);
    for (const scene of choiceScenes) {
      if (!scene.interaction || !("options" in scene.interaction)) continue;
      expect(scene.interaction.options.length).toBeGreaterThanOrEqual(2);
      expect(scene.interaction.options.length).toBeLessThanOrEqual(3);
      for (const option of scene.interaction.options) {
        expect(option.feedback.trim().length).toBeGreaterThan(15);
      }
    }
  });

  it("직접 재현하면 위험한 선택은 다시 생각하기 피드백으로 표시한다", () => {
    const episode = validateEpisode(episodeData);
    const reflectiveOptions = episode.scenes.flatMap((scene) =>
      scene.interaction && "options" in scene.interaction
        ? scene.interaction.options.filter((option) => option.guidance === "reflect")
        : [],
    );
    expect(reflectiveOptions.length).toBeGreaterThan(0);
    expect(reflectiveOptions.every((option) => option.feedback.length > 0)).toBe(true);
  });

  it("존재하지 않는 다음 장면 참조를 거부한다", () => {
    const broken = structuredClone(episodeData);
    broken.scenes[0].nextSceneId = "MISSING_SCENE";
    expect(() => validateEpisode(broken)).toThrow(/찾을 수 없어요/);
  });
});
