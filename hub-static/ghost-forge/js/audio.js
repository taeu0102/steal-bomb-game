const SUPPORTED_CUES = new Set([
  "tap",
  "reinforce",
  "amplify",
  "success",
  "failure",
  "explode",
  "charm",
  "seal",
  "reward",
  "result",
]);

const LEGACY_CUES = Object.freeze({
  question: "reinforce",
  stamp: "seal",
  reveal: "reward",
  "ending-good": "result",
  "ending-bad": "failure",
});

const MIN_CUE_GAP_MS = Object.freeze({
  tap: 45,
  reinforce: 160,
  amplify: 220,
  success: 220,
  failure: 220,
  explode: 520,
  charm: 320,
  seal: 320,
  reward: 380,
  result: 650,
});

function audioContextClass() {
  return globalThis.AudioContext || globalThis.webkitAudioContext || null;
}

function safeStop(node) {
  try {
    node?.stop();
  } catch {
    // 이미 정지한 Web Audio 노드는 다시 stop할 수 없다.
  }
}

function safeDisconnect(node) {
  try {
    node?.disconnect();
  } catch {
    // 연결되지 않은 노드의 정리 실패는 무시한다.
  }
}

export class GameAudio {
  constructor(enabled = false) {
    this.enabled = Boolean(enabled);
    this.context = null;
    this.master = null;
    this.ambientBus = null;
    this.sfxBus = null;
    this.compressor = null;
    this.noiseBuffer = null;
    this.ambientGraph = null;
    this.ambientTimer = null;
    this.ambientRequested = false;
    this.hidden = false;
    this.lastCueAt = new Map();
    this.mood = "calm";
  }

  isEnabled() {
    return this.enabled;
  }

  async setEnabled(enabled) {
    this.enabled = Boolean(enabled);

    if (!this.enabled) {
      this._stopAmbientNodes();
      if (this.context?.state === "running") {
        await this.context.suspend().catch(() => {});
      }
      return this.enabled;
    }

    const context = await this._ensureContext();
    if (context?.state === "running" && this.ambientRequested) this._startAmbientNodes();
    return this.enabled;
  }

  async toggle() {
    await this.setEnabled(!this.enabled);
    return this.enabled;
  }

  async play(name) {
    if (!this.enabled || this.hidden) return false;

    const cue = LEGACY_CUES[name] || name;
    if (!SUPPORTED_CUES.has(cue)) return false;

    const nowMs = Date.now();
    const previous = this.lastCueAt.get(cue) || 0;
    if (nowMs - previous < MIN_CUE_GAP_MS[cue]) return false;

    const context = await this._ensureContext();
    if (!context || context.state !== "running") return false;

    this.lastCueAt.set(cue, nowMs);
    if (this.ambientRequested) this._startAmbientNodes();

    const now = context.currentTime;
    this._duckAmbient(cue === "explode" ? 0.26 : cue === "result" ? 0.42 : 0.62, cue === "explode" ? 0.8 : 0.45);

    switch (cue) {
      case "tap":
        this._noise(0.025, { start: now, gain: 0.022, frequency: 1450, type: "bandpass", q: 1.2 });
        this._tone(520, 0.045, { start: now, endFrequency: 430, gain: 0.026, type: "triangle" });
        break;
      case "reinforce":
        this._noise(0.065, { start: now, gain: 0.055, frequency: 620, type: "lowpass" });
        this._tone(118, 0.16, { start: now, endFrequency: 72, gain: 0.075, type: "sine" });
        this._metal(205, 0.34, { start: now + 0.018, gain: 0.064, brightness: 0.78 });
        break;
      case "amplify":
        this._tone(74, 0.34, { start: now, endFrequency: 48, gain: 0.095, type: "sine" });
        this._noise(0.09, { start: now + 0.025, gain: 0.07, frequency: 780, type: "lowpass" });
        this._metal(176, 0.38, { start: now + 0.02, gain: 0.072, brightness: 0.62 });
        this._tone(170, 0.3, { start: now + 0.08, endFrequency: 430, gain: 0.038, type: "triangle" });
        break;
      case "success":
        this._metal(330, 0.52, { start: now, gain: 0.064, brightness: 1.05 });
        [440, 660, 880].forEach((frequency, index) => {
          this._tone(frequency, 0.34 + index * 0.06, {
            start: now + 0.055 + index * 0.075,
            gain: 0.038 - index * 0.006,
            type: "sine",
          });
        });
        break;
      case "failure":
        this._noise(0.18, { start: now, gain: 0.068, frequency: 430, type: "lowpass" });
        this._tone(132, 0.3, { start: now, endFrequency: 68, gain: 0.078, type: "triangle" });
        this._tone(83, 0.42, { start: now + 0.055, endFrequency: 55, gain: 0.042, type: "sine" });
        break;
      case "explode":
        this._noise(0.24, { start: now, gain: 0.105, frequency: 920, type: "bandpass", q: 0.7 });
        this._noise(0.3, { start: now + 0.035, gain: 0.07, frequency: 270, type: "lowpass" });
        this._tone(62, 0.62, { start: now, endFrequency: 34, gain: 0.115, type: "sine" });
        this._metal(138, 0.55, { start: now + 0.018, gain: 0.075, brightness: 0.42 });
        break;
      case "charm":
        this._noise(0.2, { start: now, gain: 0.052, frequency: 1850, type: "bandpass", q: 0.9 });
        this._noise(0.28, { start: now + 0.07, gain: 0.026, frequency: 820, type: "highpass" });
        this._tone(740, 0.42, { start: now + 0.08, gain: 0.04, type: "sine" });
        this._tone(1110, 0.48, { start: now + 0.17, gain: 0.024, type: "sine" });
        break;
      case "seal":
        this._noise(0.11, { start: now, gain: 0.085, frequency: 310, type: "lowpass" });
        this._tone(68, 0.38, { start: now, endFrequency: 42, gain: 0.105, type: "sine" });
        this._metal(286, 0.48, { start: now + 0.055, gain: 0.048, brightness: 0.56 });
        break;
      case "reward":
        [392, 523.25, 659.25].forEach((frequency, index) => {
          this._tone(frequency, 0.42, {
            start: now + index * 0.095,
            gain: 0.043 - index * 0.004,
            type: "sine",
          });
        });
        break;
      case "result":
        this._tone(146.83, 1.1, { start: now, endFrequency: 141, gain: 0.066, type: "sine" });
        this._tone(293.66, 0.82, { start: now + 0.025, gain: 0.034, type: "sine" });
        this._tone(440, 0.7, { start: now + 0.05, gain: 0.02, type: "sine" });
        this._noise(0.08, { start: now, gain: 0.038, frequency: 360, type: "lowpass" });
        break;
      default:
        return false;
    }

    return true;
  }

  async startAmbient() {
    this.ambientRequested = true;
    if (!this.enabled || this.hidden) return false;
    const context = await this._ensureContext();
    if (!context || context.state !== "running") return false;
    this._startAmbientNodes();
    return Boolean(this.ambientGraph);
  }

  stopAmbient() {
    this.ambientRequested = false;
    this._stopAmbientNodes();
  }

  async handleVisibility(hidden) {
    this.hidden = Boolean(hidden);

    if (this.hidden) {
      this._stopAmbientNodes();
      if (this.context?.state === "running") {
        await this.context.suspend().catch(() => {});
      }
    }

    // 다시 보이게 된 직후에는 자동 재생하지 않는다. 다음 play(), toggle(),
    // setEnabled(true), startAmbient() 호출이 사용자 입력 안에서 resume를 시도한다.
    return !this.hidden;
  }

  // 이전 화면과의 짧은 전환 기간을 위한 호환 별칭이다.
  startMusic() {
    return this.startAmbient();
  }

  stopMusic() {
    this.stopAmbient();
  }

  setMood(mood) {
    this.mood = mood;
    if (!this.context || !this.ambientBus) return;
    const now = this.context.currentTime;
    const target = mood === "danger" ? 0.095 : mood === "ending" ? 0.065 : 0.08;
    this.ambientBus.gain.cancelScheduledValues(now);
    this.ambientBus.gain.setValueAtTime(this.ambientBus.gain.value, now);
    this.ambientBus.gain.linearRampToValueAtTime(target, now + 0.45);
  }

  async suspend() {
    this._stopAmbientNodes();
    if (this.context?.state === "running") await this.context.suspend().catch(() => {});
  }

  async _ensureContext() {
    if (!this.enabled || this.hidden) return null;

    if (!this.context || this.context.state === "closed") {
      const Context = audioContextClass();
      if (!Context) return null;

      this.context = new Context();
      this.master = this.context.createGain();
      this.ambientBus = this.context.createGain();
      this.sfxBus = this.context.createGain();
      this.compressor = this.context.createDynamicsCompressor();

      this.master.gain.value = 0.52;
      this.ambientBus.gain.value = 0.08;
      this.sfxBus.gain.value = 0.32;
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 20;
      this.compressor.ratio.value = 8;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.22;

      this.ambientBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(this.compressor);
      this.compressor.connect(this.context.destination);
      this.noiseBuffer = this._createNoiseBuffer(2);
    }

    if (this.context.state === "suspended") {
      await this.context.resume().catch(() => {});
    }

    return this.context.state === "running" ? this.context : null;
  }

  _createNoiseBuffer(seconds) {
    const frameCount = Math.max(1, Math.floor(this.context.sampleRate * seconds));
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;

    for (let index = 0; index < frameCount; index += 1) {
      const white = Math.random() * 2 - 1;
      previous = previous * 0.82 + white * 0.18;
      data[index] = previous;
    }

    return buffer;
  }

  _tone(frequency, duration, options = {}) {
    if (!this.context || !options.bus && !this.sfxBus) return;

    const start = options.start ?? this.context.currentTime;
    const bus = options.bus || this.sfxBus;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    const peak = Math.max(0.001, options.gain ?? 0.04);
    const attack = Math.min(options.attack ?? 0.012, duration * 0.35);

    oscillator.type = options.type || "triangle";
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
    if (options.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, options.endFrequency), start + duration);
    }
    if (options.detune) oscillator.detune.value = options.detune;

    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(peak, start + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    let tail = oscillator;
    let filter = null;
    if (options.filterFrequency) {
      filter = this.context.createBiquadFilter();
      filter.type = options.filterType || "lowpass";
      filter.frequency.value = options.filterFrequency;
      tail.connect(filter);
      tail = filter;
    }

    tail.connect(envelope);
    envelope.connect(bus);
    oscillator.onended = () => {
      safeDisconnect(oscillator);
      safeDisconnect(filter);
      safeDisconnect(envelope);
    };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.025);
  }

  _noise(duration, options = {}) {
    if (!this.context || !this.noiseBuffer) return;

    const start = options.start ?? this.context.currentTime;
    const bus = options.bus || this.sfxBus;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    const peak = Math.max(0.001, options.gain ?? 0.04);
    const attack = Math.min(0.008, duration * 0.2);
    const maxOffset = Math.max(0, this.noiseBuffer.duration - duration - 0.01);

    source.buffer = this.noiseBuffer;
    filter.type = options.type || "lowpass";
    filter.frequency.value = options.frequency || 700;
    filter.Q.value = options.q || 0.6;
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(peak, start + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(bus);
    source.onended = () => {
      safeDisconnect(source);
      safeDisconnect(filter);
      safeDisconnect(envelope);
    };
    source.start(start, Math.random() * maxOffset, duration);
  }

  _metal(baseFrequency, duration, options = {}) {
    const ratios = [1, 2.71, 4.07, 5.43];
    const weights = [1, 0.46, 0.24, 0.12];
    const brightness = options.brightness ?? 1;

    ratios.forEach((ratio, index) => {
      this._tone(baseFrequency * ratio, duration * (1 - index * 0.08), {
        start: options.start,
        gain: (options.gain ?? 0.05) * weights[index] * brightness,
        type: "sine",
        filterFrequency: 3200,
      });
    });
  }

  _startAmbientNodes() {
    if (!this.enabled || this.hidden || !this.context || this.context.state !== "running" || this.ambientGraph) return;

    const now = this.context.currentTime;
    const fire = this.context.createBufferSource();
    const fireFilter = this.context.createBiquadFilter();
    const fireGain = this.context.createGain();
    const droneLow = this.context.createOscillator();
    const droneLowGain = this.context.createGain();
    const droneHigh = this.context.createOscillator();
    const droneHighGain = this.context.createGain();
    const lfo = this.context.createOscillator();
    const lfoGain = this.context.createGain();

    fire.buffer = this.noiseBuffer;
    fire.loop = true;
    fireFilter.type = "lowpass";
    fireFilter.frequency.value = 540;
    fireFilter.Q.value = 0.5;
    fireGain.gain.value = 0.048;
    fire.connect(fireFilter);
    fireFilter.connect(fireGain);
    fireGain.connect(this.ambientBus);

    droneLow.type = "sine";
    droneLow.frequency.value = 48;
    droneLow.detune.value = -4;
    droneLowGain.gain.value = 0.012;
    droneLow.connect(droneLowGain);
    droneLowGain.connect(this.ambientBus);

    droneHigh.type = "triangle";
    droneHigh.frequency.value = 72;
    droneHigh.detune.value = 5;
    droneHighGain.gain.value = 0.005;
    droneHigh.connect(droneHighGain);
    droneHighGain.connect(this.ambientBus);

    lfo.type = "sine";
    lfo.frequency.value = 0.12;
    lfoGain.gain.value = 0.009;
    lfo.connect(lfoGain);
    lfoGain.connect(fireGain.gain);

    const sources = [fire, droneLow, droneHigh, lfo];
    const nodes = [fire, fireFilter, fireGain, droneLow, droneLowGain, droneHigh, droneHighGain, lfo, lfoGain];
    sources.forEach((source) => source.start(now));
    this.ambientGraph = { sources, nodes };

    this.ambientTimer = globalThis.setInterval(() => {
      if (!this.ambientGraph || !this.enabled || this.hidden || this.context?.state !== "running") return;
      if (Math.random() < 0.52) {
        this._noise(0.035, {
          gain: 0.016,
          frequency: 1250 + Math.random() * 900,
          type: "bandpass",
          q: 1.1,
          bus: this.ambientBus,
        });
      }
    }, 3200);
  }

  _stopAmbientNodes() {
    if (this.ambientTimer) globalThis.clearInterval(this.ambientTimer);
    this.ambientTimer = null;

    if (!this.ambientGraph) return;
    this.ambientGraph.sources.forEach(safeStop);
    this.ambientGraph.nodes.forEach(safeDisconnect);
    this.ambientGraph = null;
  }

  _duckAmbient(factor, duration) {
    if (!this.context || !this.ambientBus || !this.ambientGraph) return;
    const now = this.context.currentTime;
    const normal = this.mood === "danger" ? 0.095 : this.mood === "ending" ? 0.065 : 0.08;
    this.ambientBus.gain.cancelScheduledValues(now);
    this.ambientBus.gain.setValueAtTime(this.ambientBus.gain.value, now);
    this.ambientBus.gain.linearRampToValueAtTime(normal * factor, now + 0.025);
    this.ambientBus.gain.linearRampToValueAtTime(normal, now + duration);
  }
}
