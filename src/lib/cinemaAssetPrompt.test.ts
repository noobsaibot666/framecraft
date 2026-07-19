import { describe, expect, it, vi } from "vitest";
import type { AIModel } from "./aiConfig";

const dummyModel: AIModel = { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic", tier: "balanced" };

describe("draftAssetPrompt validation", () => {
  it("rejects an empty instruction before calling the model", async () => {
    const { draftAssetPrompt } = await import("./cinemaAssetPrompt");
    await expect(
      draftAssetPrompt(
        { folderKind: "character", folderName: "Characters", assetTitle: "Eduardo", instruction: "  ", provider: "midjourney" },
        dummyModel
      )
    ).rejects.toThrow(/describe what you want/i);
  });
});

describe("draftAssetPrompt bypassContext", () => {
  // Real bug this guards: the script excerpt / folder guidance kept leaking
  // into what was meant to be a literal, user-typed instruction — bypassContext
  // strips everything except the raw instruction from the AI request.
  it("sends only the raw instruction when bypassContext is true, and the full context otherwise", async () => {
    vi.resetModules();
    const chatComplete = vi.fn().mockResolvedValue('{"prompt": "a plain result", "parameters": {}}');
    vi.doMock("./aiClient", () => ({ chatComplete }));
    const { draftAssetPrompt } = await import("./cinemaAssetPrompt");

    await draftAssetPrompt(
      {
        folderKind: "location",
        folderName: "Locations",
        folderDescription: "A misty forest clearing",
        scriptExcerpt: "INT. FOREST - NIGHT\nShe runs through the trees.",
        assetTitle: "Forest Clearing",
        instruction: "wide shot, moody lighting",
        provider: "midjourney",
        bypassContext: true,
      },
      dummyModel
    );

    expect(chatComplete).toHaveBeenCalledTimes(1);
    const call = chatComplete.mock.calls[0][1] as { user: string };
    expect(call.user).toBe("User request: wide shot, moody lighting");
    expect(call.user).not.toContain("FOREST");
    expect(call.user).not.toContain("misty forest clearing");

    chatComplete.mockClear();
    await draftAssetPrompt(
      {
        folderKind: "location",
        folderName: "Locations",
        folderDescription: "A misty forest clearing",
        scriptExcerpt: "INT. FOREST - NIGHT\nShe runs through the trees.",
        assetTitle: "Forest Clearing",
        instruction: "wide shot, moody lighting",
        provider: "midjourney",
        bypassContext: false,
      },
      dummyModel
    );
    const fullCall = chatComplete.mock.calls[0][1] as { user: string };
    expect(fullCall.user).toContain("FOREST");
    expect(fullCall.user).toContain("misty forest clearing");

    vi.doUnmock("./aiClient");
  });
});
