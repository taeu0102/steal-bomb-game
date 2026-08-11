import type { Episode, StoryProgress, StorySettings } from "../types/story";

const SETTINGS_KEY = "maeum-seed:settings:v1";
const progressKey = (episodeId: string) => `maeum-seed:progress:${episodeId}`;

export const defaultSettings: StorySettings = { captions: true, muted: false };

export function loadSettings(): StorySettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const value = JSON.parse(raw) as Partial<StorySettings>;
    return {
      captions: typeof value.captions === "boolean" ? value.captions : true,
      muted: typeof value.muted === "boolean" ? value.muted : false,
    };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: StorySettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // 저장이 막혀 있어도 현재 세션은 계속 진행합니다.
  }
}

export function loadProgress(episode: Episode): StoryProgress | null {
  try {
    const raw = localStorage.getItem(progressKey(episode.id));
    if (!raw) return null;
    const value = JSON.parse(raw) as StoryProgress;
    const sceneExists = episode.scenes.some((scene) => scene.id === value.sceneId);
    if (
      value.schemaVersion !== 1 ||
      value.episodeId !== episode.id ||
      value.contentVersion !== episode.contentVersion ||
      !sceneExists ||
      !Array.isArray(value.selections)
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function saveProgress(progress: StoryProgress) {
  try {
    localStorage.setItem(progressKey(progress.episodeId), JSON.stringify(progress));
  } catch {
    // 저장이 막혀 있어도 현재 세션은 계속 진행합니다.
  }
}

export function clearProgress(episodeId: string) {
  try {
    localStorage.removeItem(progressKey(episodeId));
  } catch {
    // no-op
  }
}
