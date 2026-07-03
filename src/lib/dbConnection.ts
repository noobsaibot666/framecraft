import { getActiveLibrarySelection, getActiveSqliteUrl, resolveLibraryPaths } from "./libraryConfig";
import { createNativeSqliteDatabase } from "./nativeSqlite";
import { startThumbnailMigration } from "./thumbnailMigration";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;
let _dbUrl = "";

// Hotfix: Portable libraries do not run tauri-plugin-sql migrations automatically,
// and (found 2026-07-03, live user report) even "local app data" libraries can end
// up with the plugin-sql migration ledger stuck part-way — e.g. a long-running
// Tauri dev process that was launched before newer migrations were compiled in
// never re-applies them until restarted. When that happens, a query referencing a
// missing column throws while COUNT(*)-style queries silently keep working,
// producing exactly the "Dashboard shows 26 prompts, Library shows empty" split
// this fixes. We must safely ensure newly added schema exists before use.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureSchemaUpToDate(db: any) {
  const promptColumns = [
    { name: "builder_state", def: "TEXT" },
    { name: "thumbnail_data", def: "TEXT" },
    { name: "source_url", def: "TEXT" },
    { name: "risk_notes", def: "TEXT" },
    { name: "best_use", def: "TEXT" },
    { name: "recipe_use_count", def: "INTEGER NOT NULL DEFAULT 0" },
    // Migrations 026/027 — previously missing here, which is the exact gap
    // that let a live database drift out of sync with PROMPT_SUMMARY_COLUMNS.
    { name: "variant_label", def: "TEXT" },
    { name: "thumbnail_result_id", def: "TEXT REFERENCES results(id) ON DELETE SET NULL" },
  ];
  for (const col of promptColumns) {
    try {
      await db.execute(`SELECT ${col.name} FROM prompts LIMIT 1`);
    } catch (e) {
      try {
        await db.execute(`ALTER TABLE prompts ADD COLUMN ${col.name} ${col.def};`);
      } catch (err) {
        // Ignore errors if the column already exists or fails
      }
    }
  }

  // Migration 031 — Creative Director Mode strategy storage.
  try {
    await db.execute(`SELECT creative_strategy FROM projects LIMIT 1`);
  } catch (e) {
    try {
      await db.execute(`ALTER TABLE projects ADD COLUMN creative_strategy TEXT;`);
    } catch (err) {
      // Ignore
    }
  }

  // Migration 028 — inconsistency detector event log. executeBatch, not
  // execute — the native bridge's execute() maps to rusqlite's
  // Connection::execute, which only accepts a single statement.
  try {
    await db.executeBatch(`
      CREATE TABLE IF NOT EXISTS inconsistency_events (
        id         TEXT PRIMARY KEY NOT NULL,
        rule_id    TEXT NOT NULL,
        rule_label TEXT NOT NULL,
        suggestion TEXT,
        prompt_id  TEXT REFERENCES prompts(id) ON DELETE SET NULL,
        provider   TEXT,
        action     TEXT NOT NULL DEFAULT 'warned',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_inconsistency_events_rule ON inconsistency_events(rule_id);
    `);
  } catch (err) {
    // Ignore
  }

  // Migration 030 — Storytelling shot storyboards.
  try {
    await db.executeBatch(`
      CREATE TABLE IF NOT EXISTS direction_storyboards (
        id            TEXT PRIMARY KEY,
        direction_id  TEXT NOT NULL REFERENCES creative_directions(id) ON DELETE CASCADE,
        project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        sort_order    INTEGER NOT NULL DEFAULT 0,
        shot_label    TEXT NOT NULL,
        description   TEXT NOT NULL,
        is_approved   INTEGER NOT NULL DEFAULT 0,
        prompt_id     TEXT REFERENCES prompts(id) ON DELETE SET NULL,
        accent_index  INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_direction_storyboards_direction
        ON direction_storyboards(direction_id, sort_order);
    `);
  } catch (err) {
    // Ignore
  }

  // Also apply migration 24 to remove seeded recipes
  try {
    await db.execute(`
      DELETE FROM prompts WHERE title IN (
        'Clean Realism — Editorial',
        'Brand Campaign — Consistency Stack',
        'Controlled Exploration',
        'Skin Realism — Minimal Stack',
        'Scenography — Immersive Set',
        'Nano Banana — Skin Texture Macro',
        'Nano Banana — Eye Detail Macro',
        'Nano Banana — Lip Texture Macro',
        'Nano Banana — Tongue Texture Macro'
      ) AND is_recipe = 1;
    `);
  } catch (err) {
    // Ignore
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getFramecraftDb(): Promise<any> {
  if (!isTauri) throw new Error("Not in Tauri context");

  const selection = getActiveLibrarySelection();
  if (selection.path) {
    const dbPath = resolveLibraryPaths(selection.path).dbPath;
    if (!_db || _dbUrl !== dbPath) {
      _db = createNativeSqliteDatabase(dbPath);
      await ensureSchemaUpToDate(_db);
      startThumbnailMigration(_db);
      _dbUrl = dbPath;
    }
    return _db;
  }

  const url = await getActiveSqliteUrl();
  if (!_db || _dbUrl !== url) {
    const SqlPlugin = await import("@tauri-apps/plugin-sql");
    // Loading the plugin applies registered migrations. Runtime access then uses
    // the single-connection native bridge so multi-statement operations are real
    // SQLite transactions rather than calls distributed across a connection pool.
    const migrationDb = await SqlPlugin.default.load(url);
    await migrationDb.close();
    const { appConfigDir } = await import("@tauri-apps/api/path");
    const base = (await appConfigDir()).replace(/[\\/]?$/, "/");
    _db = createNativeSqliteDatabase(`${base}${url.slice("sqlite:".length)}`);
    await ensureSchemaUpToDate(_db);
    startThumbnailMigration(_db);
    _dbUrl = url;
  }
  return _db;
}

export function resetFramecraftDbConnectionForTests(): void {
  _db = null;
  _dbUrl = "";
}
