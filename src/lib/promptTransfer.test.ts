import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportPromptTransfer, parsePromptTransfer, type PromptTransferV2 } from "./promptTransfer";
import type { Prompt } from "@/types";

const executeTransaction = vi.fn<(statements: unknown[]) => Promise<{ rowsAffected?: number }[]>>();

beforeEach(() => {
  vi.resetModules();
  executeTransaction.mockReset();
  vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
  vi.doMock("./dbConnection", () => ({
    getFramecraftDb: async () => ({ executeTransaction }),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock("./dbConnection");
});

function makePrompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: "prompt-1",
    title: "Brand shoe campaign",
    provider: "midjourney",
    prompt_text: "editorial shoe product photo",
    description: "a description",
    category: "product",
    use_case: "paid social",
    avoidance_text: "no shadows",
    aspect_ratio: "16:9",
    model_version: "6.1",
    camera: "Sony A7IV",
    lens: "85mm",
    lighting: "natural",
    style_ref: "https://example.com/ref.jpg",
    character_ref: "char-ref",
    image_ref: "img-ref",
    parameters: { chaos: 20 },
    tags: ["shoe", "product"],
    rating: 5,
    ai_look_risk: 1,
    reuse_potential: 4,
    is_recipe: true,
    recipe_use_count: 3,
    is_winner: true,
    is_failed: false,
    notes: "great composition",
    best_use: "Instagram feed",
    risk_notes: "check model hands",
    version: 2,
    parent_id: "prompt-0",
    source_url: "https://cdn.example.com/ref",
    thumbnail_data: "data:image/jpeg;base64,/9j/",
    builder_state: '{"subject":"shoe"}',
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("exportPromptTransfer", () => {
  it("produces a v2 envelope with correct kind and version", () => {
    const result = exportPromptTransfer([]);
    expect(result.kind).toBe("framecraft.prompt-transfer");
    expect(result.version).toBe(2);
    expect(result.exported_at).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(result.prompts).toEqual([]);
  });

  it("exports all user-content fields symmetrically", () => {
    const prompt = makePrompt();
    const { prompts: [r] } = exportPromptTransfer([prompt]);
    expect(r.source_id).toBe("prompt-1");
    expect(r.parent_source_id).toBe("prompt-0");
    expect(r.title).toBe("Brand shoe campaign");
    expect(r.description).toBe("a description");
    expect(r.provider).toBe("midjourney");
    expect(r.category).toBe("product");
    expect(r.use_case).toBe("paid social");
    expect(r.prompt_text).toBe("editorial shoe product photo");
    expect(r.avoidance_text).toBe("no shadows");
    expect(r.aspect_ratio).toBe("16:9");
    expect(r.model_version).toBe("6.1");
    expect(r.camera).toBe("Sony A7IV");
    expect(r.lens).toBe("85mm");
    expect(r.lighting).toBe("natural");
    expect(r.style_ref).toBe("https://example.com/ref.jpg");
    expect(r.character_ref).toBe("char-ref");
    expect(r.image_ref).toBe("img-ref");
    expect(r.parameters).toEqual({ chaos: 20 });
    expect(r.tags).toEqual(["shoe", "product"]);
    expect(r.rating).toBe(5);
    expect(r.ai_look_risk).toBe(1);
    expect(r.reuse_potential).toBe(4);
    expect(r.is_recipe).toBe(true);
    expect(r.recipe_use_count).toBe(3);
    expect(r.is_winner).toBe(true);
    expect(r.is_failed).toBe(false);
    expect(r.notes).toBe("great composition");
    expect(r.best_use).toBe("Instagram feed");
    expect(r.risk_notes).toBe("check model hands");
    expect(r.source_url).toBe("https://cdn.example.com/ref");
    expect(r.thumbnail_data).toBe("data:image/jpeg;base64,/9j/");
    expect(r.builder_state).toBe('{"subject":"shoe"}');
  });

  it("omits undefined optional fields", () => {
    const prompt = makePrompt({ description: undefined, parent_id: undefined, failure_notes: undefined });
    const { prompts: [r] } = exportPromptTransfer([prompt]);
    expect(r.description).toBeUndefined();
    expect(r.parent_source_id).toBeUndefined();
    expect(r.failure_notes).toBeUndefined();
  });
});

describe("parsePromptTransfer", () => {
  it("accepts a valid v2 envelope", () => {
    const envelope: PromptTransferV2 = {
      kind: "framecraft.prompt-transfer",
      version: 2,
      exported_at: "2026-06-01T00:00:00.000Z",
      prompts: [],
    };
    expect(parsePromptTransfer(JSON.stringify(envelope))).toMatchObject({ version: 2, prompts: [] });
  });

  it("rejects malformed JSON", () => {
    expect(() => parsePromptTransfer("{not json")).toThrow(/not valid JSON/i);
  });

  it("rejects a non-object top level (array)", () => {
    expect(() => parsePromptTransfer("[1,2,3]")).toThrow(/not a JSON object/i);
  });

  it("rejects an unknown kind", () => {
    expect(() => parsePromptTransfer(JSON.stringify({
      kind: "framecraft.library-export",
      version: 2,
      exported_at: "2026-06-01T00:00:00.000Z",
      prompts: [],
    }))).toThrow(/unrecognized file kind/i);
  });

  it("rejects version 1", () => {
    expect(() => parsePromptTransfer(JSON.stringify({
      kind: "framecraft.prompt-transfer",
      version: 1,
      exported_at: "2026-06-01T00:00:00.000Z",
      prompts: [],
    }))).toThrow(/unsupported.*version.*1/i);
  });

  it("rejects a missing prompts array", () => {
    expect(() => parsePromptTransfer(JSON.stringify({
      kind: "framecraft.prompt-transfer",
      version: 2,
      exported_at: "2026-06-01T00:00:00.000Z",
    }))).toThrow(/missing a prompts array/i);
  });
});

describe("importPromptTransfer", () => {
  it("imports all prompts in one atomic call and returns the count", async () => {
    executeTransaction.mockResolvedValue([{ rowsAffected: 1 }, { rowsAffected: 1 }]);
    const { importPromptTransfer } = await import("./promptTransfer");

    const data = exportPromptTransfer([makePrompt({ id: "p1" }), makePrompt({ id: "p2", parent_id: undefined })]);
    const count = await importPromptTransfer(data);

    expect(count).toBe(2);
    expect(executeTransaction).toHaveBeenCalledTimes(1);
    expect((executeTransaction.mock.calls[0][0] as unknown[]).length).toBe(2);
  });

  it("remaps parent_source_id to the newly assigned row ID", async () => {
    executeTransaction.mockResolvedValue([{ rowsAffected: 1 }, { rowsAffected: 1 }]);
    const { importPromptTransfer } = await import("./promptTransfer");

    const parent = makePrompt({ id: "parent-orig", parent_id: undefined });
    const child = makePrompt({ id: "child-orig", parent_id: "parent-orig" });
    const data = exportPromptTransfer([parent, child]);

    await importPromptTransfer(data);

    const stmts = executeTransaction.mock.calls[0][0] as Array<{ bindValues: unknown[] }>;
    const parentNewId = stmts[0].bindValues[0] as string;
    const childParentId = stmts[1].bindValues[32] as string;
    expect(childParentId).toBe(parentNewId);
    expect(parentNewId).not.toBe("parent-orig");
  });

  it("assigns a new ID and never reuses the original source_id", async () => {
    executeTransaction.mockResolvedValue([{ rowsAffected: 1 }]);
    const { importPromptTransfer } = await import("./promptTransfer");

    const data = exportPromptTransfer([makePrompt({ id: "source-id" })]);
    await importPromptTransfer(data);

    const stmts = executeTransaction.mock.calls[0][0] as Array<{ bindValues: unknown[] }>;
    expect(stmts[0].bindValues[0]).not.toBe("source-id");
  });

  it("rolls back the entire batch when one insert fails", async () => {
    executeTransaction.mockRejectedValue(new Error("constraint violation"));
    const { importPromptTransfer } = await import("./promptTransfer");

    const data = exportPromptTransfer([makePrompt({ id: "p1" }), makePrompt({ id: "p2" })]);
    await expect(importPromptTransfer(data)).rejects.toThrow("constraint violation");
    expect(executeTransaction).toHaveBeenCalledTimes(1);
  });
});
