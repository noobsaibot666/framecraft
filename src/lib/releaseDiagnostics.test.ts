import { describe, expect, it, vi } from "vitest";
import {
  REQUIRED_RELEASE_TABLES,
  formatDiagnosticSummary,
  runReleaseDiagnostics,
  validateRequiredTables,
} from "./releaseDiagnostics";

describe("release diagnostics", () => {
  it("reports missing required SQLite tables", () => {
    const result = validateRequiredTables(["prompts", "results"]);

    expect(result.ok).toBe(false);
    expect(result.missing).toContain("references");
    expect(result.missing).toContain("generation_queue");
  });

  it("passes when all required SQLite tables are present", () => {
    const result = validateRequiredTables(REQUIRED_RELEASE_TABLES);

    expect(result).toEqual({ ok: true, missing: [] });
  });

  it("runs dependency-injected diagnostics in order", async () => {
    const result = await runReleaseDiagnostics({
      isTauri: () => true,
      listTables: vi.fn(async () => REQUIRED_RELEASE_TABLES),
      testFileStore: vi.fn(async () => undefined),
      testDialogPlugin: vi.fn(async () => undefined),
      validateActiveLibrary: vi.fn(async () => "Using local app-data library."),
    });

    expect(result.checks.map((check) => check.id)).toEqual([
      "tauri-runtime",
      "sqlite-schema",
      "file-store",
      "dialog-plugin",
      "active-library",
    ]);
    expect(result.checks.every((check) => check.status === "pass")).toBe(true);
  });

  it("keeps going and reports failed diagnostics", async () => {
    const result = await runReleaseDiagnostics({
      isTauri: () => true,
      listTables: vi.fn(async () => ["prompts"]),
      testFileStore: vi.fn(async () => {
        throw new Error("write failed");
      }),
      testDialogPlugin: vi.fn(async () => undefined),
      validateActiveLibrary: vi.fn(async () => {
        throw new Error("Missing framecraft.db");
      }),
    });

    expect(result.checks.find((check) => check.id === "sqlite-schema")?.status).toBe("fail");
    expect(result.checks.find((check) => check.id === "file-store")?.message).toContain("write failed");
    expect(result.checks.find((check) => check.id === "active-library")?.message).toContain("Missing framecraft.db");
    expect(formatDiagnosticSummary(result)).toBe("2 passed, 3 failed");
  });

  it("reports non-Error native diagnostic failures", async () => {
    const result = await runReleaseDiagnostics({
      isTauri: () => true,
      listTables: vi.fn(async () => {
        throw "database is locked";
      }),
      testFileStore: vi.fn(async () => undefined),
      testDialogPlugin: vi.fn(async () => undefined),
      validateActiveLibrary: vi.fn(async () => "Using local app-data library."),
    });

    expect(result.checks.find((check) => check.id === "sqlite-schema")?.message).toBe("database is locked");
  });
});
