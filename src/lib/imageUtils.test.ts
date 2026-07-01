import { describe, expect, it } from "vitest";
import { validateImageFile, MAX_UPLOAD_BYTES, fileToDataUrl } from "./imageUtils";

function fakeFile(name: string, type: string, size: number): File {
  const f = new File([new Uint8Array(0)], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

describe("fileToDataUrl", () => {
  it("serializes an image File into a persistent data URL", async () => {
    const file = new File(["hello"], "result.png", { type: "image/png" });
    await expect(fileToDataUrl(file)).resolves.toBe("data:image/png;base64,aGVsbG8=");
  });

  it("throws before reading when the file is invalid", async () => {
    await expect(
      fileToDataUrl(fakeFile("big.jpg", "image/jpeg", MAX_UPLOAD_BYTES + 1))
    ).rejects.toThrow(/too large/i);
  });
});

describe("validateImageFile", () => {
  it("accepts a normal JPEG under the limit", () => {
    expect(validateImageFile(fakeFile("a.jpg", "image/jpeg", 1024))).toBeNull();
  });

  it("accepts PNG, WEBP, GIF, AVIF", () => {
    expect(validateImageFile(fakeFile("a.png", "image/png", 1024))).toBeNull();
    expect(validateImageFile(fakeFile("a.webp", "image/webp", 1024))).toBeNull();
    expect(validateImageFile(fakeFile("a.gif", "image/gif", 1024))).toBeNull();
    expect(validateImageFile(fakeFile("a.avif", "image/avif", 1024))).toBeNull();
  });

  it("rejects a non-image type", () => {
    expect(validateImageFile(fakeFile("doc.pdf", "application/pdf", 1024))).toMatch(/unsupported/i);
  });

  it("rejects an unsupported image format", () => {
    expect(validateImageFile(fakeFile("x.bmp", "image/bmp", 1024))).toMatch(/unsupported image format/i);
  });

  it("rejects files over the size limit", () => {
    expect(validateImageFile(fakeFile("big.jpg", "image/jpeg", MAX_UPLOAD_BYTES + 1))).toMatch(/too large/i);
  });

  it("respects a custom maxBytes", () => {
    expect(validateImageFile(fakeFile("a.jpg", "image/jpeg", 2000), 1000)).toMatch(/too large/i);
  });

  it("falls back to extension when type is empty (drag-drop/paste)", () => {
    expect(validateImageFile(fakeFile("photo.png", "", 1024))).toBeNull();
    expect(validateImageFile(fakeFile("notes.txt", "", 1024))).toMatch(/unsupported/i);
  });
});
