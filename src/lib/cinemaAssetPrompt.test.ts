import { describe, expect, it } from "vitest";
import { draftAssetPrompt } from "./cinemaAssetPrompt";
import type { AIModel } from "./aiConfig";

const dummyModel: AIModel = { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic", tier: "balanced" };

describe("draftAssetPrompt validation", () => {
  it("rejects an empty instruction before calling the model", async () => {
    await expect(
      draftAssetPrompt(
        { folderKind: "character", folderName: "Characters", assetTitle: "Eduardo", instruction: "  ", provider: "midjourney" },
        dummyModel
      )
    ).rejects.toThrow(/describe what you want/i);
  });
});
