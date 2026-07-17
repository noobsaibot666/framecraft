import { describe, expect, it } from "vitest";
import { mergeImagesSideBySide, MAX_MERGE_SOURCES, MIN_MERGE_SOURCES } from "./assetMerge";

describe("mergeImagesSideBySide validation", () => {
  it("rejects fewer than the minimum number of sources", async () => {
    await expect(mergeImagesSideBySide(["data:image/png;base64,x"])).rejects.toThrow(/2-3/);
  });

  it("rejects more than the maximum number of sources", async () => {
    const urls = Array.from({ length: MAX_MERGE_SOURCES + 1 }, () => "data:image/png;base64,x");
    await expect(mergeImagesSideBySide(urls)).rejects.toThrow(/2-3/);
  });

  it("exposes the supported range as constants", () => {
    expect(MIN_MERGE_SOURCES).toBe(2);
    expect(MAX_MERGE_SOURCES).toBe(3);
  });
});
