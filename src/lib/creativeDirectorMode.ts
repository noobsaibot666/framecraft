// Creative Director Mode (review doc 04 §4) — early project strategy.
// One structured generation with review-and-save, not a chatbot: the model
// returns the eight strategy fields the doc names, the user edits/saves them
// on the project (projects.creative_strategy, migration 031), and the saved
// strategy feeds Direction Studio, Prompt Craft and the project assistant.

import { callDirectionModel } from "./creativeDirectionGeneration";
import { getFramecraftDb } from "./dbConnection";
import type { AIModel } from "./aiConfig";
import type { Project } from "@/types";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface CreativeStrategy {
  campaign_idea: string;
  concepts: string[];
  creative_directions: string[];
  visual_aesthetics: string;
  brand_connection: string;
  product_message: string;
  audience: string;
  execution_direction: string;
}

export const EMPTY_STRATEGY: CreativeStrategy = {
  campaign_idea: "",
  concepts: [],
  creative_directions: [],
  visual_aesthetics: "",
  brand_connection: "",
  product_message: "",
  audience: "",
  execution_direction: "",
};

const STRATEGY_JSON_SHAPE = `{
  "campaign_idea": "the central campaign idea in 1-2 sentences",
  "concepts": ["distinct executable concept (2-3 items)"],
  "creative_directions": ["short named creative direction with its visual world (2-3 items)"],
  "visual_aesthetics": "the visual language: composition, material, light, color, realism level",
  "brand_connection": "how the work expresses the brand",
  "product_message": "the single clear product or campaign message",
  "audience": "who this is for and what moves them",
  "execution_direction": "concrete production guidance: formats, providers, references, constraints"
}`;

/** Build the one-shot strategy prompt. Pure — unit tested. */
export function buildStrategyPrompt(project: Project, seed?: string): string {
  const context = [
    `Project: ${project.title}`,
    project.client ? `Client: ${project.client}` : "",
    project.campaign ? `Campaign: ${project.campaign}` : "",
    project.project_type ? `Project type: ${project.project_type}` : "",
    project.brief_text ? `Brief: ${project.brief_text}` : "",
    project.production_goal ? `Production goal: ${project.production_goal}` : "",
    project.category ? `Category: ${project.category}` : "",
    project.visual_direction ? `Current visual direction: ${project.visual_direction}` : "",
    project.constraints ? `Constraints: ${project.constraints}` : "",
    project.provider_targets?.length ? `Providers: ${project.provider_targets.join(", ")}` : "",
    seed?.trim() ? `Starting point from the user: ${seed.trim()}` : "",
  ].filter(Boolean).join("\n");

  return `You are a senior creative director defining the early strategy for an advertising production project.

Work strictly from the project facts below. Be specific and opinionated — name concrete visual worlds, materials, and messages. Never produce generic agency filler ("engaging content", "resonates with audiences"); every field must be actionable by a production team tomorrow.

${context}

Return ONLY valid JSON in this exact structure:
${STRATEGY_JSON_SHAPE}`;
}

export function parseCreativeStrategy(raw: string): CreativeStrategy {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const json = JSON.parse(cleaned) as Partial<Record<keyof CreativeStrategy, unknown>>;
    const toText = (value: unknown) => (typeof value === "string" ? value.trim() : "");
    const toList = (value: unknown) =>
      Array.isArray(value) ? value.slice(0, 3).map(String).map((s) => s.trim()).filter(Boolean) : [];
    return {
      campaign_idea: toText(json.campaign_idea),
      concepts: toList(json.concepts),
      creative_directions: toList(json.creative_directions),
      visual_aesthetics: toText(json.visual_aesthetics),
      brand_connection: toText(json.brand_connection),
      product_message: toText(json.product_message),
      audience: toText(json.audience),
      execution_direction: toText(json.execution_direction),
    };
  } catch {
    return EMPTY_STRATEGY;
  }
}

export function isEmptyStrategy(strategy: CreativeStrategy): boolean {
  return !strategy.campaign_idea && strategy.concepts.length === 0
    && strategy.creative_directions.length === 0 && !strategy.visual_aesthetics
    && !strategy.brand_connection && !strategy.product_message
    && !strategy.audience && !strategy.execution_direction;
}

export async function generateCreativeStrategy(
  project: Project,
  model: AIModel,
  seed?: string
): Promise<CreativeStrategy> {
  const raw = await callDirectionModel(model, buildStrategyPrompt(project, seed));
  const strategy = parseCreativeStrategy(raw);
  if (isEmptyStrategy(strategy)) {
    throw new Error("The model returned no usable strategy — try again or refine the brief.");
  }
  return strategy;
}

// ─── Persistence (projects.creative_strategy) ─────────────────

const _devStrategies = new Map<string, string>();

export async function saveCreativeStrategy(projectId: string, strategy: CreativeStrategy): Promise<void> {
  const json = JSON.stringify(strategy);
  if (!isTauri) {
    _devStrategies.set(projectId, json);
    return;
  }
  const db = await getFramecraftDb();
  await db.execute(
    "UPDATE projects SET creative_strategy = $1, updated_at = $2 WHERE id = $3",
    [json, new Date().toISOString(), projectId]
  );
}

export async function clearCreativeStrategy(projectId: string): Promise<void> {
  if (!isTauri) {
    _devStrategies.delete(projectId);
    return;
  }
  const db = await getFramecraftDb();
  await db.execute(
    "UPDATE projects SET creative_strategy = NULL, updated_at = $1 WHERE id = $2",
    [new Date().toISOString(), projectId]
  );
}

/** Parse a stored strategy JSON string; null when absent or corrupt. */
export function readStoredStrategy(raw: string | undefined | null): CreativeStrategy | null {
  if (!raw?.trim()) return null;
  const parsed = parseCreativeStrategy(raw);
  return isEmptyStrategy(parsed) ? null : parsed;
}

export async function getCreativeStrategy(projectId: string): Promise<CreativeStrategy | null> {
  if (!isTauri) return readStoredStrategy(_devStrategies.get(projectId));
  const db = await getFramecraftDb();
  const rows = (await db.select(
    "SELECT creative_strategy FROM projects WHERE id = $1",
    [projectId]
  )) as { creative_strategy: string | null }[];
  return readStoredStrategy(rows[0]?.creative_strategy);
}

/**
 * One text block for downstream AI context (Direction Studio, Prompt Craft
 * analysis, project assistant). Pure.
 */
export function formatStrategyForContext(strategy: CreativeStrategy): string {
  const lines = [
    strategy.campaign_idea ? `Campaign idea: ${strategy.campaign_idea}` : "",
    strategy.concepts.length ? `Concepts: ${strategy.concepts.join(" | ")}` : "",
    strategy.creative_directions.length ? `Creative directions: ${strategy.creative_directions.join(" | ")}` : "",
    strategy.visual_aesthetics ? `Visual aesthetics: ${strategy.visual_aesthetics}` : "",
    strategy.brand_connection ? `Brand connection: ${strategy.brand_connection}` : "",
    strategy.product_message ? `Product message: ${strategy.product_message}` : "",
    strategy.audience ? `Audience: ${strategy.audience}` : "",
    strategy.execution_direction ? `Execution direction: ${strategy.execution_direction}` : "",
  ].filter(Boolean);
  if (!lines.length) return "";
  return ["Creative strategy for this project (respect it in all suggestions):", ...lines].join("\n");
}
