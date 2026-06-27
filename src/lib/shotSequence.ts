import type { Shot, ShotType, CreateShotInput, UpdateShotInput } from "@/types";
import { getFramecraftDb } from "./dbConnection";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const developmentShots: Shot[] = [];

export const SHOT_TYPES: { value: ShotType; label: string }[] = [
  { value: "establishing", label: "Establishing" },
  { value: "wide", label: "Wide" },
  { value: "medium", label: "Medium" },
  { value: "close_up", label: "Close-up" },
  { value: "detail", label: "Detail" },
  { value: "cutaway", label: "Cutaway" },
  { value: "hero", label: "Hero" },
  { value: "product", label: "Product" },
];

function rowToShot(row: Record<string, unknown>): Shot {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    sort_order: row.sort_order as number,
    shot_type: (row.shot_type as ShotType) ?? "hero",
    label: (row.label as string) ?? "",
    prompt_id: (row.prompt_id as string) || undefined,
    result_id: (row.result_id as string) || undefined,
    notes: (row.notes as string) || undefined,
    created_at: row.created_at as string,
  };
}

export async function getProjectShots(projectId: string): Promise<Shot[]> {
  if (isTauri) {
    const db = await getFramecraftDb();
    const rows = await db.select(
      "SELECT * FROM shot_sequence WHERE project_id = $1 ORDER BY sort_order ASC, created_at ASC",
      [projectId]
    ) as Record<string, unknown>[];
    return rows.map(rowToShot);
  }
  return developmentShots
    .filter((shot) => shot.project_id === projectId)
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

export async function createShot(input: CreateShotInput): Promise<string> {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const shot: Shot = {
    id,
    project_id: input.project_id,
    sort_order: input.sort_order,
    shot_type: input.shot_type,
    label: input.label.trim(),
    prompt_id: input.prompt_id || undefined,
    result_id: input.result_id || undefined,
    notes: input.notes?.trim() || undefined,
    created_at: timestamp,
  };

  if (isTauri) {
    const db = await getFramecraftDb();
    await db.execute(
      `INSERT INTO shot_sequence
       (id, project_id, sort_order, shot_type, label, prompt_id, result_id, notes, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        shot.id, shot.project_id, shot.sort_order, shot.shot_type, shot.label,
        shot.prompt_id ?? null, shot.result_id ?? null, shot.notes ?? null, shot.created_at,
      ]
    );
  } else {
    developmentShots.push(shot);
  }
  return id;
}

export async function updateShot(id: string, input: UpdateShotInput): Promise<void> {
  if (isTauri) {
    const db = await getFramecraftDb();
    const sets: string[] = [];
    const values: unknown[] = [];

    const push = (col: string, val: unknown) => {
      values.push(val);
      sets.push(`${col} = $${values.length}`);
    };

    if (input.shot_type !== undefined) push("shot_type", input.shot_type);
    if (input.label !== undefined) push("label", input.label.trim());
    if ("prompt_id" in input) push("prompt_id", input.prompt_id ?? null);
    if ("result_id" in input) push("result_id", input.result_id ?? null);
    if ("notes" in input) push("notes", input.notes?.trim() ?? null);
    if (input.sort_order !== undefined) push("sort_order", input.sort_order);

    if (sets.length === 0) return;
    values.push(id);
    await db.execute(`UPDATE shot_sequence SET ${sets.join(", ")} WHERE id = $${values.length}`, values);
  } else {
    const index = developmentShots.findIndex((shot) => shot.id === id);
    if (index < 0) return;
    const prev = developmentShots[index];
    developmentShots[index] = {
      ...prev,
      shot_type: input.shot_type ?? prev.shot_type,
      label: input.label?.trim() ?? prev.label,
      prompt_id: "prompt_id" in input ? (input.prompt_id ?? undefined) : prev.prompt_id,
      result_id: "result_id" in input ? (input.result_id ?? undefined) : prev.result_id,
      notes: "notes" in input ? (input.notes?.trim() ?? undefined) : prev.notes,
      sort_order: input.sort_order ?? prev.sort_order,
    };
  }
}

export async function deleteShot(id: string): Promise<void> {
  if (isTauri) {
    const db = await getFramecraftDb();
    await db.execute("DELETE FROM shot_sequence WHERE id = $1", [id]);
  } else {
    const index = developmentShots.findIndex((shot) => shot.id === id);
    if (index >= 0) developmentShots.splice(index, 1);
  }
}

export async function reorderShots(projectId: string, orderedIds: string[]): Promise<void> {
  if (isTauri) {
    const db = await getFramecraftDb();
    for (let i = 0; i < orderedIds.length; i++) {
      await db.execute(
        "UPDATE shot_sequence SET sort_order = $1 WHERE id = $2 AND project_id = $3",
        [i, orderedIds[i], projectId]
      );
    }
  } else {
    for (let i = 0; i < orderedIds.length; i++) {
      const shot = developmentShots.find((s) => s.id === orderedIds[i] && s.project_id === projectId);
      if (shot) shot.sort_order = i;
    }
  }
}
