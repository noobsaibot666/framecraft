import { beforeEach, describe, expect, it } from "vitest";
import {
  AI_KEY_ANTHROPIC,
  AI_KEY_DEEPSEEK,
  AI_KEY_OPENAI,
  getConnectedModels,
  pickAvailableModel,
  pickVisionModel,
} from "./aiConfig";
import { setDefaultAiModelId } from "./userPreferences";

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

describe("pickAvailableModel", () => {
  it("returns undefined when no provider is connected", () => {
    expect(pickAvailableModel()).toBeUndefined();
  });

  it("prefers OpenAI, then Anthropic, then DeepSeek when no standard model is set", () => {
    localStorage.setItem(AI_KEY_DEEPSEEK, "sk-deepseek-test");
    localStorage.setItem(AI_KEY_ANTHROPIC, "sk-ant-test");
    expect(pickAvailableModel()?.provider).toBe("anthropic");

    localStorage.setItem(AI_KEY_OPENAI, "sk-openai-test");
    expect(pickAvailableModel()?.provider).toBe("openai");
  });

  it("honors a saved standard-model preference over the default provider order", () => {
    localStorage.setItem(AI_KEY_OPENAI, "sk-openai-test");
    localStorage.setItem(AI_KEY_DEEPSEEK, "sk-deepseek-test");
    setDefaultAiModelId("deepseek-chat");

    expect(pickAvailableModel()?.id).toBe("deepseek-chat");
  });

  it("falls back to auto-pick when the preferred model's key is no longer connected", () => {
    localStorage.setItem(AI_KEY_OPENAI, "sk-openai-test");
    setDefaultAiModelId("deepseek-chat"); // no DeepSeek key saved

    expect(pickAvailableModel()?.provider).toBe("openai");
  });
});

describe("pickVisionModel", () => {
  it("honors DeepSeek as the saved standard model (included by explicit choice)", () => {
    localStorage.setItem(AI_KEY_DEEPSEEK, "sk-deepseek-test");
    localStorage.setItem(AI_KEY_ANTHROPIC, "sk-ant-test");
    setDefaultAiModelId("deepseek-chat");

    expect(pickVisionModel()?.provider).toBe("deepseek");
  });

  it("honors a saved vision-capable standard model", () => {
    localStorage.setItem(AI_KEY_ANTHROPIC, "sk-ant-test");
    localStorage.setItem(AI_KEY_OPENAI, "sk-openai-test");
    setDefaultAiModelId("gpt-4o");

    expect(pickVisionModel()?.id).toBe("gpt-4o");
  });
});

describe("getConnectedModels", () => {
  it("lists only models whose provider key passes format validation", () => {
    localStorage.setItem(AI_KEY_ANTHROPIC, "sk-ant-test");
    localStorage.setItem(AI_KEY_DEEPSEEK, "not-a-valid-format");

    const connected = getConnectedModels();
    expect(connected.every((m) => m.provider === "anthropic")).toBe(true);
    expect(connected.length).toBeGreaterThan(0);
  });
});
