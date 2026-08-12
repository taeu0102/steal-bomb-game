import type { Episode, VoiceManifestEntry } from "../types/story";

export interface VoiceCue {
  key: string;
  text: string;
}

const twoDigits = (index: number) => String(index).padStart(2, "0");

export const captionVoiceKey = (sceneId: string, captionIndex: number) =>
  `${sceneId}:caption:${twoDigits(captionIndex)}`;

export const optionFeedbackVoiceKey = (sceneId: string, optionId: string) =>
  `${sceneId}:option:${optionId}:feedback`;

export const optionFailureVoiceKey = (sceneId: string, optionId: string) =>
  `${sceneId}:option:${optionId}:failure`;

export const activityFeedbackVoiceKey = (sceneId: string) =>
  `${sceneId}:activity:feedback`;

export function failureVoiceText(failure: {
  title: string;
  ending: string;
  lesson: string;
}) {
  return `${failure.title}. ${failure.ending} ${failure.lesson}`;
}

export function collectVoiceCues(episode: Episode): VoiceCue[] {
  const cues: VoiceCue[] = [];

  for (const scene of episode.scenes) {
    scene.captions.forEach((text, index) => {
      cues.push({ key: captionVoiceKey(scene.id, index), text });
    });

    if (scene.interaction?.kind === "tap") {
      cues.push({
        key: activityFeedbackVoiceKey(scene.id),
        text: scene.interaction.feedback,
      });
      continue;
    }

    if (scene.interaction && "options" in scene.interaction) {
      for (const option of scene.interaction.options) {
        if (option.guidance === "reflect" && option.failure) {
          cues.push({
            key: optionFailureVoiceKey(scene.id, option.id),
            text: failureVoiceText(option.failure),
          });
        } else {
          cues.push({
            key: optionFeedbackVoiceKey(scene.id, option.id),
            text: option.feedback,
          });
        }
      }
    }
  }

  return cues;
}

export function getVoiceEntry(
  episode: Episode,
  key: string,
): VoiceManifestEntry | undefined {
  return episode.voice?.entries.find((entry) => entry.key === key);
}

export function hasGeneratedVoice(episode: Episode) {
  const entries = episode.voice?.entries ?? [];
  return entries.some((entry) => Boolean(entry.file));
}
