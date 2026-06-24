import { describe, it, expect } from "vitest";
import {
  getResultDir,
  getRefDir,
  saveResultImage,
  saveReferenceImage,
  readImageAsDataUrl,
  toDisplaySrc,
  deleteResultFiles,
  deleteReferenceFiles,
} from "./fileStore";

// JSDOM canvas stub: getContext returns null — thumbnailFromDataUrl falls back to input
const JPEG_DATA_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARC";
const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("path helpers", () => {
  it("getResultDir appends results/ to base", () => {
    expect(getResultDir("/data/app/")).toBe("/data/app/results/");
  });

  it("getRefDir appends references/ to base", () => {
    expect(getRefDir("/data/app/")).toBe("/data/app/references/");
  });
});

describe("saveResultImage — dev mode (no Tauri)", () => {
  it("returns filePath = thumbPath = the original dataUrl", async () => {
    const result = await saveResultImage("abc123", JPEG_DATA_URL);
    expect(result.filePath).toBe(JPEG_DATA_URL);
    expect(result.thumbPath).toBe(JPEG_DATA_URL);
  });

  it("does not throw for PNG dataUrl", async () => {
    await expect(saveResultImage("abc123", PNG_DATA_URL)).resolves.toBeDefined();
  });
});

describe("saveReferenceImage — dev mode", () => {
  it("returns filePath = thumbPath = the original dataUrl", async () => {
    const result = await saveReferenceImage("ref456", JPEG_DATA_URL);
    expect(result.filePath).toBe(JPEG_DATA_URL);
    expect(result.thumbPath).toBe(JPEG_DATA_URL);
  });
});

describe("readImageAsDataUrl — dev mode", () => {
  it("returns data URLs unchanged", async () => {
    expect(await readImageAsDataUrl(JPEG_DATA_URL)).toBe(JPEG_DATA_URL);
    expect(await readImageAsDataUrl(PNG_DATA_URL)).toBe(PNG_DATA_URL);
  });

  it("returns absolute paths unchanged (not in Tauri)", async () => {
    const path = "/Users/alan/Library/Application Support/com.alan.framecraft/results/abc.jpg";
    expect(await readImageAsDataUrl(path)).toBe(path);
  });
});

describe("toDisplaySrc — dev mode", () => {
  it("returns undefined for undefined input", () => {
    expect(toDisplaySrc(undefined)).toBeUndefined();
  });

  it("returns data URLs unchanged", () => {
    expect(toDisplaySrc(JPEG_DATA_URL)).toBe(JPEG_DATA_URL);
  });

  it("returns undefined for file paths outside Tauri (no convertFileSrc)", () => {
    expect(toDisplaySrc("/some/path/file.jpg")).toBeUndefined();
  });
});

describe("deleteResultFiles — dev mode", () => {
  it("resolves without error when not in Tauri", async () => {
    await expect(deleteResultFiles("abc123")).resolves.toBeUndefined();
  });
});

describe("deleteReferenceFiles — dev mode", () => {
  it("resolves without error when not in Tauri", async () => {
    await expect(deleteReferenceFiles("ref456")).resolves.toBeUndefined();
  });
});
