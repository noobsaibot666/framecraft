// Persists which suggested near-duplicate prompt the user dismissed
// (memoryEngine.ts's findSimilarPrompts, rendered as CraftPrompt.tsx's
// "Similar prompts found" banner), keyed by the pair (source prompt being
// edited, candidate it was compared against), so a dismissal survives
// reopening the same saved prompt later instead of resetting on every
// debounced recompute.

import { getFramecraftDb } from "./dbConnection";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function now(): string {
  return new Date().toISOString();
}

export async function recordDuplicateDismissed(sourcePromptId: string, candidatePromptId: string): Promise<void> {
  if (!isTauri) return;
  const db = await getFramecraftDb();
  await db.execute(
    `INSERT INTO duplicate_dismissals (id, source_prompt_id, candidate_prompt_id, created_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(source_prompt_id, candidate_prompt_id) DO NOTHING`,
    [generateId(), sourcePromptId, candidatePromptId, now()]
  );
}

/** Candidate ids previously dismissed for this source prompt — filter these out of future findSimilarPrompts results. */
export async function getDismissedDuplicateIds(sourcePromptId: string): Promise<Set<string>> {
  if (!isTauri) return new Set();
  const db = await getFramecraftDb();
  const rows = (await db.select(
    `SELECT candidate_prompt_id FROM duplicate_dismissals WHERE source_prompt_id = $1`,
    [sourcePromptId]
  )) as { candidate_prompt_id: string }[];
  return new Set(rows.map((r) => r.candidate_prompt_id));
}
