import type { CinemaScriptVersion } from "@/types";
import { getFramecraftDb } from "./dbConnection";
import { generateId } from "./utils";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const _devStore: CinemaScriptVersion[] = [];

function now(): string {
  return new Date().toISOString();
}

function rowToVersion(row: Record<string, unknown>): CinemaScriptVersion {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    content: row.content as string,
    label: (row.label as string) || undefined,
    created_at: row.created_at as string,
  };
}

export async function createScriptVersion(projectId: string, content: string, label?: string): Promise<string> {
  const id = generateId();
  const ts = now();

  if (isTauri) {
    const db = await getFramecraftDb();
    await db.execute(
      `INSERT INTO cinema_script_versions (id, project_id, content, label, created_at) VALUES ($1,$2,$3,$4,$5)`,
      [id, projectId, content, label?.trim() || null, ts]
    );
    return id;
  }

  _devStore.unshift({ id, project_id: projectId, content, label: label?.trim() || undefined, created_at: ts });
  return id;
}

export async function getScriptVersions(projectId: string): Promise<CinemaScriptVersion[]> {
  if (isTauri) {
    const db = await getFramecraftDb();
    const rows = (await db.select(
      `SELECT * FROM cinema_script_versions WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId]
    )) as Record<string, unknown>[];
    return rows.map(rowToVersion);
  }
  return _devStore.filter((v) => v.project_id === projectId);
}
