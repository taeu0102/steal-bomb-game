import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { DeathAudio } from '../lib/audio.ts';

test('music runs once, terminal scene preserves impact, mute and teardown release playback', async () => {
  const intervals = new Map();
  let nextId = 0;
  const timer = mock.method(globalThis, 'setInterval', (fn) => {
    const id = ++nextId;
    intervals.set(id, fn);
    return id;
  });
  const clear = mock.method(globalThis, 'clearInterval', (id) =>
    intervals.delete(id),
  );
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    linearRampToValueAtTime() {},
    cancelScheduledValues() {},
    setTargetAtTime() {},
  });
  let ctx;
  class Context {
    currentTime = 0;
    sampleRate = 48000;
    state = 'running';
    sources = [];
    destination = {};
    constructor() {
      ctx = this;
    }
    node() {
      return {
        connect() {},
        disconnect() {},
        gain: param(),
        frequency: param(),
        threshold: param(),
        knee: param(),
        ratio: param(),
        attack: param(),
        release: param(),
      };
    }
    createGain() {
      return this.node();
    }
    createDynamicsCompressor() {
      return this.node();
    }
    createBiquadFilter() {
      return this.node();
    }
    createBuffer(ch, length) {
      return { getChannelData: () => new Float32Array(length) };
    }
    source() {
      const s = {
        ...this.node(),
        started: false,
        cancelled: false,
        start() {
          this.started = true;
        },
        stop(at) {
          if (at === undefined) this.cancelled = true;
        },
      };
      this.sources.push(s);
      return s;
    }
    createOscillator() {
      return this.source();
    }
    createBufferSource() {
      return this.source();
    }
    async resume() {
      this.state = 'running';
    }
    async close() {
      this.state = 'closed';
    }
  }
  const oldWindow = globalThis.window,
    oldContext = globalThis.AudioContext;
  globalThis.window = {};
  globalThis.AudioContext = Context;
  const audio = new DeathAudio();
  try {
    audio.setScene('lobby', 0);
    assert.equal(intervals.size, 0);
    await audio.unlock();
    assert.equal(intervals.size, 1);
    assert.ok(ctx.sources.length >= 5);
    audio.setScene('open', 12);
    await audio.unlock();
    assert.equal(intervals.size, 1);
    const old = ctx.sources.length;
    audio.bomb();
    assert.equal(intervals.size, 0);
    assert.ok(ctx.sources.length > old);
    const impact = ctx.sources.slice(old);
    audio.setScene('result', 12);
    assert.ok(impact.every((s) => !s.cancelled));
    audio.setEnabled(false);
    assert.ok(impact.every((s) => s.cancelled));
    const muted = ctx.sources.length;
    audio.tap();
    assert.equal(ctx.sources.length, muted);
    audio.setScene('open', 5);
    audio.setEnabled(true);
    assert.equal(intervals.size, 1);
    audio.setScene('silent', 5);
    assert.equal(intervals.size, 0);
    assert.ok(ctx.sources.every((s) => s.cancelled));
    audio.setScene('open', 5);
    assert.equal(intervals.size, 1);
    audio.stop();
    assert.equal(intervals.size, 0);
    assert.equal(ctx.state, 'closed');
  } finally {
    audio.stop();
    timer.mock.restore();
    clear.mock.restore();
    globalThis.window = oldWindow;
    globalThis.AudioContext = oldContext;
  }
});
