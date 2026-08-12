import { describe, expect, it } from "vitest";
import boriData from "../../public/episodes/bori-cloud-mountain/episode.json";
import boriVoiceData from "../../public/episodes/bori-cloud-mountain/audio/manifest.json";
import moonData from "../../public/episodes/broken-moon/episode.json";
import moonVoiceData from "../../public/episodes/broken-moon/audio/manifest.json";
import heungbuData from "../../public/episodes/heungbu-nolbu/episode.json";
import heungbuVoiceData from "../../public/episodes/heungbu-nolbu/audio/manifest.json";
import { validateEpisode, validateVoiceManifest } from "./story";
import { collectVoiceCues } from "./voice";
import type { VoiceManifest } from "../types/story";

const fixtures = [
  [boriData, boriVoiceData, 52],
  [moonData, moonVoiceData, 53],
  [heungbuData, heungbuVoiceData, 60],
] as const;

describe("GPT-4o mini TTS 음성 계약", () => {
  it("세 동화의 165개 재생 문구를 빠짐없이 계획한다", () => {
    let total = 0;
    for (const [episodeData, voiceData, expectedCount] of fixtures) {
      const episode = validateEpisode(episodeData);
      const manifest = validateVoiceManifest(voiceData, episode);
      const cues = collectVoiceCues(episode);

      expect(cues).toHaveLength(expectedCount);
      expect(manifest.entries).toHaveLength(expectedCount);
      expect(manifest.model).toBe("gpt-4o-mini-tts");
      expect(manifest.voice).toBe("marin");
      expect(manifest.speed).toBe(0.96);
      total += cues.length;
    }
    expect(total).toBe(165);
  });

  it("이야기 문구와 다른 음성 매니페스트를 거부한다", () => {
    const episode = validateEpisode(boriData);
    const broken = structuredClone(boriVoiceData);
    broken.entries[0].text = "현재 이야기에 없는 문장";
    expect(() => validateVoiceManifest(broken, episode)).toThrow(/일치하지 않아요/);
  });

  it("실제 파일이 등록되면 공개 MP3 경로만 허용한다", () => {
    const episode = validateEpisode(boriData);
    const broken = structuredClone(boriVoiceData) as unknown as VoiceManifest;
    broken.entries[0].file = "../../secret.mp3";
    expect(() => validateVoiceManifest(broken, episode)).toThrow(/파일 경로/);
  });
});
