import type { ComparisonSourceRole, ComparisonType, Provider } from "@/types";

export type { ComparisonSourceRole, ComparisonType } from "@/types";

export interface ComparisonTypeDefinition {
  id: ComparisonType;
  label: string;
  purpose: string;
}

export const COMPARISON_TYPES: ComparisonTypeDefinition[] = [
  { id: "result_result", label: "Result vs Result", purpose: "Choose the strongest generated output." },
  { id: "reference_result", label: "Reference vs Result", purpose: "Check whether a result follows the intended visual direction." },
  { id: "provider_provider", label: "Provider vs Provider", purpose: "Compare how providers interpret the same production goal." },
  { id: "prompt_version", label: "Prompt Version vs Version", purpose: "Decide which prompt revision produces the stronger output." },
  { id: "direction_result", label: "Direction vs Result", purpose: "Judge whether results deliver the project's chosen creative direction." },
  { id: "sref_sref", label: "SREF vs SREF", purpose: "Compare how different style references shape the same idea." },
  { id: "ai_risk", label: "AI-Look Risk", purpose: "Rank results by how synthetic they read — keep the most authentic." },
];

export interface ComparisonOutcomeSlot {
  label: string;
  provider: Provider;
  promptVersion: number;
  overallScore: number;
  isWinner: boolean;
  isRejected: boolean;
  notes?: string;
}

const providerLabels: Record<Provider, string> = {
  midjourney: "Midjourney",
  dalle: "DALL-E",
  stable_diffusion: "Stable Diffusion",
  firefly: "Adobe Firefly",
  ideogram: "Ideogram",
  flux: "Flux",
  nano_banana: "Nano Banana Pro",
  gpt_image: "GPT Image 2",
  seedance: "Seedance",
  kling: "Kling",
  runway: "Runway",
  higgsfield: "Higgsfield",
  other: "Other",
};

export function getComparisonDefinition(type: ComparisonType): ComparisonTypeDefinition {
  return COMPARISON_TYPES.find((item) => item.id === type) ?? COMPARISON_TYPES[0];
}

export function getComparisonRoles(type: ComparisonType, count: number): ComparisonSourceRole[] {
  if (type === "reference_result") {
    return Array.from({ length: count }, (_, index) => index === 0 ? "reference" : "result");
  }
  if (type === "provider_provider") {
    const roles: ComparisonSourceRole[] = ["provider_a", "provider_b", "provider_c", "provider_d"];
    return roles.slice(0, count);
  }
  if (type === "prompt_version") {
    const roles: ComparisonSourceRole[] = ["version_a", "version_b", "version_c", "version_d"];
    return roles.slice(0, count);
  }
  if (type === "sref_sref") {
    const roles: ComparisonSourceRole[] = ["sref_a", "sref_b", "sref_c", "sref_d"];
    return roles.slice(0, count);
  }
  // direction_result and ai_risk compare plain results — the direction text /
  // AI-risk scores provide the judging context, not the slot roles.
  return Array.from({ length: count }, () => "result");
}

export function formatComparisonRole(role: ComparisonSourceRole): string {
  const labels: Record<ComparisonSourceRole, string> = {
    result: "Result",
    reference: "Reference",
    provider_a: "Provider A",
    provider_b: "Provider B",
    provider_c: "Provider C",
    provider_d: "Provider D",
    version_a: "Version A",
    version_b: "Version B",
    version_c: "Version C",
    version_d: "Version D",
    sref_a: "SREF A",
    sref_b: "SREF B",
    sref_c: "SREF C",
    sref_d: "SREF D",
  };
  return labels[role];
}

export function buildComparisonOutcome(type: ComparisonType, slots: ComparisonOutcomeSlot[]): string {
  const decisions = slots.filter((slot) => slot.isWinner || slot.isRejected);
  if (decisions.length === 0) return "";

  const evidence = slots.map((slot) => {
    const score = slot.overallScore > 0 ? `, ${slot.overallScore}/5` : "";
    return `${slot.label} (${providerLabels[slot.provider]}, v${slot.promptVersion}${score})`;
  }).join("; ");
  const winner = slots.find((slot) => slot.isWinner);
  const rejected = slots.filter((slot) => slot.isRejected);
  const notes = decisions.map((slot) => slot.notes?.trim()).filter(Boolean);

  return [
    getComparisonDefinition(type).label,
    winner ? `Winner: ${winner.label}` : undefined,
    rejected.length > 0 ? `Rejected: ${rejected.map((slot) => slot.label).join(", ")}` : undefined,
    `Evidence: ${evidence}`,
    notes.length > 0 ? `Decision notes: ${notes.join(" | ")}` : undefined,
  ].filter(Boolean).join(". ");
}
