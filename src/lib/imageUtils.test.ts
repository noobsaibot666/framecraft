import { describe, expect, it } from "vitest";
import { computeAspectRatioLabel, fileToDataUrl, validateImageFile } from "./imageUtils";

describe("fileToDataUrl", () => {
  it("serializes a File into a persistent data URL", async () => {
    const file = new File(["hello"], "result.txt", { type: "text/plain" });

    await expect(fileToDataUrl(file)).resolves.toBe("data:text/plain;base64,aGVsbG8=");
  });
});

describe("validateImageFile", () => {
  const dimensions = async () => ({ width: 1920, height: 1080 });

  it("accepts supported, bounded images", async () => {
    const file = new File([new Uint8Array(100)], "image.webp", { type: "image/webp" });
    await expect(validateImageFile(file, {}, dimensions)).resolves.toEqual({ width: 1920, height: 1080 });
  });

  it("rejects unsupported MIME types and empty or oversized files", async () => {
    await expect(validateImageFile(new File(["x"], "x.gif", { type: "image/gif" }), {}, dimensions)).rejects.toThrow("JPEG, PNG, or WebP");
    await expect(validateImageFile(new File([], "x.jpg", { type: "image/jpeg" }), {}, dimensions)).rejects.toThrow("empty");
    await expect(validateImageFile(new File([new Uint8Array(11)], "x.jpg", { type: "image/jpeg" }), { maxBytes: 10 }, dimensions)).rejects.toThrow("10 B");
  });

  it("rejects invalid, over-dimensioned, and over-pixel images", async () => {
    const file = new File(["x"], "x.png", { type: "image/png" });
    await expect(validateImageFile(file, {}, async () => ({ width: 0, height: 10 }))).rejects.toThrow("dimensions");
    await expect(validateImageFile(file, { maxDimension: 12_000 }, async () => ({ width: 12_001, height: 10 }))).rejects.toThrow("12,000");
    await expect(validateImageFile(file, { maxPixels: 40_000_000 }, async () => ({ width: 10_000, height: 5_000 }))).rejects.toThrow("40 megapixels");
  });

  it("normalizes image decoder failures", async () => {
    const file = new File(["x"], "x.png", { type: "image/png" });
    await expect(validateImageFile(file, {}, async () => { throw new Error("browser-specific failure"); })).rejects.toThrow("could not be decoded");
  });
});

describe("computeAspectRatioLabel", () => {
  it("snaps exact common ratios to their label", () => {
    expect(computeAspectRatioLabel(1920, 1080)).toBe("16:9");
    expect(computeAspectRatioLabel(1080, 1920)).toBe("9:16");
    expect(computeAspectRatioLabel(1000, 1000)).toBe("1:1");
  });

  it("snaps near-matches within tolerance", () => {
    expect(computeAspectRatioLabel(1024, 585)).toBe("16:9");
  });

  it("falls back to a raw decimal ratio when nothing common matches", () => {
    expect(computeAspectRatioLabel(1000, 337)).toBe("2.97:1");
  });

  it("returns an empty string for invalid dimensions", () => {
    expect(computeAspectRatioLabel(0, 100)).toBe("");
    expect(computeAspectRatioLabel(100, 0)).toBe("");
  });
});
