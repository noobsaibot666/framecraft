import type { CreativeDirection } from "@/types";
import { getFramecraftDb } from "./dbConnection";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const developmentDirections: CreativeDirection[] = [];

export type CreateCreativeDirectionInput = Pick<CreativeDirection, "project_id" | "title"> &
  Partial<Pick<CreativeDirection,
    "campaign_idea" | "rationale" | "visual_aesthetic" | "brand_connection" |
    "product_message" | "tone" | "prompt_direction">>;

export type UpdateCreativeDirectionInput = Partial<Omit<
  CreativeDirection,
  "id" | "project_id" | "is_selected" | "created_at" | "updated_at"
>>;

function now() {
  return new Date().toISOString();
}

function rowToDirection(row: Record<string, unknown>): CreativeDirection {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    title: row.title as string,
    campaign_idea: (row.campaign_idea as string) ?? "",
    rationale: (row.rationale as string) ?? "",
    visual_aesthetic: (row.visual_aesthetic as string) ?? "",
    brand_connection: (row.brand_connection as string) ?? "",
    product_message: (row.product_message as string) ?? "",
    tone: (row.tone as string) ?? "",
    prompt_direction: (row.prompt_direction as string) ?? "",
    is_selected: Boolean(row.is_selected),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function createCreativeDirection(input: CreateCreativeDirectionInput): Promise<string> {
  const id = crypto.randomUUID();
  const timestamp = now();
  const direction: CreativeDirection = {
    id,
    project_id: input.project_id,
    title: input.title.trim() || "Untitled Direction",
    campaign_idea: input.campaign_idea ?? "",
    rationale: input.rationale ?? "",
    visual_aesthetic: input.visual_aesthetic ?? "",
    brand_connection: input.brand_connection ?? "",
    product_message: input.product_message ?? "",
    tone: input.tone ?? "",
    prompt_direction: input.prompt_direction ?? "",
    is_selected: false,
    created_at: timestamp,
    updated_at: timestamp,
  };

  if (isTauri) {
    const db = await getFramecraftDb();
    await db.execute(
      `INSERT INTO creative_directions
       (id, project_id, title, campaign_idea, rationale, visual_aesthetic,
        brand_connection, product_message, tone, prompt_direction, is_selected, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11,$12)`,
      [
        direction.id, direction.project_id, direction.title, direction.campaign_idea,
        direction.rationale, direction.visual_aesthetic, direction.brand_connection,
        direction.product_message, direction.tone, direction.prompt_direction,
        direction.created_at, direction.updated_at,
      ]
    );
  } else {
    developmentDirections.unshift(direction);
  }
  return id;
}

export async function getCreativeDirections(projectId: string): Promise<CreativeDirection[]> {
  if (isTauri) {
    const db = await getFramecraftDb();
    const rows = await db.select(
      "SELECT * FROM creative_directions WHERE project_id = $1 ORDER BY updated_at DESC",
      [projectId]
    ) as Record<string, unknown>[];
    return rows.map(rowToDirection);
  }
  return developmentDirections
    .filter((direction) => direction.project_id === projectId)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function updateCreativeDirection(
  id: string,
  input: UpdateCreativeDirectionInput
): Promise<void> {
  const allowed = [
    "title", "campaign_idea", "rationale", "visual_aesthetic", "brand_connection",
    "product_message", "tone", "prompt_direction",
  ] as const;
  const entries = allowed
    .filter((key) => input[key] !== undefined)
    .map((key) => [key, input[key]] as const);
  if (entries.length === 0) return;
  const timestamp = now();

  if (isTauri) {
    const db = await getFramecraftDb();
    const values: unknown[] = [timestamp];
    const sets = ["updated_at = $1"];
    for (const [key, value] of entries) {
      values.push(value);
      sets.push(`${key} = $${values.length}`);
    }
    values.push(id);
    await db.execute(`UPDATE creative_directions SET ${sets.join(", ")} WHERE id = $${values.length}`, values);
  } else {
    const index = developmentDirections.findIndex((direction) => direction.id === id);
    if (index >= 0) developmentDirections[index] = { ...developmentDirections[index], ...input, updated_at: timestamp };
  }
}

export async function selectCreativeDirection(projectId: string, id: string): Promise<void> {
  const timestamp = now();
  if (isTauri) {
    const db = await getFramecraftDb();
    await db.execute(
      `UPDATE creative_directions
       SET is_selected = CASE WHEN id = $1 THEN 1 ELSE 0 END, updated_at = $2
       WHERE project_id = $3`,
      [id, timestamp, projectId]
    );
  } else {
    for (const direction of developmentDirections) {
      if (direction.project_id === projectId) {
        direction.is_selected = direction.id === id;
        direction.updated_at = timestamp;
      }
    }
  }
}

export async function deleteCreativeDirection(id: string): Promise<void> {
  if (isTauri) {
    const db = await getFramecraftDb();
    await db.execute("DELETE FROM creative_directions WHERE id = $1", [id]);
  } else {
    const index = developmentDirections.findIndex((direction) => direction.id === id);
    if (index >= 0) developmentDirections.splice(index, 1);
  }
}
