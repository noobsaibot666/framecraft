// Persists whether the user accepted or dismissed an AI-generated suggestion
// (analyzePrompt/analyzeImage/analyzeBrief/comparisonDecision), so acceptance
// becomes a real, queryable signal instead of being thrown away — the highest-
// value unused signal in the app: an explicit human "yes, this was right."

import { getFramecraftDb } from "./dbConnection";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function now(): string {
  return new Date().toISOString();
}

export type SuggestionTool = "analyze_prompt" | "analyze_image" | "analyze_brief" | "comparison_decision";
export type SuggestionAction = "accepted" | "dismissed";

export interface SuggestionEventInput {
  tool: SuggestionTool;
  field?: string;
  action: SuggestionAction;
  suggestion?: string;
  prompt_id?: string;
  provider?: string;
}

export async function recordSuggestionFeedback(input: SuggestionEventInput): Promise<void> {
  if (!isTauri) return;
  const db = await getFramecraftDb();
  await db.execute(
    `INSERT INTO ai_suggestion_events (id, tool, field, action, suggestion, prompt_id, provider, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      generateId(),
      input.tool,
      input.field ?? null,
      input.action,
      input.suggestion ?? null,
      input.prompt_id ?? null,
      input.provider ?? null,
      now(),
    ]
  );
}

export interface SuggestionAcceptanceStat {
  tool: SuggestionTool;
  accepted: number;
  dismissed: number;
}

/** Per-tool accepted vs. dismissed counts — powers the Dashboard's "Advisor Accuracy" card. */
export async function getSuggestionAcceptanceStats(): Promise<SuggestionAcceptanceStat[]> {
  if (!isTauri) return [];
  const db = await getFramecraftDb();
  const rows = (await db.select(
    `SELECT tool, action, COUNT(*) as count
     FROM ai_suggestion_events
     GROUP BY tool, action`
  )) as Record<string, unknown>[];
  const byTool = new Map<SuggestionTool, SuggestionAcceptanceStat>();
  for (const row of rows) {
    const tool = row.tool as SuggestionTool;
    const stat = byTool.get(tool) ?? { tool, accepted: 0, dismissed: 0 };
    const count = row.count as number;
    if (row.action === "accepted") stat.accepted = count;
    else if (row.action === "dismissed") stat.dismissed = count;
    byTool.set(tool, stat);
  }
  return Array.from(byTool.values());
}
