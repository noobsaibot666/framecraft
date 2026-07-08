import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  getPreferences,
  resetPreferences,
  setDefaultAiModelId,
  setDefaultAspectRatio,
  setDefaultCategory,
  setDefaultProvider,
} from "./userPreferences";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    },
  });
});

describe("userPreferences", () => {
  it("returns defaults when nothing is stored", () => {
    const prefs = getPreferences();
    expect(prefs.defaultProvider).toBe(DEFAULT_PREFERENCES.defaultProvider);
    expect(prefs.defaultAspectRatio).toBe("");
    expect(prefs.defaultCategory).toBe("");
  });

  it("persists default provider", () => {
    setDefaultProvider("flux");
    expect(getPreferences().defaultProvider).toBe("flux");
  });

  it("falls back to midjourney when provider reset", () => {
    setDefaultProvider("midjourney");
    resetPreferences();
    expect(getPreferences().defaultProvider).toBe("midjourney");
  });

  it("persists default aspect ratio", () => {
    setDefaultAspectRatio("16:9");
    expect(getPreferences().defaultAspectRatio).toBe("16:9");
    setDefaultAspectRatio("");
    expect(getPreferences().defaultAspectRatio).toBe("");
  });

  it("persists default category", () => {
    setDefaultCategory("advertising");
    expect(getPreferences().defaultCategory).toBe("advertising");
  });

  it("resets all preferences to defaults", () => {
    setDefaultProvider("flux");
    setDefaultAspectRatio("9:16");
    setDefaultCategory("fashion");
    setDefaultAiModelId("deepseek-chat");
    resetPreferences();
    const prefs = getPreferences();
    expect(prefs.defaultProvider).toBe(DEFAULT_PREFERENCES.defaultProvider);
    expect(prefs.defaultAspectRatio).toBe("");
    expect(prefs.defaultCategory).toBe("");
    expect(prefs.defaultAiModelId).toBe("");
  });

  it("persists the standard AI model preference", () => {
    expect(getPreferences().defaultAiModelId).toBe("");
    setDefaultAiModelId("deepseek-chat");
    expect(getPreferences().defaultAiModelId).toBe("deepseek-chat");
    setDefaultAiModelId("");
    expect(getPreferences().defaultAiModelId).toBe("");
  });
});
