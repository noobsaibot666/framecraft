import { describe, expect, it } from "vitest";
import { APP_MENU_ITEMS, SUPPORTED_CREATIVE_PROVIDERS, SUPPORTED_SYSTEM_PROVIDERS } from "./appInfo";

describe("appInfo", () => {
  it("defines the native app menu entries", () => {
    expect(APP_MENU_ITEMS.map((item) => item.id)).toEqual(["preferences", "about"]);
    expect(APP_MENU_ITEMS.map((item) => item.label)).toEqual(["Preferences", "About Framecraft"]);
  });

  it("lists supported creative and system providers for About", () => {
    expect(SUPPORTED_CREATIVE_PROVIDERS).toEqual([
      "Midjourney",
      "DALL-E",
      "Stable Diffusion",
      "Adobe Firefly",
      "Ideogram",
      "Flux",
      "Nano Banana Pro",
      "GPT Image 2",
      "Seedance",
      "Kling",
      "Runway",
      "Higgsfield",
      "Other",
    ]);
    expect(SUPPORTED_SYSTEM_PROVIDERS).toEqual(["Anthropic", "OpenAI"]);
  });
});
