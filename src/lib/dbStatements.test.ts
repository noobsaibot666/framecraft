import initSqlJs, { type Database } from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import type { AtomicStatement } from "./dbTransaction";
import {
  buildAddComparisonItemStatements,
  buildBatchUpdatePromptStatements,
  buildClearItemWinnerStatements,
  buildCreateProjectStatements,
  buildProjectRelationshipStatements,
  buildSetItemWinnerStatements,
  buildSetItemRejectedStatements,
  buildSyncDecisionStatements,
} from "./dbStatements";

let createDatabase: () => Database;

beforeAll(async () => {
  const SQL = await initSqlJs();
  createDatabase = () => new SQL.Database();
});

function sqliteValues(values: unknown[] = []): (string | number | null)[] {
  return values.map((value) => typeof value === "boolean" ? (value ? 1 : 0) : value as string | number | null);
}

function executeRealTransaction(db: Database, statements: AtomicStatement[]): Record<string, unknown>[][] {
  const queryResults: Record<string, unknown>[][] = [];
  db.run("BEGIN");
  try {
    for (const statement of statements) {
      const sql = statement.sql.replace(/\$(\d+)/g, "?$1");
      if (statement.operation === "execute") {
        db.run(sql, sqliteValues(statement.bindValues));
        queryResults.push([]);
      } else {
        const prepared = db.prepare(sql);
        prepared.bind(sqliteValues(statement.bindValues));
        const rows: Record<string, unknown>[] = [];
        while (prepared.step()) rows.push(prepared.getAsObject());
        prepared.free();
        queryResults.push(rows);
      }
    }
    db.run("COMMIT");
    return queryResults;
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
}

function executeWithoutTransaction(db: Database, statements: AtomicStatement[]): void {
  for (const statement of statements) {
    if (statement.operation !== "execute") throw new Error("control helper supports writes only");
    db.run(statement.sql.replace(/\$(\d+)/g, "?$1"), sqliteValues(statement.bindValues));
  }
}

function promptRollbackDatabase(): Database {
  const db = createDatabase();
  db.run("CREATE TABLE prompts (id TEXT PRIMARY KEY, rating INTEGER, is_winner INTEGER, is_failed INTEGER, tags TEXT, updated_at TEXT)");
  db.run(`CREATE TRIGGER fail_second_prompt_update
    BEFORE UPDATE ON prompts
    WHEN OLD.id = 'two'
    BEGIN
      SELECT RAISE(ABORT, 'second prompt rejected');
    END`);
  db.run("INSERT INTO prompts VALUES ('one', 1, 0, 0, NULL, 'before'), ('two', 1, 0, 0, NULL, 'before')");
  return db;
}

function scalar(db: Database, sql: string): number {
  return db.exec(sql)[0]?.values[0]?.[0] as number;
}

describe("production atomic statement builders on real SQLite", () => {
  it("rolls back project creation when an extended field violates the schema", () => {
    const db = createDatabase();
    db.run(`CREATE TABLE projects (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, client TEXT, campaign TEXT, status TEXT,
      brief_text TEXT, production_goal TEXT, category TEXT, tags TEXT, notes TEXT,
      project_type TEXT CHECK(project_type != 'invalid'), intended_output TEXT,
      image_needs TEXT, video_needs TEXT, aspect_ratios TEXT, provider_targets TEXT,
      visual_direction TEXT, constraints TEXT, creative_goals TEXT, campaign_id TEXT,
      created_at TEXT, updated_at TEXT
    )`);
    const statements = buildCreateProjectStatements(
      { title: "Atomic", project_type: "invalid", campaign_id: "campaign-1" },
      "project-1",
      "now"
    );
    expect(() => executeRealTransaction(db, statements)).toThrow();
    expect(scalar(db, "SELECT COUNT(*) FROM projects")).toBe(0);
  });

  it("persists campaign_id in the complete project insert", () => {
    const db = createDatabase();
    db.run(`CREATE TABLE projects (
      id TEXT PRIMARY KEY, title TEXT, client TEXT, campaign TEXT, status TEXT,
      brief_text TEXT, production_goal TEXT, category TEXT, tags TEXT, notes TEXT,
      project_type TEXT, intended_output TEXT, image_needs TEXT, video_needs TEXT,
      aspect_ratios TEXT, provider_targets TEXT, visual_direction TEXT, constraints TEXT,
      creative_goals TEXT, campaign_id TEXT, created_at TEXT, updated_at TEXT
    )`);
    executeRealTransaction(db, buildCreateProjectStatements(
      { title: "Campaign project", campaign_id: "campaign-1" }, "project-1", "now"
    ));
    expect(db.exec("SELECT campaign_id FROM projects")[0].values[0][0]).toBe("campaign-1");
  });

  it("rolls back every prompt update when a later prompt fails", () => {
    const statements = buildBatchUpdatePromptStatements(["one", "two"], { rating: 5 }, "after");

    const control = promptRollbackDatabase();
    expect(() => executeWithoutTransaction(control, statements)).toThrow("second prompt rejected");
    expect(scalar(control, "SELECT rating FROM prompts WHERE id = 'one'")).toBe(5);

    const db = promptRollbackDatabase();
    expect(() => executeRealTransaction(db, statements)).toThrow();
    expect(scalar(db, "SELECT rating FROM prompts WHERE id = 'one'")).toBe(1);
    expect(scalar(db, "SELECT rating FROM prompts WHERE id = 'two'")).toBe(1);
  });

  it("rolls back a relationship insert when the parent timestamp fails", () => {
    const db = createDatabase();
    db.run("CREATE TABLE projects (id TEXT PRIMARY KEY, updated_at TEXT CHECK(updated_at != 'invalid'))");
    db.run("CREATE TABLE project_prompts (project_id TEXT, prompt_id TEXT, UNIQUE(project_id, prompt_id))");
    db.run("INSERT INTO projects VALUES ('project-1', 'before')");
    const statements = buildProjectRelationshipStatements("prompts", "project-1", "prompt-1", "invalid");
    expect(() => executeRealTransaction(db, statements)).toThrow();
    expect(scalar(db, "SELECT COUNT(*) FROM project_prompts")).toBe(0);
  });

  it("returns the persisted id for a duplicate comparison item", () => {
    const db = createDatabase();
    db.run("CREATE TABLE comparison_sessions (id TEXT PRIMARY KEY, updated_at TEXT)");
    db.run(`CREATE TABLE comparison_items (
      id TEXT PRIMARY KEY, session_id TEXT, result_id TEXT, position INTEGER, source_role TEXT,
      is_winner INTEGER, is_rejected INTEGER, created_at TEXT, UNIQUE(session_id, result_id)
    )`);
    db.run("INSERT INTO comparison_sessions VALUES ('session-1', 'before')");
    db.run("INSERT INTO comparison_items VALUES ('persisted-id', 'session-1', 'result-1', 0, 'result', 0, 0, 'before')");
    const rows = executeRealTransaction(db, buildAddComparisonItemStatements(
      "ignored-id", "session-1", "result-1", 4, "reference", "after"
    ));
    expect(rows[1][0].id).toBe("persisted-id");
    expect(db.exec("SELECT position, source_role FROM comparison_items")[0].values[0]).toEqual([4, "reference"]);
  });

  it("keeps independent winners and makes a mismatched item/session tuple a no-op", () => {
    const db = createDatabase();
    db.run("CREATE TABLE comparison_sessions (id TEXT PRIMARY KEY, updated_at TEXT)");
    db.run("CREATE TABLE comparison_items (id TEXT PRIMARY KEY, session_id TEXT, is_winner INTEGER, is_rejected INTEGER)");
    db.run("INSERT INTO comparison_sessions VALUES ('a', 'before'), ('b', 'before')");
    db.run("INSERT INTO comparison_items VALUES ('a1', 'a', 0, 0), ('a2', 'a', 0, 0), ('b1', 'b', 0, 0)");
    executeRealTransaction(db, buildSetItemWinnerStatements("a2", "a", "after-a"));
    executeRealTransaction(db, buildSetItemWinnerStatements("b1", "b", "after-b"));
    executeRealTransaction(db, buildSetItemWinnerStatements("a1", "b", "invalid-change"));
    expect(db.exec("SELECT id FROM comparison_items WHERE is_winner = 1 ORDER BY id")[0].values).toEqual([["a2"], ["b1"]]);
    expect(db.exec("SELECT updated_at FROM comparison_sessions WHERE id = 'b'")[0].values[0][0]).toBe("after-b");
  });

  it("scopes winner clearing and rejection mutations", () => {
    const db = createDatabase();
    db.run("CREATE TABLE comparison_sessions (id TEXT PRIMARY KEY, updated_at TEXT)");
    db.run("CREATE TABLE comparison_items (id TEXT PRIMARY KEY, session_id TEXT, is_winner INTEGER, is_rejected INTEGER)");
    db.run("INSERT INTO comparison_sessions VALUES ('a', 'before'), ('b', 'before')");
    db.run("INSERT INTO comparison_items VALUES ('a1', 'a', 1, 0), ('b1', 'b', 1, 0)");
    executeRealTransaction(db, buildClearItemWinnerStatements("a", "after"));
    expect(db.exec("SELECT id FROM comparison_items WHERE is_winner = 1")[0].values).toEqual([["b1"]]);
    executeRealTransaction(db, buildSetItemRejectedStatements("b1", true));
    expect(db.exec("SELECT is_winner, is_rejected FROM comparison_items WHERE id = 'b1'")[0].values[0]).toEqual([0, 1]);
  });

  it("rolls back all rows when set-based decision sync hits a later constraint", () => {
    const db = createDatabase();
    db.run("CREATE TABLE results (id TEXT PRIMARY KEY, is_winner INTEGER, is_failed INTEGER, CHECK(NOT (is_winner = 1 AND is_failed = 1)))");
    db.run("CREATE TABLE comparison_items (session_id TEXT, result_id TEXT, is_winner INTEGER, is_rejected INTEGER)");
    db.run("INSERT INTO results VALUES ('r1', 0, 0), ('r2', 0, 0)");
    db.run("INSERT INTO comparison_items VALUES ('session-1', 'r1', 1, 0), ('session-1', 'r2', 1, 1)");
    expect(() => executeRealTransaction(db, buildSyncDecisionStatements("session-1"))).toThrow();
    expect(scalar(db, "SELECT COUNT(*) FROM results WHERE is_winner != 0 OR is_failed != 0")).toBe(0);
  });
});
