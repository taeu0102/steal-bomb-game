import type { MusicTheme } from "../types/story";

export interface VoicePlaybackRequest {
  key: string;
  src?: string | null;
  text: string;
  onEnded?: () => void;
}

interface ThemeScore {
  melody: number[];
  bass: number[];
  intervalMs: number;
  wave: OscillatorType;
  filterHz: number;
}

const themeScores: Record<MusicTheme, ThemeScore> = {
  village: {
    melody: [392, 440, 523.25, 440, 329.63],
    bass: [196, 220, 164.81],
    intervalMs: 1550,
    wave: "sine",
    filterHz: 1700,
  },
  care: {
    melody: [329.63, 392, 440, 392, 293.66],
    bass: [164.81, 196, 146.83],
    intervalMs: 1750,
    wave: "sine",
    filterHz: 1450,
  },
  wonder: {
    melody: [392, 493.88, 587.33, 659.25, 587.33],
    bass: [196, 246.94, 293.66],
    intervalMs: 1480,
    wave: "triangle",
    filterHz: 2200,
  },
  comic: {
    melody: [349.23, 440, 392, 523.25, 440],
    bass: [174.61, 196, 220],
    intervalMs: 1220,
    wave: "triangle",
    filterHz: 1900,
  },
  repair: {
    melody: [329.63, 392, 493.88, 523.25, 659.25],
    bass: [164.81, 196, 246.94],
    intervalMs: 1580,
    wave: "sine",
    filterHz: 1800,
  },
  festival: {
    melody: [523.25, 659.25, 783.99, 698.46, 659.25, 880],
    bass: [261.63, 329.63, 392],
    intervalMs: 1260,
    wave: "triangle",
    filterHz: 2400,
  },
  ember: {
    melody: [293.66, 349.23, 392, 349.23, 261.63],
    bass: [146.83, 174.61, 130.81],
    intervalMs: 1880,
    wave: "sine",
    filterHz: 1250,
  },
  storm: {
    melody: [293.66, 329.63, 392, 349.23, 293.66],
    bass: [146.83, 164.81, 130.81],
    intervalMs: 1660,
    wave: "triangle",
    filterHz: 1150,
  },
  calm: {
    melody: [329.63, 392, 440, 392, 329.63],
    bass: [164.81, 196, 220],
    intervalMs: 2100,
    wave: "sine",
    filterHz: 1350,
  },
  lantern: {
    melody: [392, 493.88, 523.25, 659.25, 523.25],
    bass: [196, 246.94, 261.63],
    intervalMs: 1720,
    wave: "sine",
    filterHz: 1850,
  },
};

export class StoryAudioEngine {
  private context: AudioContext | null = null;
  private timer: number | null = null;
  private noteIndex = 0;
  private theme: MusicTheme = "village";
  private muted = false;
  private narrationEnabled = false;
  private voiceAudio: HTMLAudioElement | null = null;
  private voiceKey: string | null = null;
  private voiceToken = 0;

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
    if (this.muted === muted) return;
    this.muted = muted;
    if (muted) {
      this.stopMusic();
    } else if (this.context) {
      void this.unlock().then((ready) => {
        if (ready) this.playTheme(this.theme);
      });
    }
  }

  setNarrationEnabled(enabled: boolean) {
    if (this.narrationEnabled === enabled) return;
    this.narrationEnabled = enabled;
    if (!enabled) this.stopVoice();
  }

  playTheme(theme: MusicTheme) {
    this.theme = theme;
    this.stopMusic();
    if (this.muted || !this.context) return;
    this.noteIndex = 0;
    const playNext = () => {
      if (this.muted || !this.context) return;
      const score = themeScores[this.theme];
      const melody = score.melody[this.noteIndex % score.melody.length];
      const bass = score.bass[Math.floor(this.noteIndex / 2) % score.bass.length];

      this.softTone(melody, 1.45, 0.009, score.wave, score.filterHz);
      if (this.noteIndex % 2 === 0) {
        this.softTone(bass, 3.2, 0.0045, "sine", Math.min(score.filterHz, 1100));
      }
      if (this.noteIndex % 3 === 1) {
        this.softTone(melody * 2, 2.1, 0.0022, "sine", score.filterHz + 500, 0.16);
      }
      this.noteIndex += 1;
    };
    playNext();
    this.timer = window.setInterval(playNext, themeScores[theme].intervalMs);
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
      window.setTimeout(
        () => this.softTone(note, duration, volume, "sine", 2400),
        index * interval,
      ),
    );
  }

  playVoice({ key, src, text, onEnded }: VoicePlaybackRequest) {
    if (!this.narrationEnabled) {
      onEnded?.();
      return;
    }

    this.stopVoice();
    const token = this.voiceToken;
    this.voiceKey = key;

    if (!src || typeof Audio === "undefined") {
      this.speakFallback(text, token, onEnded);
      return;
    }

    const audio = new Audio(src);
    this.voiceAudio = audio;
    audio.preload = "auto";
    let fallbackStarted = false;

    const finish = () => {
      if (fallbackStarted || token !== this.voiceToken) return;
      this.voiceAudio = null;
      this.voiceKey = null;
      onEnded?.();
    };
    const fallback = () => {
      if (fallbackStarted || token !== this.voiceToken) return;
      fallbackStarted = true;
      audio.removeEventListener("ended", finish);
      audio.removeEventListener("error", fallback);
      audio.pause();
      this.voiceAudio = null;
      this.speakFallback(text, token, onEnded);
    };

    audio.addEventListener("ended", finish, { once: true });
    audio.addEventListener("error", fallback, { once: true });
    void audio.play().catch(fallback);
  }

  pauseVoice() {
    this.voiceAudio?.pause();
    window.speechSynthesis?.pause();
  }

  resumeVoice() {
    if (!this.narrationEnabled) return;
    if (this.voiceAudio?.paused) void this.voiceAudio.play().catch(() => undefined);
    window.speechSynthesis?.resume();
  }

  stopVoice() {
    this.voiceToken += 1;
    if (this.voiceAudio) {
      this.voiceAudio.pause();
      try {
        this.voiceAudio.currentTime = 0;
      } catch {
        // 아직 메타데이터가 없는 음원은 재생 위치를 바꿀 수 없지만 중지는 유지됩니다.
      }
    }
    this.voiceAudio = null;
    this.voiceKey = null;
    window.speechSynthesis?.cancel();
  }

  stopSpeech() {
    this.stopVoice();
  }

  stopMusic() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private softTone(
    frequency: number,
    duration: number,
    volume: number,
    wave: OscillatorType,
    filterHz: number,
    delay = 0,
  ) {
    if (!this.context) return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, now);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterHz, now);
    filter.Q.setValueAtTime(0.35, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + Math.min(0.16, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(filter).connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.05);
  }

  private speakFallback(text: string, token: number, onEnded?: () => void) {
    if (!this.narrationEnabled || !("speechSynthesis" in window)) {
      if (token === this.voiceToken) onEnded?.();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 0.94;
    utterance.pitch = 1;
    const voice = window.speechSynthesis
      .getVoices()
      .find((candidate) => candidate.lang.toLowerCase().startsWith("ko"));
    if (voice) utterance.voice = voice;

    let completed = false;
    const finish = () => {
      if (completed || token !== this.voiceToken) return;
      completed = true;
      this.voiceKey = null;
      onEnded?.();
    };
    utterance.addEventListener("end", finish, { once: true });
    utterance.addEventListener("error", finish, { once: true });
    window.speechSynthesis.speak(utterance);
  }
}

export const storyAudio = new StoryAudioEngine();
