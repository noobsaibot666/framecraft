import type { AnalysisResult } from "@/lib/analyzeImage";

export interface GeneratedPrompt {
  title: string;
  prompt: string;
  use_case: string;
  tags: string[];
  aspect_ratio: string;
}

export interface SuggestedRecipe {
  title: string;
  description: string;
  token_sequence: string[];
}

export interface BriefResult {
  summary: string;
  production_goal: string;
  creative_direction: string;
  tone: string;
  key_elements: string[];
  required_deliverables: string[];
  key_constraints: string[];
  risk_areas: string[];
  prompts: GeneratedPrompt[];
  suggested_recipes: SuggestedRecipe[];
}

function stripJsonFences(rawText: string): string {
  return rawText.replace(/^```[a-z]*\n?/m, "").replace(/\n?```$/m, "").trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function requireNonEmpty(value: string, field: string): string {
  if (!value.trim()) throw new Error(`AI response missing required field: ${field}`);
  return value;
}

export function parseAnalysisResult(rawText: string): AnalysisResult {
  const parsed = asRecord(JSON.parse(stripJsonFences(rawText)));
  const suggestedPrompt = requireNonEmpty(asString(parsed.suggested_prompt), "suggested_prompt");

  return {
    title: asString(parsed.title) || "Untitled analysis",
    suggested_prompt: suggestedPrompt,
    variation_prompt: asString(parsed.variation_prompt),
    style_notes: asString(parsed.style_notes),
    elements: asStringArray(parsed.elements),
    ai_look_risks: asStringArray(parsed.ai_look_risks),
    avoidance_suggestions: asStringArray(parsed.avoidance_suggestions),
    tags: asStringArray(parsed.tags),
    aspect_ratio: asString(parsed.aspect_ratio),
    quality_tier: asString(parsed.quality_tier) || "concept",
    provider: asString(parsed.provider) || "midjourney",
  };
}

function parseGeneratedPrompt(value: unknown, idx: number): GeneratedPrompt | null {
  const item = asRecord(value);
  const prompt = asString(item.prompt);
  if (!prompt.trim()) return null;

  return {
    title: asString(item.title) || `Generated Prompt ${idx + 1}`,
    prompt,
    use_case: asString(item.use_case),
    tags: asStringArray(item.tags),
    aspect_ratio: asString(item.aspect_ratio),
  };
}

function parseSuggestedRecipe(value: unknown, idx: number): SuggestedRecipe | null {
  const item = asRecord(value);
  const tokenSequence = asStringArray(item.token_sequence);
  if (tokenSequence.length === 0) return null;

  return {
    title: asString(item.title) || `Recipe ${idx + 1}`,
    description: asString(item.description),
    token_sequence: tokenSequence,
  };
}

export function parseBriefResult(rawText: string): BriefResult {
  const parsed = asRecord(JSON.parse(stripJsonFences(rawText)));
  const prompts = Array.isArray(parsed.prompts)
    ? parsed.prompts.map(parseGeneratedPrompt).filter((p): p is GeneratedPrompt => p !== null)
    : [];

  if (prompts.length === 0) throw new Error("AI response did not include any usable prompts.");

  const suggestedRecipes = Array.isArray(parsed.suggested_recipes)
    ? parsed.suggested_recipes.map(parseSuggestedRecipe).filter((r): r is SuggestedRecipe => r !== null)
    : [];

  return {
    summary: asString(parsed.summary),
    production_goal: asString(parsed.production_goal),
    creative_direction: asString(parsed.creative_direction),
    tone: asString(parsed.tone),
    key_elements: asStringArray(parsed.key_elements),
    required_deliverables: asStringArray(parsed.required_deliverables),
    key_constraints: asStringArray(parsed.key_constraints),
    risk_areas: asStringArray(parsed.risk_areas),
    prompts,
    suggested_recipes: suggestedRecipes,
  };
}
