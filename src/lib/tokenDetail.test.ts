import { describe, expect, it } from "vitest";
import { getTokenById, getPromptsUsingToken, getTokenCombos, getTokenStats } from "./tokenDetail";

describe("getTokenById (dev mode)", () => {
  it("returns null in dev/test mode", async () => {
    await expect(getTokenById("any-id")).resolves.toBeNull();
  });

  it("does not throw for unknown id", async () => {
    await expect(getTokenById("unknown")).resolves.toBeNull();
  });
});

describe("getPromptsUsingToken (dev mode)", () => {
  it("returns empty array in dev/test mode", async () => {
    await expect(getPromptsUsingToken("any-id")).resolves.toEqual([]);
  });
});

describe("getTokenCombos (dev mode)", () => {
  it("returns empty array in dev/test mode", async () => {
    await expect(getTokenCombos("any-id")).resolves.toEqual([]);
  });
});

describe("getTokenStats (dev mode)", () => {
  it("returns zero stats in dev/test mode", async () => {
    const stats = await getTokenStats("any-id");
    expect(stats.use_count).toBe(0);
    expect(stats.winner_count).toBe(0);
    expect(stats.total_prompt_count).toBe(0);
    expect(stats.win_rate).toBe(0);
    expect(stats.avg_rating).toBe(0);
  });
});
