export type SceneType = "cinematic" | "choice" | "activity" | "ending";
export type Guidance = "preferred" | "reflect" | "neutral";
export type SpeakerPosition = "left" | "center" | "right" | "narrator";
export type MusicTheme =
  | "village"
  | "care"
  | "wonder"
  | "comic"
  | "repair"
  | "festival"
  | "ember"
  | "storm"
  | "calm"
  | "lantern";

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
  ttsEnabled?: boolean;
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

export type ParticipationKind = "parent-read" | "child-repeat" | "child-question";

export interface ActivityParticipation {
  kind: ParticipationKind;
  speaker?: string;
  instruction: string;
  line?: string;
}

export interface ActivityInteraction {
  kind: "tap";
  prompt: string;
  targetLabel: string;
  targetEmoji: string;
  tapsRequired: number;
  feedback: string;
  participation?: ActivityParticipation[];
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
  captionSpeakers?: string[];
  speakerPositions?: Record<string, SpeakerPosition>;
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
  narration: boolean;
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
