// AI decision summary for Advanced Compare (doc 04 §3) — given the filled
// comparison slots, produce the structured judgement the doc asks for:
// stronger option, why, what failed, what to reuse, what to avoid, and the
// one-line lesson worth storing as library intelligence.

import { chatComplete } from "./aiClient";
import { pickAvailableModel } from "./aiConfig";
import { getComparisonDefinition } from "./comparisonWorkflow";
import type { ComparisonResult, ComparisonType } from "@/types";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface ComparisonDecisionSlot {
  label: string;
  result: ComparisonResult;
  isWinner: boolean;
  isRejected: boolean;
  notes?: string;
}

export interface ComparisonDecision {
  stronger_option: string;
  why_stronger: string;
  what_failed: string;
  reuse: string[];
  avoid: string[];
  intelligence: string;
}

export const EMPTY_DECISION: ComparisonDecision = {
  stronger_option: "",
  why_stronger: "",
  what_failed: "",
  reuse: [],
  avoid: [],
  intelligence: "",
};

const DECISION_SYSTEM = `You are a senior creative director making a production decision between compared AI-generated outputs.
Base your judgement strictly on the evidence provided (scores, flags, notes, context) — never invent visual details you were not given.
Return ONLY a valid JSON object:
{
  "stronger_option": "the slot label of the strongest option, or 'none' if nothing qualifies",
  "why_stronger": "1-2 sentences: what makes it stronger",
  "what_failed": "1-2 sentences: what failed or fell short in the weaker options",
  "reuse": ["specific element worth reusing in future prompts (max 3)"],
  "avoid": ["specific element to avoid in future prompts (max 3)"],
  "intelligence": "one-line lesson worth storing as production intelligence"
}
Return only the JSON — no markdown fences, no preamble.`;

/** Evidence block for the decision model. Pure — unit tested. */
export function buildDecisionContext(
  type: ComparisonType,
  slots: ComparisonDecisionSlot[],
  directionContext?: string
): string {
  const definition = getComparisonDefinition(type);
  const lines: string[] = [
    `Comparison mode: ${definition.label} — ${definition.purpose}`,
  ];
  if (type === "direction_result" && directionContext?.trim()) {
    lines.push(`Project creative direction to judge against: ${directionContext.trim()}`);
  }
  if (type === "ai_risk") {
    lines.push("Judge primarily on AI-look risk: lower risk and more authentic, photographic character wins.");
  }
  for (const slot of slots) {
    const r = slot.result;
    lines.push(
      [
        `- ${slot.label}: "${r.prompt_title}" (${r.prompt_provider}, v${r.prompt_version}${r.prompt_style_ref ? `, sref ${r.prompt_style_ref}` : ""})`,
        `scores: overall ${r.score_overall}/5, realism ${r.score_realism}/5, brand fit ${r.score_brand_fit}/5, composition ${r.score_composition}/5, lighting ${r.score_lighting}/5, AI risk ${r.score_ai_risk}/5`,
        slot.isWinner ? "marked WINNER by user" : "",
        slot.isRejected ? "marked REJECTED by user" : "",
        slot.notes?.trim() ? `user notes: ${slot.notes.trim()}` : "",
      ].filter(Boolean).join(" | ")
    );
  }
  return lines.join("\n");
}

export function parseComparisonDecision(raw: string): ComparisonDecision {
  try {
    const json = JSON.parse(raw.trim()) as Partial<Record<keyof ComparisonDecision, unknown>>;
    const toList = (value: unknown) =>
      Array.isArray(value) ? value.slice(0, 3).map(String).map((s) => s.trim()).filter(Boolean) : [];
    return {
      stronger_option: typeof json.stronger_option === "string" ? json.stronger_option.trim() : "",
      why_stronger: typeof json.why_stronger === "string" ? json.why_stronger.trim() : "",
      what_failed: typeof json.what_failed === "string" ? json.what_failed.trim() : "",
      reuse: toList(json.reuse),
      avoid: toList(json.avoid),
      intelligence: typeof json.intelligence === "string" ? json.intelligence.trim() : "",
    };
  } catch {
    return EMPTY_DECISION;
  }
}

export function isEmptyDecision(decision: ComparisonDecision): boolean {
  return !decision.stronger_option && !decision.why_stronger && !decision.what_failed
    && decision.reuse.length === 0 && decision.avoid.length === 0 && !decision.intelligence;
}

/**
 * Serialize a decision into the outcome text stored on the session — this is
 * what feeds comparison intelligence (assistant context, Direction Studio).
 */
export function formatDecisionOutcome(decision: ComparisonDecision): string {
  return [
    decision.stronger_option && decision.stronger_option.toLowerCase() !== "none"
      ? `Stronger: ${decision.stronger_option}`
      : "",
    decision.why_stronger ? `Why: ${decision.why_stronger}` : "",
    decision.what_failed ? `Failed: ${decision.what_failed}` : "",
    decision.reuse.length ? `Reuse: ${decision.reuse.join("; ")}` : "",
    decision.avoid.length ? `Avoid: ${decision.avoid.join("; ")}` : "",
    decision.intelligence ? `Intelligence: ${decision.intelligence}` : "",
  ].filter(Boolean).join(". ");
}

export async function generateComparisonDecision(opts: {
  type: ComparisonType;
  slots: ComparisonDecisionSlot[];
  directionContext?: string;
}): Promise<ComparisonDecision> {
  if (!isTauri) return EMPTY_DECISION;
  if (opts.slots.length < 2) throw new Error("Fill at least two comparison slots first.");
  const model = pickAvailableModel();
  if (!model) throw new Error("Add an OpenAI or Anthropic API key in Settings.");

  const raw = await chatComplete(model, {
    system: DECISION_SYSTEM,
    user: buildDecisionContext(opts.type, opts.slots, opts.directionContext),
    maxTokens: 768,
  });
  return parseComparisonDecision(raw);
}
