import type { Campaign, CampaignStatus, Project } from "@/types";
import { getFramecraftDb } from "./dbConnection";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function now(): string {
  return new Date().toISOString();
}

function rowToCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: row.id as string,
    title: row.title as string,
    client: row.client as string | undefined,
    brief: row.brief as string | undefined,
    status: (row.status as CampaignStatus) ?? "active",
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    project_count: row.project_count as number | undefined,
    winner_count: row.winner_count as number | undefined,
  };
}

export async function getCampaigns(): Promise<Campaign[]> {
  if (!isTauri) return [];
  const db = await getFramecraftDb();
  // Try with project counts (requires migration 018 campaign_id on projects)
  try {
    const rows = await db.select(
      `SELECT c.*,
              COUNT(DISTINCT p.id) AS project_count,
              SUM(CASE WHEN p.status = 'delivered' THEN 1 ELSE 0 END) AS winner_count
       FROM campaigns c
       LEFT JOIN projects p ON p.campaign_id = c.id
       GROUP BY c.id
       ORDER BY c.created_at DESC`
    );
    return (rows as Record<string, unknown>[]).map(rowToCampaign);
  } catch {
    // campaign_id column not yet on projects — return campaigns without counts
    try {
      const rows = await db.select(
        `SELECT *, 0 AS project_count, 0 AS winner_count FROM campaigns ORDER BY created_at DESC`
      );
      return (rows as Record<string, unknown>[]).map(rowToCampaign);
    } catch {
      return [];
    }
  }
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  if (!isTauri) return null;
  const db = await getFramecraftDb();
  // Try with project counts (requires migration 018 campaign_id on projects)
  try {
    const rows = await db.select(
      `SELECT c.*,
              COUNT(DISTINCT p.id) AS project_count,
              SUM(CASE WHEN p.status = 'delivered' THEN 1 ELSE 0 END) AS winner_count
       FROM campaigns c
       LEFT JOIN projects p ON p.campaign_id = c.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [id]
    );
    const typed = rows as Record<string, unknown>[];
    return typed.length > 0 ? rowToCampaign(typed[0]) : null;
  } catch {
    // campaign_id column not yet on projects — fall back without JOIN
    try {
      const rows = await db.select(
        `SELECT *, 0 AS project_count, 0 AS winner_count FROM campaigns WHERE id = $1`,
        [id]
      );
      const typed = rows as Record<string, unknown>[];
      return typed.length > 0 ? rowToCampaign(typed[0]) : null;
    } catch {
      return null;
    }
  }
}

export async function createCampaign(input: {
  title: string;
  client?: string;
  brief?: string;
}): Promise<Campaign> {
  const id = generateId();
  const ts = now();
  const result: Campaign = {
    id,
    title: input.title,
    client: input.client,
    brief: input.brief,
    status: "active",
    created_at: ts,
    updated_at: ts,
    project_count: 0,
    winner_count: 0,
  };
  if (!isTauri) return result;
  const db = await getFramecraftDb();
  try {
    await db.execute(
      `INSERT INTO campaigns (id, title, client, brief, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', $5, $6)`,
      [id, input.title, input.client ?? null, input.brief ?? null, ts, ts]
    );
  } catch (err) {
    throw new Error(String(err));
  }
  return result;
}

export async function updateCampaign(
  id: string,
  patch: Partial<Pick<Campaign, "title" | "client" | "brief" | "status">>
): Promise<void> {
  if (!isTauri) return;
  const db = await getFramecraftDb();
  const ts = now();
  const sets: string[] = ["updated_at = $1"];
  const vals: unknown[] = [ts];
  let i = 2;
  if (patch.title !== undefined) { sets.push(`title = $${i++}`); vals.push(patch.title); }
  if (patch.client !== undefined) { sets.push(`client = $${i++}`); vals.push(patch.client); }
  if (patch.brief !== undefined) { sets.push(`brief = $${i++}`); vals.push(patch.brief); }
  if (patch.status !== undefined) { sets.push(`status = $${i++}`); vals.push(patch.status); }
  vals.push(id);
  try {
    await db.execute(`UPDATE campaigns SET ${sets.join(", ")} WHERE id = $${i}`, vals);
  } catch (err) {
    throw new Error(String(err));
  }
}

export async function deleteCampaign(id: string): Promise<void> {
  if (!isTauri) return;
  const db = await getFramecraftDb();
  try {
    // Projects with this campaign_id are set NULL by the FK ON DELETE SET NULL
    await db.execute("DELETE FROM campaigns WHERE id = $1", [id]);
  } catch (err) {
    throw new Error(String(err));
  }
}

export async function getProjectsForCampaign(campaignId: string): Promise<Project[]> {
  if (!isTauri) return [];
  try {
    const db = await getFramecraftDb();
    const rows = await db.select(
      `SELECT p.*,
              (SELECT COUNT(*) FROM project_prompts pp WHERE pp.project_id = p.id) AS prompt_count,
              (SELECT COUNT(*) FROM project_results pr WHERE pr.project_id = p.id) AS result_count,
              (SELECT COUNT(*) FROM project_prompts pp2 JOIN prompts pm ON pp2.prompt_id = pm.id WHERE pp2.project_id = p.id AND pm.is_winner = 1) AS winner_count
       FROM projects p
       WHERE p.campaign_id = $1
       ORDER BY p.created_at DESC`,
      [campaignId]
    );
    return (rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    client: r.client as string | undefined,
    campaign: r.campaign as string | undefined,
    campaign_id: r.campaign_id as string | undefined,
    status: (r.status as Project["status"]) ?? "draft",
    brief_text: r.brief_text as string | undefined,
    production_goal: r.production_goal as string | undefined,
    category: r.category as Project["category"],
    tags: r.tags ? (JSON.parse(r.tags as string) as string[]) : [],
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    prompt_count: (r.prompt_count as number) ?? 0,
    result_count: (r.result_count as number) ?? 0,
    winner_count: (r.winner_count as number) ?? 0,
  }));
  } catch {
    return [];
  }
}

export async function searchCampaigns(query: string): Promise<Campaign[]> {
  if (!isTauri) return [];
  const q = query.toLowerCase().trim();
  if (!q) return getCampaigns();
  try {
    const db = await getFramecraftDb();
    const rows = (await db.select(
      `SELECT * FROM campaigns
       WHERE lower(title) LIKE $1 OR lower(client) LIKE $1
       ORDER BY created_at DESC LIMIT 10`,
      [`%${q}%`]
    )) as Record<string, unknown>[];
    return rows.map(rowToCampaign);
  } catch {
    return [];
  }
}

export async function setProjectCampaign(
  projectId: string,
  campaignId: string | null
): Promise<void> {
  if (!isTauri) return;
  try {
    const db = await getFramecraftDb();
    await db.execute(
      `UPDATE projects SET campaign_id = $1, updated_at = $2 WHERE id = $3`,
      [campaignId, now(), projectId]
    );
  } catch {
    // migration 018 column not yet applied — non-fatal
  }
}
