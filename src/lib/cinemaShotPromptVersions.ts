import type { CinemaShotPromptVersion } from "@/types";
import { getFramecraftDb } from "./dbConnection";
import { generateId } from "./utils";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const _devStore: CinemaShotPromptVersion[] = [];

function now(): string {
  return new Date().toISOString();
}

function rowToVersion(row: Record<string, unknown>): CinemaShotPromptVersion {
  return {
    id: row.id as string,
    shot_id: row.shot_id as string,
    content: row.content as string,
    label: (row.label as string) || undefined,
    created_at: row.created_at as string,
  };
}

export async function createShotPromptVersion(shotId: string, content: string, label?: string): Promise<string> {
  const id = generateId();
  const ts = now();

  if (isTauri) {
    const db = await getFramecraftDb();
    await db.execute(
      `INSERT INTO cinema_shot_prompt_versions (id, shot_id, content, label, created_at) VALUES ($1,$2,$3,$4,$5)`,
      [id, shotId, content, label?.trim() || null, ts]
    );
    return id;
  }

  _devStore.unshift({ id, shot_id: shotId, content, label: label?.trim() || undefined, created_at: ts });
  return id;
}

export async function getShotPromptVersions(shotId: string): Promise<CinemaShotPromptVersion[]> {
  if (isTauri) {
    const db = await getFramecraftDb();
    const rows = (await db.select(
      `SELECT * FROM cinema_shot_prompt_versions WHERE shot_id = $1 ORDER BY created_at DESC`,
      [shotId]
    )) as Record<string, unknown>[];
    return rows.map(rowToVersion);
  }
  return _devStore.filter((v) => v.shot_id === shotId);
}
