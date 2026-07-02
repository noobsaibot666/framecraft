import { describe, it, expect } from "vitest";
import { isVideoProvider, VIDEO_PROVIDERS } from "./providerCapabilities";

describe("isVideoProvider", () => {
  it("returns true for known video providers", () => {
    for (const p of VIDEO_PROVIDERS) {
      expect(isVideoProvider(p)).toBe(true);
    }
  });

  it("returns false for image providers", () => {
    expect(isVideoProvider("midjourney")).toBe(false);
    expect(isVideoProvider("dalle")).toBe(false);
    expect(isVideoProvider("stable_diffusion")).toBe(false);
    expect(isVideoProvider("nano_banana")).toBe(false);
  });

  it("returns false for undefined/empty provider", () => {
    expect(isVideoProvider(undefined)).toBe(false);
    expect(isVideoProvider("")).toBe(false);
  });
});
