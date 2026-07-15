// Checks whether avoidanceEngine.ts's static keyword-trigger risk rules
// actually correlate with real result failures — the AI-look risk score has
// never learned from outcomes before this. detectRisks() is re-run against
// every prompt with results (a pure recompute, same idiom as
// memoryEngine.ts's findSimilarPrompts) and joined against results.is_failed
// to see which rules are empirically predictive vs. which are noise.

import { getFramecraftDb } from "./dbConnection";
import { getAvoidancePatterns } from "./db";
import { detectRisks } from "./avoidanceEngine";
import type { AvoidancePattern } from "@/types";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// Below this many results triggering a pattern, the failure rate is too
// noisy to report as a real correlation.
const MIN_SAMPLE = 3;

export interface PatternFailureCorrelation {
  pattern_id: string;
  artifact_type: string;
  label: string;
  triggered_count: number;
  triggered_failure_rate: number;
  baseline_failure_rate: number;
  /** triggered_failure_rate / baseline_failure_rate — >1 means the rule is predictive. */
  lift: number;
}

/** Pure aggregation step, kept separate from the DB fetch so it's unit-testable without a Tauri context. */
export function correlateRiskPatterns(
  prompts: { id: string; prompt_text: string }[],
  resultStatsByPrompt: Map<string, { total: number; failed: number }>,
  patterns: AvoidancePattern[],
  baselineFailureRate: number
): PatternFailureCorrelation[] {
  const perPattern = new Map<string, { total: number; failed: number }>();
  for (const prompt of prompts) {
    const stats = resultStatsByPrompt.get(prompt.id);
    if (!stats || stats.total === 0) continue;
    for (const risk of detectRisks(prompt.prompt_text, patterns)) {
      const entry = perPattern.get(risk.pattern.id) ?? { total: 0, failed: 0 };
      entry.total += stats.total;
      entry.failed += stats.failed;
      perPattern.set(risk.pattern.id, entry);
    }
  }

  const correlations: PatternFailureCorrelation[] = [];
  for (const pattern of patterns) {
    const stats = perPattern.get(pattern.id);
    if (!stats || stats.total < MIN_SAMPLE) continue;
    const rate = stats.failed / stats.total;
    correlations.push({
      pattern_id: pattern.id,
      artifact_type: pattern.artifact_type,
      label: pattern.label,
      triggered_count: stats.total,
      triggered_failure_rate: Math.round(rate * 100) / 100,
      baseline_failure_rate: Math.round(baselineFailureRate * 100) / 100,
      lift: baselineFailureRate > 0 ? Math.round((rate / baselineFailureRate) * 100) / 100 : 0,
    });
  }

  return correlations.sort((a, b) => b.lift - a.lift);
}

/** Global (library-wide) correlation — mirrors dashboardHealth.ts's convention of unscoped aggregate queries. */
export async function getPatternFailureCorrelation(): Promise<PatternFailureCorrelation[]> {
  if (!isTauri) return [];
  const db = await getFramecraftDb();

  const [patterns, promptRows, statRows, baselineRows] = await Promise.all([
    getAvoidancePatterns(),
    db.select(
      `SELECT p.id, p.prompt_text FROM prompts p
       WHERE EXISTS (SELECT 1 FROM results r WHERE r.prompt_id = p.id)`
    ) as Promise<{ id: string; prompt_text: string }[]>,
    db.select(
      `SELECT prompt_id, COUNT(*) as total, SUM(CASE WHEN is_failed = 1 THEN 1 ELSE 0 END) as failed
       FROM results
       WHERE prompt_id IS NOT NULL
       GROUP BY prompt_id`
    ) as Promise<{ prompt_id: string; total: number; failed: number }[]>,
    db.select(
      `SELECT COUNT(*) as total, SUM(CASE WHEN is_failed = 1 THEN 1 ELSE 0 END) as failed FROM results`
    ) as Promise<{ total: number; failed: number }[]>,
  ]);

  const resultStatsByPrompt = new Map(statRows.map((r) => [r.prompt_id, { total: r.total, failed: r.failed }]));
  const baselineFailureRate = baselineRows[0]?.total ? baselineRows[0].failed / baselineRows[0].total : 0;

  return correlateRiskPatterns(promptRows, resultStatsByPrompt, patterns, baselineFailureRate);
}
