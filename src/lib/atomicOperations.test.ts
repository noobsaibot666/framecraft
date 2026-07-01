import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type TransactionResult = { rowsAffected?: number; rows?: Record<string, unknown>[] };

const executeTransaction = vi.fn<(
  statements: { operation: string; sql: string; bindValues?: unknown[] }[]
) => Promise<TransactionResult[]>>();
const execute = vi.fn();
const select = vi.fn();

beforeEach(() => {
  vi.resetModules();
  executeTransaction.mockReset();
  execute.mockReset();
  select.mockReset();
  vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
  vi.doMock("./dbConnection", () => ({
    getFramecraftDb: async () => ({ executeTransaction, execute, select }),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock("./dbConnection");
});

describe("atomic project operations", () => {
  it("creates the complete project in one atomic statement and returns no id after failure", async () => {
    const failure = new Error("campaign field constraint failed");
    executeTransaction.mockRejectedValue(failure);
    const { createProject } = await import("./projects");

    await expect(createProject({
      title: "Atomic",
      project_type: "campaign",
      intended_output: "launch",
      campaign_id: "campaign-1",
    })).rejects.toThrow("campaign field constraint failed");

    expect(executeTransaction).toHaveBeenCalledTimes(1);
    const [statements] = executeTransaction.mock.calls[0];
    expect(statements).toHaveLength(1);
    expect(statements[0].sql).toContain("project_type");
    expect(statements[0].sql).toContain("campaign_id");
    expect(execute).not.toHaveBeenCalled();
  });

  it("maps campaign_id when reading a project", async () => {
    select.mockResolvedValue([{
      id: "project-1", title: "Mapped", status: "draft", campaign_id: "campaign-1",
      created_at: "before", updated_at: "before",
    }]);
    const { getProjectById } = await import("./projects");
    await expect(getProjectById("project-1")).resolves.toMatchObject({ campaign_id: "campaign-1" });
  });

  it.each([
    ["addPromptToProject", "project_prompts"],
    ["addResultToProject", "project_results"],
    ["addReferenceToProject", "project_references"],
  ] as const)("%s groups relationship insert and project timestamp", async (method, table) => {
    executeTransaction.mockResolvedValue([{ rowsAffected: 1 }, { rowsAffected: 1 }]);
    const projects = await import("./projects");
    await projects[method]("project-1", "child-1");
    const [statements] = executeTransaction.mock.calls[0];
    expect(statements).toHaveLength(2);
    expect(statements[0].sql).toContain(table);
    expect(statements[1].sql).toContain("UPDATE projects SET updated_at");
  });
});

describe("atomic prompt batches", () => {
  it("submits all prompt changes together and rejects the whole operation when one fails", async () => {
    executeTransaction.mockRejectedValue(new Error("statement 1 failed"));
    const { batchUpdatePrompts } = await import("./db");
    await expect(batchUpdatePrompts(["one", "two"], { rating: 5 })).rejects.toThrow("statement 1 failed");
    expect(executeTransaction).toHaveBeenCalledTimes(1);
    expect(executeTransaction.mock.calls[0][0]).toHaveLength(2);
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("atomic comparison operations", () => {
  it("returns the persisted item id after a semantic duplicate", async () => {
    executeTransaction.mockResolvedValue([
      { rowsAffected: 1 },
      { rows: [{ id: "persisted-id" }] },
      { rowsAffected: 1 },
    ]);
    const { addItemToSession } = await import("./comparisons");
    await expect(addItemToSession("session-1", "result-1", 3, "reference")).resolves.toBe("persisted-id");
    const [statements] = executeTransaction.mock.calls[0];
    expect(statements[0].sql).toMatch(/ON CONFLICT\s*\(session_id,\s*result_id\)/i);
    expect(statements[1].operation).toBe("query");
    expect(statements[2].sql).toContain("UPDATE comparison_sessions");
  });

  it("sets a winner and timestamp atomically with every item mutation scoped to its session", async () => {
    executeTransaction.mockResolvedValue([{ rowsAffected: 1 }, { rowsAffected: 1 }, { rowsAffected: 1 }]);
    const { setItemWinner } = await import("./comparisons");
    await setItemWinner("item-1", "session-1");
    const [statements] = executeTransaction.mock.calls[0];
    expect(statements).toHaveLength(3);
    expect(statements[0].sql).toContain("session_id = $1");
    expect(statements[1].sql).toContain("session_id = $2");
    expect(statements[1].bindValues).toEqual(["item-1", "session-1"]);
  });

  it("does not clear a winner belonging to another session", async () => {
    executeTransaction.mockResolvedValue([{ rowsAffected: 1 }, { rowsAffected: 1 }, { rowsAffected: 1 }]);
    const { setItemWinner } = await import("./comparisons");
    await setItemWinner("session-b-item", "session-b");
    const [statements] = executeTransaction.mock.calls[0];
    expect(statements.every((statement) =>
      !statement.sql.includes("is_winner = 0") || statement.bindValues?.includes("session-b")
    )).toBe(true);
  });

  it("syncs every relevant result in one atomic operation", async () => {
    executeTransaction.mockResolvedValue([{ rowsAffected: 2 }]);
    const { syncDecisionsToResults } = await import("./comparisons");
    await expect(syncDecisionsToResults("session-1")).resolves.toBe(2);
    expect(executeTransaction).toHaveBeenCalledTimes(1);
    expect(executeTransaction.mock.calls[0][0]).toHaveLength(1);
    expect(executeTransaction.mock.calls[0][0][0].sql).toContain("comparison_items");
    expect(select).not.toHaveBeenCalled();
  });
});
