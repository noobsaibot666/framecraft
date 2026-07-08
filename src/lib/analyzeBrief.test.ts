import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeBrief, validateBriefContent } from "./analyzeBrief";
import type { AIModel } from "./aiConfig";

const anthropicModel: AIModel = { id: "claude-test", label: "Claude Test", provider: "anthropic", tier: "fast" };
const openAiModel: AIModel = { id: "gpt-test", label: "GPT Test", provider: "openai", tier: "fast" };
const deepseekModel: AIModel = { id: "deepseek-test", label: "DeepSeek Test", provider: "deepseek", tier: "fast" };

const briefPayload = {
  summary: "Launch a premium product campaign.",
  production_goal: "Create a premium hero visual.",
  creative_direction: "Minimal studio direction.",
  tone: "premium minimal",
  key_elements: ["product", "studio"],
  required_deliverables: ["hero visual"],
  key_constraints: [],
  risk_areas: ["fake reflections"],
  prompts: [
    {
      title: "Premium Hero",
      prompt: "premium product hero, studio light --ar 16:9",
      use_case: "hero",
      tags: ["product"],
      aspect_ratio: "16:9",
    },
  ],
  suggested_recipes: [],
};

describe("analyzeBrief", () => {
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

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("rejects OpenAI PDF analysis before making a provider request", async () => {
    localStorage.setItem("fc_openai_key", "sk-test");
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(analyzeBrief({ type: "pdf", base64: "abc" }, openAiModel)).rejects.toThrow(
      "PDF upload requires an Anthropic model"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates text input before provider requests", () => {
    expect(validateBriefContent({ type: "text", text: "  " })).toEqual({
      valid: false,
      message: "Paste brief text or attach a PDF before analyzing.",
    });
  });

  it("uses normalized provider errors from the shared AI client", async () => {
    localStorage.setItem("fc_anthropic_key", "sk-ant-test");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Bad key" } }), { status: 401 })
    );

    await expect(analyzeBrief({ type: "text", text: "Brief text" }, anthropicModel)).rejects.toThrow(
      "Anthropic request failed (401): Bad key"
    );
  });

  it("parses successful OpenAI brief responses", async () => {
    localStorage.setItem("fc_openai_key", "sk-test");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(briefPayload) } }] }), { status: 200 })
    );

    const result = await analyzeBrief({ type: "text", text: "Brief text" }, openAiModel);

    expect(result.summary).toBe("Launch a premium product campaign.");
    expect(result.prompts[0].title).toBe("Premium Hero");
  });

  it("rejects DeepSeek PDF analysis before making a provider request", async () => {
    localStorage.setItem("fc_deepseek_key", "sk-test");
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(analyzeBrief({ type: "pdf", base64: "abc" }, deepseekModel)).rejects.toThrow(
      "PDF upload requires an Anthropic model"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("routes DeepSeek text analysis to the DeepSeek API, not OpenAI", async () => {
    localStorage.setItem("fc_deepseek_key", "sk-test");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(briefPayload) } }] }), { status: 200 })
    );

    await analyzeBrief({ type: "text", text: "Brief text" }, deepseekModel);

    expect(fetchMock).toHaveBeenCalledWith("https://api.deepseek.com/chat/completions", expect.anything());
  });
});
