/** 외부 음원 없이 합성하는 데스 카운트 오리지널 스코어. 공개 count만 사용합니다. */
type Lane = 'music' | 'effect';
type Voice = {
  source: AudioScheduledSourceNode;
  nodes: AudioNode[];
  lane: Lane;
};

export class DeathAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private effects: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private noise: AudioBuffer | null = null;
  private enabled = true;
  private phase = 'silent';
  private count = 0;
  private voices = new Set<Voice>();
  private last = new Map<string, number>();
  private terminalUntil = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextAt = 0;
  private step = 0;
  private readonly tick = 60 / 94 / 4; // 94 BPM, 16분음표

  async unlock(): Promise<void> {
    if (!this.enabled || typeof window === 'undefined') return;
    try {
      if (!this.context || this.context.state === 'closed') {
        const c = new AudioContext();
        this.context = c;
        this.master = c.createGain();
        this.music = c.createGain();
        this.effects = c.createGain();
        this.limiter = c.createDynamicsCompressor();
        this.limiter.threshold.value = -10;
        this.limiter.knee.value = 3;
        this.limiter.ratio.value = 20;
        this.limiter.attack.value = 0.002;
        this.limiter.release.value = 0.12;
        this.master.gain.value = 0.7;
        this.music.gain.value = this.musicLevel();
        this.effects.gain.value = 0.8;
        this.music.connect(this.master);
        this.effects.connect(this.master);
        this.master.connect(this.limiter);
        this.limiter.connect(c.destination);
        this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const samples = this.noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++)
          samples[i] = Math.random() * 2 - 1;
      }
      if (this.context.state === 'suspended') await this.context.resume();
      this.startMusic();
    } catch {
      /* 재생 실패는 게임 진행을 막지 않습니다. */
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopMusic();
      this.clearVoices('effect');
      this.last.clear();
      this.terminalUntil = 0;
    }
    const c = this.context;
    if (c && this.master) {
      this.master.gain.cancelScheduledValues(c.currentTime);
      this.master.gain.setValueAtTime(enabled ? 0.7 : 0, c.currentTime);
    }
    if (enabled) this.startMusic(); // 정지된 AudioContext는 사용자 제스처 unlock으로 재개
  }

  setScene(phase: string, count: number): void {
    this.phase = phase;
    this.count = Math.max(0, Math.min(15, Number.isFinite(count) ? count : 0));
    if (!this.isMusicScene()) {
      this.stopMusic(); // result에서도 효과음 소스는 보존
      if (phase === 'silent') this.clearVoices('effect');
      return;
    }
    if (this.context && this.music) {
      this.music.gain.cancelScheduledValues(this.context.currentTime);
      this.music.gain.setTargetAtTime(
        this.musicLevel(),
        this.context.currentTime,
        0.08,
      );
    }
    this.startMusic();
  }

  private isMusicScene(): boolean {
    return ['lobby', 'ready', 'open', 'cooldown'].includes(this.phase);
  }
  private musicLevel(): number {
    return this.phase === 'lobby' ? 0.32 : 0.46;
  }
  private startMusic(): void {
    const c = this.context;
    if (
      !this.enabled ||
      !c ||
      c.state !== 'running' ||
      !this.isMusicScene() ||
      this.timer !== null
    )
      return;
    this.nextAt = c.currentTime + 0.04;
    this.step = 0;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 25);
  }
  private schedule(): void {
    const c = this.context;
    if (!c || c.state !== 'running' || !this.enabled || !this.isMusicScene())
      return;
    // 백그라운드 지연 후 밀린 음표를 한꺼번에 재생하지 않습니다.
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.025;
    while (this.nextAt < c.currentTime + 0.12) {
      this.compose(this.nextAt, this.step++);
      this.nextAt += this.tick;
    }
  }
  private compose(at: number, step: number): void {
    const beat = step % 16;
    const bar = Math.floor(step / 16) % 4;
    const root = [42, 38, 40, 43][bar]; // F#–D–E–G의 불안정한 4마디 순환
    const tension = this.phase === 'lobby' ? 0 : this.count / 15;
    const note = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
    if (beat === 0) {
      for (const interval of [12, 19, 27])
        this.tone(
          note(root + interval),
          note(root + interval) * 1.002,
          this.tick * 15.5,
          0.045,
          at,
          'music',
          'triangle',
          1100,
          0.2,
        );
    }
    if (beat % 4 === 0 || (tension > 0.3 && beat % 2 === 0)) {
      const offset = [0, 0, 7, 0, 0, 3, 7, 1][Math.floor(beat / 2)];
      this.tone(
        note(root + offset),
        note(root + offset),
        0.2,
        0.21,
        at,
        'music',
        'triangle',
        520,
      );
    }
    if (beat === 0 || beat === 8) this.tone(125, 38, 0.2, 0.3, at, 'music');
    if (beat === 4 || beat === 12)
      this.hiss(at, 0.12, 0.07, 1600, 'music', 'bandpass');
    if (beat % 4 === 2 || (tension > 0.45 && beat % 2 === 1))
      this.hiss(at, 0.028, 0.035 + tension * 0.018, 6200, 'music', 'highpass');
    if (tension > 0.72 && [3, 7, 11, 15].includes(beat))
      this.tone(
        note(root + 36 + [0, 1, 7, 3][Math.floor(beat / 4)]),
        note(root + 36),
        0.09,
        0.045,
        at,
        'music',
        'sine',
      );
  }

  private register(
    source: AudioScheduledSourceNode,
    nodes: AudioNode[],
    lane: Lane,
  ): void {
    const voice = { source, nodes, lane };
    this.voices.add(voice);
    source.onended = () => {
      this.voices.delete(voice);
      source.disconnect();
      for (const node of nodes) node.disconnect();
    };
  }
  private tone(
    frequency: number,
    end: number,
    duration: number,
    volume: number,
    at: number,
    lane: Lane = 'effect',
    type: OscillatorType = 'sine',
    cutoff = 14000,
    attack = 0.006,
  ): void {
    const c = this.context;
    const bus = lane === 'music' ? this.music : this.effects;
    if (!c || !bus || this.voices.size >= 48) return;
    const source = c.createOscillator();
    const gain = c.createGain();
    const filter = c.createBiquadFilter();
    source.type = type;
    source.frequency.setValueAtTime(frequency, at);
    source.frequency.exponentialRampToValueAtTime(end, at + duration);
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(
      volume,
      at + Math.min(attack, duration / 3),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    this.register(source, [gain, filter], lane);
    source.start(at);
    source.stop(at + duration + 0.01);
  }
  private hiss(
    at: number,
    duration: number,
    volume: number,
    frequency: number,
    lane: Lane,
    type: BiquadFilterType = 'lowpass',
  ): void {
    const c = this.context;
    const bus = lane === 'music' ? this.music : this.effects;
    if (!c || !bus || !this.noise || this.voices.size >= 48) return;
    const source = c.createBufferSource();
    source.buffer = this.noise;
    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, at);
    if (type === 'lowpass')
      filter.frequency.exponentialRampToValueAtTime(110, at + duration);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    this.register(source, [gain, filter], lane);
    source.start(at);
    source.stop(at + duration);
  }
  private gate(key: string, gap: number): AudioContext | null {
    const c = this.context;
    if (
      !this.enabled ||
      this.phase === 'silent' ||
      !c ||
      c.state !== 'running' ||
      c.currentTime < this.terminalUntil
    )
      return null;
    if (c.currentTime - (this.last.get(key) ?? -Infinity) < gap) return null;
    if (
      key !== 'terminal' &&
      [...this.voices].filter((v) => v.lane === 'effect').length >= 12
    )
      return null;
    this.last.set(key, c.currentTime);
    return c;
  }
  private duck(duration: number): void {
    const c = this.context;
    if (!c || !this.music) return;
    const parameter = this.music.gain;
    parameter.cancelScheduledValues(c.currentTime);
    parameter.setValueAtTime(this.musicLevel() * 0.35, c.currentTime);
    parameter.setValueAtTime(
      this.musicLevel() * 0.35,
      c.currentTime + duration,
    );
    parameter.linearRampToValueAtTime(
      this.musicLevel(),
      c.currentTime + duration + 0.16,
    );
  }
  heartbeat(count: number): void {
    const c = this.gate('heartbeat', 0.45);
    if (!c) return;
    const p =
      Math.max(0, Math.min(15, Number.isFinite(count) ? count : 0)) / 15;
    this.tone(70 + p * 14, 40, 0.12, 0.07, c.currentTime);
    this.tone(58, 37, 0.09, 0.045, c.currentTime + 0.15);
  }
  tap(): void {
    const c = this.gate('tap', 0.08);
    if (!c) return;
    this.tone(460, 240, 0.04, 0.12, c.currentTime);
  }
  safe(): void {
    const c = this.gate('safe', 0.2);
    if (!c) return;
    this.duck(0.12);
    this.tone(660, 780, 0.14, 0.17, c.currentTime);
    this.tone(1320, 1170, 0.08, 0.045, c.currentTime + 0.035);
  }
  crash(): void {
    this.explode(true);
  }
  bomb(): void {
    this.explode(false);
  }
  private explode(crash: boolean): void {
    const c = this.gate('terminal', 0.8);
    if (!c) return;
    this.phase = 'result';
    this.stopMusic();
    this.clearVoices('effect');
    this.terminalUntil = c.currentTime + 0.8;
    this.hiss(
      c.currentTime,
      crash ? 0.65 : 0.52,
      0.6,
      crash ? 3600 : 1700,
      'effect',
    );
    this.tone(crash ? 155 : 100, 29, 0.64, 0.46, c.currentTime);
    if (crash)
      this.tone(
        840,
        105,
        0.22,
        0.14,
        c.currentTime,
        'effect',
        'triangle',
        1800,
      );
  }
  private clearVoices(lane: Lane): void {
    for (const voice of this.voices) {
      if (voice.lane !== lane) continue;
      try {
        voice.source.stop();
      } catch {
        /* 이미 끝난 소스 */
      }
      voice.source.disconnect();
      for (const node of voice.nodes) node.disconnect();
      this.voices.delete(voice);
    }
  }
  private stopMusic(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.clearVoices('music');
  }
  /** 화면 해제 시 호출. UI가 소유한 heartbeat 타이머도 별도로 정리합니다. */
  stop(): void {
    this.phase = 'silent';
    this.stopMusic();
    this.clearVoices('effect');
    this.last.clear();
    this.terminalUntil = 0;
    const c = this.context;
    this.context = null;
    this.master?.disconnect();
    this.music?.disconnect();
    this.effects?.disconnect();
    this.limiter?.disconnect();
    this.master = null;
    this.music = null;
    this.effects = null;
    this.limiter = null;
    this.noise = null;
    if (c && c.state !== 'closed') void c.close().catch(() => {});
  }
}
