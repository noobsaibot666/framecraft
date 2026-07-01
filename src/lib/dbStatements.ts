import type { AtomicStatement } from "./dbTransaction";

export interface ProjectStatementInput {
  title: string;
  client?: string;
  campaign?: string;
  campaign_id?: string;
  status?: string;
  project_type?: string;
  intended_output?: string;
  image_needs?: string;
  video_needs?: string;
  aspect_ratios?: string[];
  provider_targets?: string[];
  visual_direction?: string;
  constraints?: string;
  creative_goals?: string;
  brief_text?: string;
  production_goal?: string;
  category?: string;
  tags?: string[];
  notes?: string;
}

export function buildCreateProjectStatements(
  data: ProjectStatementInput,
  id: string,
  timestamp: string
): AtomicStatement[] {
  return [{
    operation: "execute",
    sql: `INSERT INTO projects
      (id, title, client, campaign, status, brief_text, production_goal,
       category, tags, notes, project_type, intended_output, image_needs,
       video_needs, aspect_ratios, provider_targets, visual_direction,
       constraints, creative_goals, campaign_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
    bindValues: [
      id,
      data.title,
      data.client ?? null,
      data.campaign ?? null,
      data.status ?? "draft",
      data.brief_text ?? null,
      data.production_goal ?? null,
      data.category ?? null,
      data.tags ? JSON.stringify(data.tags) : null,
      data.notes ?? null,
      data.project_type ?? null,
      data.intended_output ?? null,
      data.image_needs ?? null,
      data.video_needs ?? null,
      data.aspect_ratios ? JSON.stringify(data.aspect_ratios) : null,
      data.provider_targets ? JSON.stringify(data.provider_targets) : null,
      data.visual_direction ?? null,
      data.constraints ?? null,
      data.creative_goals ?? null,
      data.campaign_id ?? null,
      timestamp,
      timestamp,
    ],
  }];
}

export interface PromptBatchPatch {
  rating?: number;
  is_winner?: boolean;
  is_failed?: boolean;
  tags?: string[];
}

export function buildBatchUpdatePromptStatements(
  ids: string[],
  patch: PromptBatchPatch,
  timestamp: string
): AtomicStatement[] {
  return ids.map((id) => {
    const sets: string[] = [];
    const values: unknown[] = [id];
    const add = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };
    if (patch.rating !== undefined) add("rating", patch.rating);
    if (patch.is_winner !== undefined) add("is_winner", patch.is_winner ? 1 : 0);
    if (patch.is_failed !== undefined) add("is_failed", patch.is_failed ? 1 : 0);
    if (patch.tags !== undefined) add("tags", JSON.stringify(patch.tags));
    add("updated_at", timestamp);
    return {
      operation: "execute",
      sql: `UPDATE prompts SET ${sets.join(", ")} WHERE id = $1`,
      bindValues: values,
    };
  });
}

export function buildAddComparisonItemStatements(
  id: string,
  sessionId: string,
  resultId: string,
  position: number,
  sourceRole: string,
  timestamp: string
): AtomicStatement[] {
  return [
    {
      operation: "execute",
      sql: `INSERT INTO comparison_items
        (id, session_id, result_id, position, source_role, is_winner, is_rejected, created_at)
       VALUES ($1, $2, $3, $4, $5, 0, 0, $6)
       ON CONFLICT (session_id, result_id) DO UPDATE SET
         position = excluded.position, source_role = excluded.source_role`,
      bindValues: [id, sessionId, resultId, position, sourceRole, timestamp],
    },
    {
      operation: "query",
      sql: "SELECT id FROM comparison_items WHERE session_id = $1 AND result_id = $2",
      bindValues: [sessionId, resultId],
    },
    {
      operation: "execute",
      sql: "UPDATE comparison_sessions SET updated_at = $1 WHERE id = $2",
      bindValues: [timestamp, sessionId],
    },
  ];
}

export function buildSetItemWinnerStatements(
  itemId: string,
  sessionId: string,
  timestamp: string
): AtomicStatement[] {
  return [
    {
      operation: "execute",
      sql: `UPDATE comparison_items SET is_winner = 0
            WHERE session_id = $1
              AND EXISTS (
                SELECT 1 FROM comparison_items
                WHERE id = $2 AND session_id = $1
              )`,
      bindValues: [sessionId, itemId],
    },
    {
      operation: "execute",
      sql: "UPDATE comparison_items SET is_winner = 1, is_rejected = 0 WHERE id = $1 AND session_id = $2",
      bindValues: [itemId, sessionId],
    },
    {
      operation: "execute",
      sql: `UPDATE comparison_sessions SET updated_at = $1
            WHERE id = $2
              AND EXISTS (
                SELECT 1 FROM comparison_items
                WHERE id = $3 AND session_id = $2
              )`,
      bindValues: [timestamp, sessionId, itemId],
    },
  ];
}

export function buildClearItemWinnerStatements(
  sessionId: string,
  timestamp: string
): AtomicStatement[] {
  return [
    {
      operation: "execute",
      sql: "UPDATE comparison_items SET is_winner = 0 WHERE session_id = $1",
      bindValues: [sessionId],
    },
    {
      operation: "execute",
      sql: "UPDATE comparison_sessions SET updated_at = $1 WHERE id = $2",
      bindValues: [timestamp, sessionId],
    },
  ];
}

export function buildSetItemRejectedStatements(
  itemId: string,
  isRejected: boolean
): AtomicStatement[] {
  return [{
    operation: "execute",
    sql: "UPDATE comparison_items SET is_rejected = $1, is_winner = CASE WHEN $1 = 1 THEN 0 ELSE is_winner END WHERE id = $2",
    bindValues: [isRejected ? 1 : 0, itemId],
  }];
}

export function buildSyncDecisionStatements(sessionId: string): AtomicStatement[] {
  return [{
    operation: "execute",
    sql: `UPDATE results SET
            is_winner = (SELECT ci.is_winner FROM comparison_items ci WHERE ci.session_id = $1 AND ci.result_id = results.id),
            is_failed = (SELECT ci.is_rejected FROM comparison_items ci WHERE ci.session_id = $1 AND ci.result_id = results.id)
          WHERE id IN (
            SELECT result_id FROM comparison_items
            WHERE session_id = $1 AND (is_winner = 1 OR is_rejected = 1)
          )`,
    bindValues: [sessionId],
  }];
}

export type ProjectRelationship = "prompts" | "results" | "references";

const relationshipColumns: Record<ProjectRelationship, { table: string; childColumn: string }> = {
  prompts: { table: "project_prompts", childColumn: "prompt_id" },
  results: { table: "project_results", childColumn: "result_id" },
  references: { table: "project_references", childColumn: "reference_id" },
};

export function buildProjectRelationshipStatements(
  relationship: ProjectRelationship,
  projectId: string,
  childId: string,
  timestamp: string
): AtomicStatement[] {
  const { table, childColumn } = relationshipColumns[relationship];
  return [
    {
      operation: "execute",
      sql: `INSERT OR IGNORE INTO ${table} (project_id, ${childColumn}) VALUES ($1, $2)`,
      bindValues: [projectId, childId],
    },
    {
      operation: "execute",
      sql: "UPDATE projects SET updated_at = $1 WHERE id = $2",
      bindValues: [timestamp, projectId],
    },
  ];
}
