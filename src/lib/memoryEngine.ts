import type { Prompt } from "@/types";

// ─── Duplicate / Similarity Detection ────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/--\S+/g, "") // strip MJ params
      .split(/[\s,.:;]+/)
      .filter((w) => w.length > 3)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = new Set([...a].filter((w) => b.has(w)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}

export interface SimilarPrompt {
  prompt: Prompt;
  similarity: number;
}

export function findSimilarPrompts(
  promptText: string,
  candidates: Prompt[],
  threshold = 0.55,
  excludeId?: string
): SimilarPrompt[] {
  const tokens = tokenize(promptText);
  return candidates
    .filter((p) => p.id !== excludeId && p.prompt_text.trim().length > 20)
    .map((p) => ({ prompt: p, similarity: jaccardSimilarity(tokens, tokenize(p.prompt_text)) }))
    .filter((r) => r.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
}

// ─── Quality Score Delta ──────────────────────────────────────

export function scoreToQualityDelta(scoreOverall: number, isFailed: boolean): number {
  if (isFailed) return -0.08;
  if (scoreOverall >= 5) return 0.15;
  if (scoreOverall >= 4) return 0.10;
  if (scoreOverall >= 3) return 0.04;
  if (scoreOverall >= 2) return 0.00;
  return -0.03;
}
