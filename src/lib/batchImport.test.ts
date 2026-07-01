import { describe, expect, it } from "vitest";
import { batchFullySucceeded, summarizeBatchOutcome } from "./batchImport";

describe("batchFullySucceeded", () => {
  it("is true only when all succeed with no failures", () => {
    expect(batchFullySucceeded({ total: 3, succeeded: 3, failures: [] })).toBe(true);
    expect(batchFullySucceeded({ total: 3, succeeded: 2, failures: [{ title: "a", error: "x" }] })).toBe(false);
    expect(batchFullySucceeded({ total: 0, succeeded: 0, failures: [] })).toBe(false);
  });
});

describe("summarizeBatchOutcome", () => {
  it("reports full success", () => {
    expect(summarizeBatchOutcome({ total: 2, succeeded: 2, failures: [] })).toBe("Imported all 2 prompts.");
    expect(summarizeBatchOutcome({ total: 1, succeeded: 1, failures: [] })).toBe("Imported all 1 prompt.");
  });

  it("reports total failure with the first error", () => {
    const msg = summarizeBatchOutcome({ total: 3, succeeded: 0, failures: [
      { title: "A", error: "disk full" },
      { title: "B", error: "disk full" },
    ] });
    expect(msg).toMatch(/0 of 3/);
    expect(msg).toMatch(/disk full/);
  });

  it("reports partial success with counts and a sample failure", () => {
    const msg = summarizeBatchOutcome({ total: 5, succeeded: 3, failures: [
      { title: "Bad One", error: "constraint" },
      { title: "Bad Two", error: "constraint" },
    ] });
    expect(msg).toMatch(/Imported 3 of 5/);
    expect(msg).toMatch(/2 failed/);
    expect(msg).toMatch(/Bad One/);
  });

  it("handles the empty case", () => {
    expect(summarizeBatchOutcome({ total: 0, succeeded: 0, failures: [] })).toBe("Nothing to import.");
  });
});
