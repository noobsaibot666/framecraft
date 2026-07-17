import { describe, expect, it } from "vitest";
import { parseTransitionSuggestions } from "./cinemaShotGeneration";

describe("parseTransitionSuggestions", () => {
  it("parses a valid transitions JSON payload", () => {
    const raw = JSON.stringify({
      transitions: [
        { option: "Whip pan", rationale: "Matches the scene's fast energy" },
        { option: "Hard cut", rationale: "Keeps the tension unbroken" },
      ],
    });
    expect(parseTransitionSuggestions(raw)).toEqual([
      { option: "Whip pan", rationale: "Matches the scene's fast energy" },
      { option: "Hard cut", rationale: "Keeps the tension unbroken" },
    ]);
  });

  it("strips markdown code fences before parsing", () => {
    const raw = "```json\n" + JSON.stringify({ transitions: [{ option: "Dissolve", rationale: "Softens the mood shift" }] }) + "\n```";
    expect(parseTransitionSuggestions(raw)).toEqual([{ option: "Dissolve", rationale: "Softens the mood shift" }]);
  });

  it("throws when the transitions array is missing or empty", () => {
    expect(() => parseTransitionSuggestions(JSON.stringify({ nope: true }))).toThrow(/transitions array/i);
    expect(() => parseTransitionSuggestions(JSON.stringify({ transitions: [] }))).toThrow(/transitions array/i);
  });

  it("filters out entries with no option text", () => {
    const raw = JSON.stringify({ transitions: [{ rationale: "no option here" }, { option: "Cut", rationale: "ok" }] });
    expect(parseTransitionSuggestions(raw)).toEqual([{ option: "Cut", rationale: "ok" }]);
  });
});
