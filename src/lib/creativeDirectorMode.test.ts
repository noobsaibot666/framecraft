import { describe, expect, it } from "vitest";
import {
  buildStrategyPrompt,
  formatStrategyForContext,
  isEmptyStrategy,
  parseCreativeStrategy,
  readStoredStrategy,
  EMPTY_STRATEGY,
  type CreativeStrategy,
} from "./creativeDirectorMode";
import type { Project } from "@/types";

const project: Project = {
  id: "proj",
  title: "Alpine Water Launch",
  client: "Glacier Co",
  status: "active",
  brief_text: "Launch the new glass bottle",
  production_goal: "12 hero images",
  category: "product",
  created_at: "t",
  updated_at: "t",
};

const strategy: CreativeStrategy = {
  campaign_idea: "Purity you can see through",
  concepts: ["Frozen light", "Source to table"],
  creative_directions: ["Nordic minimal", "Macro ice"],
  visual_aesthetics: "Cold daylight, glass and ice, negative space",
  brand_connection: "Glacier provenance",
  product_message: "Nothing added",
  audience: "Design-conscious urban buyers",
  execution_direction: "Stills first on GPT Image 2, 4:5 and 1:1",
};

describe("buildStrategyPrompt", () => {
  it("carries project facts and the user seed", () => {
    const prompt = buildStrategyPrompt(project, "premium but not sterile");
    expect(prompt).toContain("Alpine Water Launch");
    expect(prompt).toContain("Glacier Co");
    expect(prompt).toContain("Launch the new glass bottle");
    expect(prompt).toContain("premium but not sterile");
    expect(prompt).toContain("campaign_idea");
  });

  it("forbids generic agency filler", () => {
    expect(buildStrategyPrompt(project)).toContain("generic agency filler");
  });
});

describe("parseCreativeStrategy", () => {
  it("parses a complete strategy including fenced JSON", () => {
    const parsed = parseCreativeStrategy("```json\n" + JSON.stringify(strategy) + "\n```");
    expect(parsed).toEqual(strategy);
    expect(isEmptyStrategy(parsed)).toBe(false);
  });

  it("returns the empty strategy for garbage", () => {
    expect(parseCreativeStrategy("nope")).toEqual(EMPTY_STRATEGY);
    expect(isEmptyStrategy(parseCreativeStrategy("{}"))).toBe(true);
  });

  it("caps list fields at three entries", () => {
    const parsed = parseCreativeStrategy(JSON.stringify({ concepts: ["a", "b", "c", "d"] }));
    expect(parsed.concepts).toHaveLength(3);
  });
});

describe("readStoredStrategy", () => {
  it("round-trips a stored JSON string", () => {
    expect(readStoredStrategy(JSON.stringify(strategy))).toEqual(strategy);
  });

  it("returns null for absent or corrupt values", () => {
    expect(readStoredStrategy(undefined)).toBeNull();
    expect(readStoredStrategy("")).toBeNull();
    expect(readStoredStrategy("{broken")).toBeNull();
    expect(readStoredStrategy("{}")).toBeNull();
  });
});

describe("formatStrategyForContext", () => {
  it("emits every populated field as a labelled line", () => {
    const context = formatStrategyForContext(strategy);
    expect(context).toContain("Campaign idea: Purity you can see through");
    expect(context).toContain("Concepts: Frozen light | Source to table");
    expect(context).toContain("Audience: Design-conscious urban buyers");
    expect(context).toContain("Execution direction: Stills first on GPT Image 2");
  });

  it("returns empty for an empty strategy", () => {
    expect(formatStrategyForContext(EMPTY_STRATEGY)).toBe("");
  });
});
