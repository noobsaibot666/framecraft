import { afterEach, describe, it, expect, vi } from "vitest";
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

afterEach(() => {
  vi.resetModules();
});

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

  it("uses Tauri internals synchronously when available", async () => {
    vi.stubGlobal("window", {
      __TAURI_INTERNALS__: {
        convertFileSrc: (path: string, protocol = "asset") => `${protocol}://localhost/${encodeURIComponent(path)}`,
      },
    });
    const { toDisplaySrc: tauriToDisplaySrc } = await import("./fileStore");

    expect(tauriToDisplaySrc("/Users/alan/image.jpg")).toBe("asset://localhost/%2FUsers%2Falan%2Fimage.jpg");

    vi.unstubAllGlobals();
  });

  it("does not expose raw absolute paths as image src values", async () => {
    vi.stubGlobal("window", {});
    const { imageDisplaySrc: importedImageDisplaySrc } = await import("./fileStore");

    expect(importedImageDisplaySrc("/Users/alan/image.jpg")).toBeUndefined();
    expect(importedImageDisplaySrc(JPEG_DATA_URL)).toBe(JPEG_DATA_URL);

    vi.unstubAllGlobals();
  });

  it("returns converted asset URLs for absolute paths when Tauri conversion is available", async () => {
    vi.stubGlobal("window", {
      __TAURI_INTERNALS__: {
        convertFileSrc: (path: string, protocol = "asset") => `${protocol}://localhost/${encodeURIComponent(path)}`,
      },
    });
    const { imageDisplaySrc: tauriImageDisplaySrc } = await import("./fileStore");

    expect(tauriImageDisplaySrc("/Users/alan/image.jpg")).toBe("asset://localhost/%2FUsers%2Falan%2Fimage.jpg");

    vi.unstubAllGlobals();
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
