import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSettings, loadSettings, saveSettings } from "./storage";

const SETTINGS_KEY = "maeum-seed:settings:v1";

describe("이야기 설정 저장 호환", () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("자동 낭독은 기본으로 꺼져 있다", () => {
    expect(defaultSettings).toEqual({
      captions: true,
      muted: false,
      narration: false,
    });
    expect(loadSettings()).toEqual(defaultSettings);
  });

  it("기존 저장값에는 자동 낭독 꺼짐을 보완한다", () => {
    values.set(SETTINGS_KEY, JSON.stringify({ captions: false, muted: true }));
    expect(loadSettings()).toEqual({
      captions: false,
      muted: true,
      narration: false,
    });
  });

  it("자동 낭독 설정을 다른 소리 설정과 별도로 저장한다", () => {
    saveSettings({ captions: true, muted: true, narration: true });
    expect(loadSettings()).toEqual({
      captions: true,
      muted: true,
      narration: true,
    });
  });
});
