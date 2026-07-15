import { describe, it, expect, vi } from "vitest";
import { correlateRiskPatterns, getPatternFailureCorrelation } from "./riskCalibration";
import type { AvoidancePattern } from "@/types";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./dbConnection", () => ({ getFramecraftDb: mocks.getDb }));

function pattern(overrides: Partial<AvoidancePattern> = {}): AvoidancePattern {
  return {
    id: "p1",
    artifact_type: "bad_hands",
    label: "Extra fingers",
    category: "anatomy",
    severity: "high",
    is_builtin: true,
    ...overrides,
  };
}

describe("correlateRiskPatterns", () => {
  it("reports a pattern with a higher-than-baseline failure rate when sample size is met", () => {
    const patterns = [pattern()];
    const prompts = [
      { id: "a", prompt_text: "close-up of hands gripping a mug" },
      { id: "b", prompt_text: "hands holding a coffee cup" },
      { id: "c", prompt_text: "hands reaching for keys" },
    ];
    const stats = new Map([
      ["a", { total: 2, failed: 2 }],
      ["b", { total: 2, failed: 1 }],
      ["c", { total: 2, failed: 1 }],
    ]);

    const result = correlateRiskPatterns(prompts, stats, patterns, 0.2);

    expect(result).toHaveLength(1);
    expect(result[0].pattern_id).toBe("p1");
    expect(result[0].triggered_count).toBe(6);
    expect(result[0].triggered_failure_rate).toBeCloseTo(4 / 6, 2);
    expect(result[0].baseline_failure_rate).toBe(0.2);
    expect(result[0].lift).toBeGreaterThan(1);
  });

  it("omits a pattern below the minimum sample size", () => {
    const patterns = [pattern()];
    const prompts = [{ id: "a", prompt_text: "hands holding a mug" }];
    const stats = new Map([["a", { total: 2, failed: 2 }]]);

    const result = correlateRiskPatterns(prompts, stats, patterns, 0.2);

    expect(result).toHaveLength(0);
  });

  it("omits a pattern that never triggers on any prompt", () => {
    const patterns = [pattern({ artifact_type: "impossible_architecture", label: "Warped hallway" })];
    const prompts = [
      { id: "a", prompt_text: "a bowl of fruit on a table" },
      { id: "b", prompt_text: "a red bicycle in the rain" },
    ];
    const stats = new Map([
      ["a", { total: 3, failed: 1 }],
      ["b", { total: 3, failed: 1 }],
    ]);

    const result = correlateRiskPatterns(prompts, stats, patterns, 0.2);

    expect(result).toHaveLength(0);
  });

  it("skips prompts with no result stats", () => {
    const patterns = [pattern()];
    const prompts = [{ id: "unscored", prompt_text: "hands holding a mug" }];
    const stats = new Map<string, { total: number; failed: number }>();

    const result = correlateRiskPatterns(prompts, stats, patterns, 0.2);

    expect(result).toHaveLength(0);
  });

  it("sorts by lift descending", () => {
    const patterns = [
      pattern({ id: "low-lift", artifact_type: "bad_hands", label: "Extra fingers" }),
      pattern({ id: "high-lift", artifact_type: "impossible_architecture", label: "Warped hallway" }),
    ];
    const prompts = [
      { id: "a", prompt_text: "hands holding a mug" },
      { id: "b", prompt_text: "hands reaching for keys" },
      { id: "c", prompt_text: "hands gripping a cup" },
      { id: "d", prompt_text: "a corridor staircase interior" },
      { id: "e", prompt_text: "an atrium hallway facade" },
      { id: "f", prompt_text: "a building structure ceiling" },
    ];
    const stats = new Map([
      ["a", { total: 2, failed: 1 }],
      ["b", { total: 2, failed: 1 }],
      ["c", { total: 2, failed: 1 }],
      ["d", { total: 2, failed: 2 }],
      ["e", { total: 2, failed: 2 }],
      ["f", { total: 2, failed: 2 }],
    ]);

    const result = correlateRiskPatterns(prompts, stats, patterns, 0.3);

    expect(result[0].pattern_id).toBe("high-lift");
    expect(result[0].lift).toBeGreaterThan(result[1].lift);
  });

  it("reports zero lift when baseline failure rate is zero", () => {
    const patterns = [pattern()];
    const prompts = [
      { id: "a", prompt_text: "hands holding a mug" },
      { id: "b", prompt_text: "hands reaching for keys" },
    ];
    const stats = new Map([
      ["a", { total: 2, failed: 0 }],
      ["b", { total: 2, failed: 0 }],
    ]);

    const result = correlateRiskPatterns(prompts, stats, patterns, 0);

    expect(result).toHaveLength(1);
    expect(result[0].lift).toBe(0);
  });
});

describe("getPatternFailureCorrelation (dev mode)", () => {
  it("resolves to an empty array without touching the db", async () => {
    await expect(getPatternFailureCorrelation()).resolves.toEqual([]);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
});
