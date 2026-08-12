import { afterEach, describe, expect, it, vi } from "vitest";
import { StoryAudioEngine } from "./audio";

describe("자동 낭독 재생 정책", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("기본으로 꺼진 상태에서는 음성 파일을 만들지 않고 문장을 건너뛴다", () => {
    const audioCreated = vi.fn();
    const finished = vi.fn();
    vi.stubGlobal("Audio", class {
      constructor() {
        audioCreated();
      }
    });

    const engine = new StoryAudioEngine();
    engine.playVoice({
      key: "scene:caption:00",
      src: "/episodes/story/audio/caption.mp3",
      text: "부모님이 읽어 주는 문장",
      onEnded: finished,
    });

    expect(audioCreated).not.toHaveBeenCalled();
    expect(finished).toHaveBeenCalledOnce();
  });
});
