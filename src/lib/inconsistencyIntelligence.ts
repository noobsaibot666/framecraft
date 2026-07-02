// Persists inconsistency-detector events (warned / corrected / dismissed) so
// recurring conflicts can feed back into app intelligence — e.g. a rule that
// keeps firing across a user's prompts gets surfaced as an avoidance
// recommendation, the same way built-in avoidance patterns do.

import { getFramecraftDb } from "./dbConnection";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function now(): string {
  return new Date().toISOString();
}

export type ConsistencyEventAction = "warned" | "corrected" | "dismissed" | "used";

export interface ConsistencyEventInput {
  rule_id: string;
  rule_label: string;
  suggestion?: string;
  prompt_id?: string;
  provider?: string;
  action: ConsistencyEventAction;
}

export async function recordConsistencyEvent(input: ConsistencyEventInput): Promise<void> {
  if (!isTauri) return;
  const db = await getFramecraftDb();
  await db.execute(
    `INSERT INTO inconsistency_events (id, rule_id, rule_label, suggestion, prompt_id, provider, action, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      generateId(),
      input.rule_id,
      input.rule_label,
      input.suggestion ?? null,
      input.prompt_id ?? null,
      input.provider ?? null,
      input.action,
      now(),
    ]
  );
}

export interface ConsistencyRuleFrequency {
  rule_id: string;
  rule_label: string;
  suggestion: string | null;
  count: number;
}

/** Rules that have fired most often across all prompts — the "learned" conflicts. */
export async function getTopConsistencyConflicts(limit = 5): Promise<ConsistencyRuleFrequency[]> {
  if (!isTauri) return [];
  const db = await getFramecraftDb();
  const rows = (await db.select(
    `SELECT rule_id, rule_label, suggestion, COUNT(*) as count
     FROM inconsistency_events
     GROUP BY rule_id
     ORDER BY count DESC
     LIMIT $1`,
    [limit]
  )) as Record<string, unknown>[];
  return rows.map((r) => ({
    rule_id: r.rule_id as string,
    rule_label: r.rule_label as string,
    suggestion: r.suggestion as string | null,
    count: r.count as number,
  }));
}

/** How many times this specific rule has fired before (for "seen N times before" hints). */
export async function getConsistencyRuleCount(ruleId: string): Promise<number> {
  if (!isTauri) return 0;
  const db = await getFramecraftDb();
  const rows = (await db.select(
    `SELECT COUNT(*) as count FROM inconsistency_events WHERE rule_id = $1`,
    [ruleId]
  )) as Record<string, unknown>[];
  return (rows[0]?.count as number) ?? 0;
}

/** All rule counts in one query — for showing "seen N times before" inline without N+1 lookups. */
export async function getAllConsistencyRuleCounts(): Promise<Record<string, number>> {
  if (!isTauri) return {};
  const db = await getFramecraftDb();
  const rows = (await db.select(
    `SELECT rule_id, COUNT(*) as count FROM inconsistency_events GROUP BY rule_id`
  )) as Record<string, unknown>[];
  return Object.fromEntries(rows.map((r) => [r.rule_id as string, r.count as number]));
}
