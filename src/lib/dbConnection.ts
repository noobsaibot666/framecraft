import { getActiveLibrarySelection, getActiveSqliteUrl, resolveLibraryPaths } from "./libraryConfig";
import { createNativeSqliteDatabase } from "./nativeSqlite";
import { startThumbnailMigration } from "./thumbnailMigration";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;
let _dbUrl = "";

// Hotfix: Portable libraries do not run tauri-plugin-sql migrations automatically.
// We must safely ensure newly added schema columns exist before use.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureSchemaUpToDate(db: any) {
  const columnsToAdd = [
    { name: "builder_state", def: "TEXT" },
    { name: "thumbnail_data", def: "TEXT" },
    { name: "source_url", def: "TEXT" },
    { name: "risk_notes", def: "TEXT" },
    { name: "best_use", def: "TEXT" },
    { name: "recipe_use_count", def: "INTEGER NOT NULL DEFAULT 0" },
  ];

  for (const col of columnsToAdd) {
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
