import type { MusicTheme } from "../types/story";

const themeNotes: Record<MusicTheme, number[]> = {
  village: [392, 440, 523.25, 440, 329.63],
  care: [329.63, 392, 440, 392, 293.66],
  wonder: [392, 493.88, 587.33, 659.25, 587.33],
  comic: [349.23, 440, 392, 523.25, 440],
  repair: [329.63, 392, 493.88, 523.25, 659.25],
};

class StoryAudioEngine {
  private context: AudioContext | null = null;
  private timer: number | null = null;
  private noteIndex = 0;
  private theme: MusicTheme = "village";
  private muted = false;

  async unlock() {
    try {
      const AudioContextConstructor =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) return false;
      if (!this.context) this.context = new AudioContextConstructor();
      if (this.context.state === "suspended") await this.context.resume();
      return this.context.state === "running";
    } catch {
      // 일부 인앱 브라우저는 오디오 생성을 막습니다. 소리 없이도 이야기는 계속 진행합니다.
      this.context = null;
      return false;
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) {
      this.stopMusic();
      window.speechSynthesis?.cancel();
    } else if (this.context) {
      void this.unlock().then((ready) => {
        if (ready) this.playTheme(this.theme);
      });
    }
  }

  playTheme(theme: MusicTheme) {
    this.theme = theme;
    this.stopMusic();
    if (this.muted || !this.context) return;
    const playNext = () => {
      if (this.muted || !this.context) return;
      const notes = themeNotes[this.theme];
      this.pluck(notes[this.noteIndex % notes.length], 1.25, 0.018);
      this.noteIndex += 1;
    };
    playNext();
    this.timer = window.setInterval(playNext, theme === "comic" ? 1150 : 1550);
  }

  playChime(kind: "choice" | "page" | "tap" | "complete" | "fail") {
    if (this.muted || !this.context) return;
    const notes = {
      choice: [523.25, 659.25],
      page: [392, 523.25],
      tap: [659.25],
      complete: [523.25, 659.25, 783.99],
      fail: [392, 349.23, 293.66],
    }[kind];
    const interval = kind === "fail" ? 240 : 120;
    const duration = kind === "fail" ? 0.9 : 0.55;
    const volume = kind === "fail" ? 0.018 : 0.035;
    notes.forEach((note, index) =>
      window.setTimeout(() => this.pluck(note, duration, volume), index * interval),
    );
  }

  speak(text: string) {
    if (this.muted || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 0.88;
    utterance.pitch = 1.04;
    const voice = window.speechSynthesis
      .getVoices()
      .find((candidate) => candidate.lang.toLowerCase().startsWith("ko"));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }

  stopSpeech() {
    window.speechSynthesis?.cancel();
  }

  stopMusic() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private pluck(frequency: number, duration: number, volume: number) {
    if (!this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.05);
  }
}

export const storyAudio = new StoryAudioEngine();
