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

  it("defines explicit reference summary queries and wires ReferenceLibrary", () => {
    const references = readFileSync(resolve(process.cwd(), "src/lib/references.ts"), "utf8");
    const page = readFileSync(resolve(process.cwd(), "src/pages/ReferenceLibrary.tsx"), "utf8");
    expect(references).toContain("REFERENCE_SUMMARY_COLUMNS");
    expect(references).toContain("getReferenceSummaries");
    expect(references).toContain("searchReferenceSummaries");
    expect(page).toContain("getReferenceSummaries");
    expect(page).toContain("searchReferenceSummaries");
  });
});
