import { describe, expect, it } from "vitest";
import { getCreativeHints } from "./cinemaCreativeHints";

describe("getCreativeHints", () => {
  it("returns default hints when no mood is set", () => {
    const groups = getCreativeHints(undefined);
    expect(groups.length).toBeGreaterThan(0);
  });

  it("matches a dramatic mood to slow-zoom / stillness hints", () => {
    const groups = getCreativeHints("dramatic");
    const allHints = groups.flatMap((g) => g.hints).join(" ").toLowerCase();
    expect(allHints).toContain("zoom");
  });

  it("matches an action mood to handheld / fast-cut hints", () => {
    const groups = getCreativeHints("Action");
    const allHints = groups.flatMap((g) => g.hints).join(" ").toLowerCase();
    expect(allHints).toContain("handheld");
  });

  it("falls back to default hints for an unrecognized mood", () => {
    const groups = getCreativeHints("some unrecognized mood word");
    expect(groups).toEqual(getCreativeHints(undefined));
  });
});
