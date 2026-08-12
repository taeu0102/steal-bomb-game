export type SceneType = "cinematic" | "choice" | "activity" | "ending";
export type Guidance = "preferred" | "reflect" | "neutral";
export type MusicTheme = "village" | "care" | "wonder" | "comic" | "repair";

export interface EpisodeManifestItem {
  id: string;
  dataPath: string;
  title: string;
  subtitle: string;
  cover: string;
  ageRange: string;
  estimatedMinutes: number;
  summary: string;
  featured: boolean;
  enabled: boolean;
}

export interface EpisodeManifest {
  schemaVersion: string;
  episodes: EpisodeManifestItem[];
}

export interface ChoiceOption {
  id: string;
  label: string;
  description?: string;
  emoji: string;
  guidance: Guidance;
  feedback: string;
  failure?: {
    title: string;
    ending: string;
    lesson: string;
  };
  seed?: string;
  nextSceneId?: string;
}

export interface ChoiceInteraction {
  kind: "choice" | "reflection";
  prompt: string;
  retryLabel: string;
  continueLabel: string;
  options: ChoiceOption[];
}

export interface ActivityInteraction {
  kind: "tap";
  prompt: string;
  targetLabel: string;
  targetEmoji: string;
  tapsRequired: number;
  feedback: string;
}

export type SceneInteraction = ChoiceInteraction | ActivityInteraction;

export interface StoryScene {
  id: string;
  number: number;
  title: string;
  type: SceneType;
  estimatedDurationMs: number;
  checkpoint: boolean;
  image: string;
  imageAlt: string;
  imagePosition?: string;
  motion?: "push" | "drift-left" | "drift-right" | "still";
  eyebrow: string;
  captions: string[];
  soundCaption?: string;
  music: MusicTheme;
  lessonTags: string[];
  safetyNote?: string;
  nextSceneId?: string;
  interaction?: SceneInteraction;
}

export interface Episode {
  schemaVersion: string;
  contentVersion: string;
  id: string;
  meta: {
    title: string;
    subtitle: string;
    ageRange: string;
    estimatedMinutes: number;
    cover: string;
    summary: string;
    lesson: string;
    openingQuestion: string;
    discussionPrompts: string[];
  };
  contentSafety: {
    audience: string;
    adaptationNote: string;
    animalSafetyNote: string;
  };
  startSceneId: string;
  scenes: StoryScene[];
  voice?: VoiceManifest;
}

export interface VoiceManifestEntry {
  key: string;
  text: string;
  inputHash: string;
  file: string | null;
}

export interface VoiceManifest {
  schemaVersion: 1;
  episodeId: string;
  contentVersion: string;
  model: "gpt-4o-mini-tts";
  voice: string;
  format: "mp3";
  speed: number;
  promptVersion: string;
  instructionsHash: string;
  generatedAt: string | null;
  entries: VoiceManifestEntry[];
}

export interface StorySettings {
  captions: boolean;
  muted: boolean;
}

export interface SelectionRecord {
  sceneId: string;
  optionId: string;
  label: string;
  seed?: string;
}

export interface StoryProgress {
  schemaVersion: 1;
  episodeId: string;
  contentVersion: string;
  sceneId: string;
  selections: SelectionRecord[];
  resumePhase?: "playing" | "choice";
  completed: boolean;
  updatedAt: string;
}
