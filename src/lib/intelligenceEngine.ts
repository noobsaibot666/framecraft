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
 * Fires when an *existing* result's score is edited (ResultDetail.tsx) —
 * previously only the initial Add Result save (recordResultOutcome above)
 * fed the learning loop, so correcting a rating afterward silently did
 * nothing. Applies only the net difference between the old and new score's
 * quality delta, not the new delta on its own — calling recordResultOutcome
 * again here would re-add the full delta on every re-save (and every
 * unrelated edit — notes, artifacts) and let a token's quality score be
 * farmed upward just by re-saving. A no-op when the score didn't change.
 */
export async function recordResultRescore(
  promptText: string,
  oldScoreOverall: number,
  oldIsFailed: boolean,
  newScoreOverall: number,
  newIsFailed: boolean
): Promise<void> {
  if (oldScoreOverall === newScoreOverall && oldIsFailed === newIsFailed) return;
  const netDelta = scoreToQualityDelta(newScoreOverall, newIsFailed) - scoreToQualityDelta(oldScoreOverall, oldIsFailed);
  await Promise.all([
    Math.abs(netDelta) >= 0.001 ? updateTokenQualityFromResult(promptText, netDelta) : Promise.resolve(),
    // co-occurrence is a running average, not a delta accumulator — re-running
    // it against the corrected score is a reasonable additional data point,
    // just not a perfectly weighted "undo the old value" (no decrement API
    // exists for it). Documented limitation, not silently ignored.
    updateCoOccurrences(promptText, newScoreOverall),
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
 *
 * correction_prompt is deliberately left unset here: decision.reuse[] is a
 * separate, unordered list of elements that worked in the *winning* variant
 * overall — it has no per-item correspondence to a given decision.avoid[]
 * entry, so attaching it as "the fix" for that specific risk misrepresents
 * proven-good content as an avoidance correction (it previously surfaced as
 * an "Add correction" button on the risk card, appending reuse-worthy,
 * positive-signal text into the prompt's avoidance notes). reuse[] remains
 * visible in Comparison Lab's own decision view; it isn't lost by omitting
 * it here.
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

  for (const text of items) {
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key); // avoid inserting near-duplicates within the same decision
    await createAvoidancePattern({
      label: text.slice(0, 60),
      artifact_type: slugify(text).slice(0, 40) || "learned_lesson",
      severity: "medium",
      description: text,
    }).catch(() => {});
  }
}
