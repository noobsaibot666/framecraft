import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("summary list queries", () => {
  it("defines explicit prompt summary queries and wires the prompt store", () => {
    const db = readFileSync(resolve(process.cwd(), "src/lib/db.ts"), "utf8");
    const store = readFileSync(resolve(process.cwd(), "src/stores/usePromptStore.ts"), "utf8");
    expect(db).toContain("PROMPT_SUMMARY_COLUMNS");
    expect(db).toContain("getPromptSummaries");
    expect(db).toContain("searchPromptSummaries");
    expect(store).toContain("getPromptSummaries");
    expect(store).toContain("searchPromptSummaries");
  });

  it("excludes the thumbnail_data blob from the prompt summary columns, fetching it separately", () => {
    const db = readFileSync(resolve(process.cwd(), "src/lib/db.ts"), "utf8");
    const page = readFileSync(resolve(process.cwd(), "src/pages/PromptLibrary.tsx"), "utf8");
    const columnsBlock = db.slice(db.indexOf("PROMPT_SUMMARY_COLUMNS ="), db.indexOf("].join"));
    expect(columnsBlock).not.toContain("thumbnail_data");
    expect(db).toContain("getPromptThumbnailFallbackMap");
    expect(page).toContain("getPromptThumbnailFallbackMap");
  });

  it("defines explicit reference summary queries and wires ReferenceLibrary", () => {
    const references = readFileSync(resolve(process.cwd(), "src/lib/references.ts"), "utf8");
    const page = readFileSync(resolve(process.cwd(), "src/pages/ReferenceLibrary.tsx"), "utf8");
    expect(references).toContain("REFERENCE_SUMMARY_COLUMNS");
    expect(references).toContain("getReferenceSummaries");
    expect(references).toContain("searchReferenceSummaries");
    expect(page).toContain("getReferenceSummaries");
    expect(page).toContain("searchReferenceSummaries");
  });

  it("excludes file_data/thumbnail_data blobs from the reference summary columns, fetching them separately", () => {
    const references = readFileSync(resolve(process.cwd(), "src/lib/references.ts"), "utf8");
    const page = readFileSync(resolve(process.cwd(), "src/pages/ReferenceLibrary.tsx"), "utf8");
    const columnsBlock = references.slice(references.indexOf("REFERENCE_SUMMARY_COLUMNS ="), references.indexOf("].join"));
    expect(columnsBlock).not.toContain("file_data");
    expect(columnsBlock).not.toContain("thumbnail_data");
    expect(references).toContain("getReferenceThumbnailMap");
    expect(page).toContain("getReferenceThumbnailMap");
  });
});
