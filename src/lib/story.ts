import type {
  ChoiceInteraction,
  Episode,
  EpisodeManifest,
  StoryScene,
} from "../types/story";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function validateManifest(value: unknown): EpisodeManifest {
  if (!isRecord(value) || !Array.isArray(value.episodes)) {
    throw new Error("에피소드 목록 형식이 올바르지 않아요.");
  }

  const ids = new Set<string>();
  for (const item of value.episodes) {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.dataPath !== "string") {
      throw new Error("에피소드 카드에 id와 dataPath가 필요해요.");
    }
    if (ids.has(item.id)) throw new Error(`중복된 에피소드 ID: ${item.id}`);
    ids.add(item.id);
  }

  return value as unknown as EpisodeManifest;
}

function validateScene(scene: StoryScene, sceneIds: Set<string>) {
  if (!scene.id || !scene.title || !scene.image || !scene.imageAlt) {
    throw new Error("모든 장면에는 id, title, image, imageAlt가 필요해요.");
  }
  if (!Array.isArray(scene.captions) || scene.captions.length === 0) {
    throw new Error(`${scene.id} 장면에는 자막이 필요해요.`);
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

export async function loadManifest(): Promise<EpisodeManifest> {
  const response = await fetch("/episodes/index.json");
  if (!response.ok) throw new Error("동화책 목록을 불러오지 못했어요.");
  return validateManifest(await response.json());
}

export async function loadEpisode(dataPath: string): Promise<Episode> {
  const response = await fetch(dataPath);
  if (!response.ok) throw new Error("이야기를 불러오지 못했어요.");
  return validateEpisode(await response.json());
}
