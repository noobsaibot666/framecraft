import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDirectionProjectFields,
  callDirectionModel,
  parseCreativeDirections,
} from "./creativeDirectionGeneration";
import { AI_KEY_DEEPSEEK, AI_MODELS } from "./aiConfig";
import type { CreativeDirection } from "@/types";

const validDirection = {
  title: "Material Honesty",
  campaign_idea: "Reveal quality through tactile details.",
  rationale: "The product earns trust when its construction is visible.",
  visual_aesthetic: "Macro material studies with restrained studio light.",
  brand_connection: "Translates precision into visual proof.",
  product_message: "Built with intention.",
  tone: "Quiet confidence",
  prompt_direction: "Prioritize real texture, controlled highlights, and optical depth.",
};

describe("parseCreativeDirections", () => {
  it("parses exactly three complete direction objects", () => {
    const parsed = parseCreativeDirections(JSON.stringify({
      directions: [
        validDirection,
        { ...validDirection, title: "Human Momentum" },
        { ...validDirection, title: "Designed Silence" },
      ],
    }));

    expect(parsed).toHaveLength(3);
    expect(parsed[1].title).toBe("Human Momentum");
    expect(parsed[0].prompt_direction).toContain("real texture");
  });

  it("rejects incomplete or incorrectly sized responses", () => {
    expect(() => parseCreativeDirections(JSON.stringify({ directions: [validDirection] }))).toThrow("three");
    expect(() => parseCreativeDirections(JSON.stringify({
      directions: [validDirection, validDirection, { ...validDirection, tone: "" }],
    }))).toThrow("tone");
  });

  it("accepts a custom expected count for improvement runs", () => {
    const two = parseCreativeDirections(
      JSON.stringify({ directions: [validDirection, { ...validDirection, title: "Second" }] }),
      2
    );
    expect(two).toHaveLength(2);
    expect(() => parseCreativeDirections(JSON.stringify({ directions: [validDirection] }), 2)).toThrow("two");
  });
});

describe("buildDirectionProjectFields", () => {
  it("assembles Craft-facing project fields without unrelated project data", () => {
    const direction: CreativeDirection = {
      id: "direction-1",
      project_id: "project-1",
      ...validDirection,
      is_selected: true,
      created_at: "2026-06-27T10:00:00.000Z",
      updated_at: "2026-06-27T10:00:00.000Z",
    };

    const fields = buildDirectionProjectFields(direction);
    expect(fields.visual_direction).toContain("Material Honesty");
    expect(fields.visual_direction).toContain("Quiet confidence");
    expect(fields.visual_direction).toContain("controlled highlights");
    expect(fields.creative_goals).toContain("Reveal quality through tactile details.");
    expect(fields.creative_goals).toContain("Built with intention.");
    expect(Object.keys(fields)).toEqual(["visual_direction", "creative_goals", "constraints"]);
  });
});

describe("callDirectionModel provider routing", () => {
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
    vi.restoreAllMocks();
  });

  it("routes DeepSeek models to the DeepSeek API, not OpenAI", async () => {
    localStorage.setItem(AI_KEY_DEEPSEEK, "sk-test-deepseek-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 })
    );

    const deepseekModel = AI_MODELS.find((m) => m.provider === "deepseek")!;
    await callDirectionModel(deepseekModel, "prompt");

    expect(fetchMock).toHaveBeenCalledWith("https://api.deepseek.com/chat/completions", expect.anything());
  });
});
