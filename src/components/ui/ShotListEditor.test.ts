import { describe, expect, it } from "vitest";
import { formatShotsForAssembly, type Shot } from "./ShotListEditor";

describe("formatShotsForAssembly", () => {
  it("returns empty string for no shots", () => {
    expect(formatShotsForAssembly([])).toBe("");
  });

  it("skips shots with empty/whitespace-only text", () => {
    const shots: Shot[] = [
      { id: "a", text: "  " },
      { id: "b", text: "the hero enters the frame" },
      { id: "c", text: "" },
    ];
    expect(formatShotsForAssembly(shots)).toBe("Shot 1: the hero enters the frame");
  });

  it("numbers filled shots in order, renumbering around skipped empties", () => {
    const shots: Shot[] = [
      { id: "a", text: "wide establishing shot" },
      { id: "b", text: "" },
      { id: "c", text: "close-up on hands" },
    ];
    expect(formatShotsForAssembly(shots)).toBe("Shot 1: wide establishing shot. Shot 2: close-up on hands");
  });

  it("trims whitespace from each shot's text", () => {
    const shots: Shot[] = [{ id: "a", text: "  slow push in  " }];
    expect(formatShotsForAssembly(shots)).toBe("Shot 1: slow push in");
  });
});
