import { scoreToQualityDelta } from "./memoryEngine";
import { updateCoOccurrences } from "./tokenPatterns";
import { updateTokenQualityFromResult, recomputePromptResultSummary, getAvoidancePatterns, createAvoidancePattern } from "./db";
import type { ComparisonDecision } from "./comparisonDecision";
import { slugify } from "./utils";

/**
 * Single entry point for every "learns from usage" trigger in the app — see
 * CLAUDE.md § Application intelligence and docs/features/intelligence.md.
 * New features that should learn from usage call through here rather than
 * orchestrating the underlying storage modules (memoryEngine/tokenPatterns/
 * db/references) directly from page code.
 */

/**
 * Fires when a result is scored and saved. Updates token quality and
 * co-occurrence signal from the same prompt text/score in one call instead
 * of three separately-orchestrated fire-and-forget calls.
 */
export async function recordResultOutcome(
  promptText: string,
  scoreOverall: number,
  isFailed: boolean
): Promise<void> {
  const delta = scoreToQualityDelta(scoreOverall, isFailed);
  await Promise.all([
    updateTokenQualityFromResult(promptText, delta),
    updateCoOccurrences(promptText, scoreOverall),
  ]);
}

/**
 * Fires after a Comparison Lab decision is applied (results' is_winner/
 * is_failed already synced by syncDecisionsToResults). Recomputes each
 * touched prompt's summary so prompt-level winner status — not just the
 * result rows — reflects the comparison outcome, the same way every other
 * result-mutation flow (ResultDetail, ResultReview) already does.
 */
export async function recordComparisonApply(promptIds: string[]): Promise<void> {
  const unique = [...new Set(promptIds)];
  await Promise.all(unique.map((id) => recomputePromptResultSummary(id)));
}

/**
 * Fires when a Comparison Lab AI decision is saved as a session's outcome.
 * Turns decision.avoid[] into structured, deduped avoidance_patterns rows
 * (is_builtin = 0) via the existing createAvoidancePattern — previously this
 * judgment was captured once and only ever displayed as text, never reused.
 */
export async function recordComparisonLesson(decision: ComparisonDecision): Promise<void> {
  const items = decision.avoid.map((item) => item.trim()).filter(Boolean);
  if (items.length === 0) return;

  const existing = await getAvoidancePatterns().catch(() => []);
  const seen = new Set(
    existing
      .filter((p) => !p.is_builtin)
      .map((p) => (p.description ?? "").trim().toLowerCase())
  );

  const correction = decision.reuse.join("; ") || decision.why_stronger || undefined;

  for (const text of items) {
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key); // avoid inserting near-duplicates within the same decision
    await createAvoidancePattern({
      label: text.slice(0, 60),
      artifact_type: slugify(text).slice(0, 40) || "learned_lesson",
      severity: "medium",
      description: text,
      correction_prompt: correction,
    }).catch(() => {});
  }
}
