import { describe, expect, it, vi } from "vitest";
import { buildManualPromptTransfer, runManualBatchImport, type ManualBatchItem } from "./manualBatchImport";

const items: ManualBatchItem[] = [
  { title: "One", prompt_text: "studio shoe --ar 4:5", tags: ["product"] },
  { title: "Two", prompt_text: "portrait with natural skin", notes: "keep" },
];

describe("manual batch import", () => {
  it("prepares a versioned enriched transfer before writing", () => {
    const transfer = buildManualPromptTransfer(items, {
      id: (index) => `source-${index}`,
      now: () => "2026-07-01T12:00:00.000Z",
    });
    expect(transfer.kind).toBe("framecraft.prompt-transfer");
    expect(transfer.version).toBe(2);
    expect(transfer.prompts.map((prompt) => prompt.source_id)).toEqual(["source-0", "source-1"]);
    expect(transfer.prompts[0].tags).toContain("product");
    expect(transfer.prompts[0].notes).toContain("Detected parameters");
  });

  it("reports the exact committed count on success", async () => {
    const importer = vi.fn(async () => 2);
    await expect(runManualBatchImport(items, importer)).resolves.toEqual({ imported: 2, total: 2 });
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it("reports zero committed items when the atomic import fails", async () => {
    const importer = vi.fn(async () => { throw new Error("statement 1 failed"); });
    await expect(runManualBatchImport(items, importer)).rejects.toMatchObject({
      message: "statement 1 failed",
      imported: 0,
      total: 2,
    });
  });
});
