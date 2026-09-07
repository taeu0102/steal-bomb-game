/** 사용자 제스처에서 unlock()을 호출합니다. 게임 판정과 독립적인 합성 효과음입니다. */
export class DeathAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private voices = new Set<AudioScheduledSourceNode>();
  private last = new Map<string, number>();
  private terminalUntil = 0;

  async unlock(): Promise<void> {
    if (!this.enabled || typeof window === 'undefined') return;
    try {
      if (!this.context || this.context.state === 'closed') {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = 0.45;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') await this.context.resume();
    } catch {
      /* 오디오가 차단되어도 게임은 계속됩니다. */
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.stop();
    if (this.context && this.master)
      this.master.gain.setValueAtTime(
        enabled ? 0.45 : 0,
        this.context.currentTime,
      );
  }

  private gate(key: string, interval: number): AudioContext | null {
    const c = this.context;
    if (
      !this.enabled ||
      !c ||
      c.state !== 'running' ||
      c.currentTime < this.terminalUntil
    )
      return null;
    const previous = this.last.get(key) ?? -Infinity;
    if (
      c.currentTime - previous < interval ||
      (key !== 'terminal' && this.voices.size >= 8)
    )
      return null;
    this.last.set(key, c.currentTime);
    return c;
  }

  private track(
    source: AudioScheduledSourceNode,
    gain: GainNode,
    filter?: BiquadFilterNode,
  ): void {
    this.voices.add(source);
    source.onended = () => {
      this.voices.delete(source);
      source.disconnect();
      gain.disconnect();
      filter?.disconnect();
    };
  }

  private tone(
    c: AudioContext,
    frequency: number,
    endFrequency: number,
    duration: number,
    volume: number,
    offset = 0,
  ): void {
    if (!this.master) return;
    const start = c.currentTime + offset;
    const source = c.createOscillator();
    const gain = c.createGain();
    source.type = 'sine';
    source.frequency.setValueAtTime(frequency, start);
    source.frequency.exponentialRampToValueAtTime(
      endFrequency,
      start + duration,
    );
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(gain);
    gain.connect(this.master);
    this.track(source, gain);
    source.start(start);
    source.stop(start + duration + 0.015);
  }

  heartbeat(count: number): void {
    const c = this.gate('heartbeat', 0.4);
    if (!c) return;
    // 공개된 카운트만 사용하며 실제 함정 번호는 받지 않습니다.
    const progress =
      Math.max(0, Math.min(15, Number.isFinite(count) ? count : 0)) / 15;
    this.tone(c, 64 + progress * 18, 42, 0.12, 0.055 + progress * 0.025);
    this.tone(c, 55 + progress * 12, 38, 0.09, 0.035, 0.15);
  }

  tap(): void {
    const c = this.gate('tap', 0.08);
    if (c) this.tone(c, 380, 250, 0.035, 0.07);
  }

  safe(): void {
    const c = this.gate('safe', 0.2);
    if (c) this.tone(c, 660, 740, 0.11, 0.09);
  }

  crash(): void {
    this.explode(true);
  }
  bomb(): void {
    this.explode(false);
  }

  private explode(crash: boolean): void {
    const c = this.gate('terminal', 0.75);
    if (!c || !this.master) return;
    this.stopVoices();
    this.terminalUntil = c.currentTime + 0.75;
    const duration = crash ? 0.6 : 0.48;
    const buffer = c.createBuffer(
      1,
      Math.ceil(c.sampleRate * duration),
      c.sampleRate,
    );
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const source = c.createBufferSource();
    source.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(crash ? 2600 : 1200, c.currentTime);
    filter.frequency.exponentialRampToValueAtTime(
      110,
      c.currentTime + duration,
    );
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, c.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    this.track(source, gain, filter);
    source.start();
    source.stop(c.currentTime + duration);
    this.tone(c, crash ? 125 : 88, 28, duration, 0.22);
  }

  private stopVoices(): void {
    for (const voice of this.voices) {
      try {
        voice.stop();
      } catch {
        /* 이미 종료된 소스 */
      }
    }
    this.voices.clear();
  }

  /** 라운드 전환/화면 해제에서 호출. UI 소유 heartbeat 타이머도 별도로 해제합니다. */
  stop(): void {
    this.stopVoices();
    this.last.clear();
    this.terminalUntil = 0;
  }
}
