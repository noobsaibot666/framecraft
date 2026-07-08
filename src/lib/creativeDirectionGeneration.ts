import type { CreativeDirection, Project } from "@/types";
import { fetchProviderJson, requireValidApiKey } from "./aiClient";
import { getApiKey, type AIModel } from "./aiConfig";
import type { CreateProjectInput } from "./projects";

export type GeneratedCreativeDirection = Pick<CreativeDirection,
  "title" | "campaign_idea" | "rationale" | "visual_aesthetic" |
  "brand_connection" | "product_message" | "tone" | "prompt_direction">;

const REQUIRED_FIELDS: (keyof GeneratedCreativeDirection)[] = [
  "title",
  "campaign_idea",
  "rationale",
  "visual_aesthetic",
  "brand_connection",
  "product_message",
  "tone",
  "prompt_direction",
];

export function extractJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("Creative direction response is not valid JSON.");
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      throw new Error("Creative direction response is not valid JSON.");
    }
  }
}

const COUNT_WORDS: Record<number, string> = { 1: "one direction", 2: "two directions", 3: "three directions" };

export function parseCreativeDirections(raw: string, expectedCount = 3): GeneratedCreativeDirection[] {
  const parsed = extractJson(raw) as { directions?: unknown };
  if (!Array.isArray(parsed?.directions) || parsed.directions.length !== expectedCount) {
    throw new Error(`Creative Director must return exactly ${COUNT_WORDS[expectedCount] ?? `${expectedCount} directions`}.`);
  }

  return parsed.directions.map((candidate, index) => {
    if (!candidate || typeof candidate !== "object") {
      throw new Error(`Direction ${index + 1} is invalid.`);
    }
    const record = candidate as Record<string, unknown>;
    const direction = {} as GeneratedCreativeDirection;
    for (const field of REQUIRED_FIELDS) {
      const value = typeof record[field] === "string" ? record[field].trim() : "";
      if (!value) throw new Error(`Direction ${index + 1} is missing ${field}.`);
      direction[field] = value;
    }
    return direction;
  });
}

export function buildDirectionProjectFields(
  direction: CreativeDirection
): Pick<CreateProjectInput, "visual_direction" | "creative_goals" | "constraints"> {
  return {
    visual_direction: [
      direction.title,
      direction.visual_aesthetic,
      direction.tone ? `Tone: ${direction.tone}` : "",
      direction.prompt_direction ? `Prompt direction: ${direction.prompt_direction}` : "",
    ].filter(Boolean).join(". "),
    creative_goals: [
      direction.campaign_idea ? `Campaign idea: ${direction.campaign_idea}` : "",
      direction.rationale ? `Rationale: ${direction.rationale}` : "",
      direction.product_message ? `Product message: ${direction.product_message}` : "",
    ].filter(Boolean).join("\n"),
    constraints: direction.brand_connection || undefined,
  };
}

const DIRECTION_JSON_SHAPE = `{
  "directions": [
    {
      "title": "short direction name",
      "campaign_idea": "central campaign idea",
      "rationale": "why this direction serves the brief",
      "visual_aesthetic": "specific visual world, composition, material, light, and realism",
      "brand_connection": "how the direction expresses the brand",
      "product_message": "clear product or campaign message",
      "tone": "concise tone",
      "prompt_direction": "production-ready guidance for prompt construction"
    }
  ]
}`;

/**
 * Compact one-line view of the stored Creative Director strategy JSON
 * (doc 04 §4). Local re-parse rather than importing creativeDirectorMode —
 * that module imports callDirectionModel from here.
 */
function summarizeStrategyJson(raw: string): string {
  try {
    const json = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(json)
      .map(([key, value]) => {
        const text = Array.isArray(value) ? value.join(" | ") : typeof value === "string" ? value : "";
        return text.trim() ? `${key.replace(/_/g, " ")}: ${text.trim()}` : "";
      })
      .filter(Boolean)
      .join("; ");
  } catch {
    return "";
  }
}

function buildProjectContext(
  project: Project,
  comparisonOutcomes: string[],
  userContext?: string,
  visualReferenceContext?: string
): string {
  const strategy = project.creative_strategy ? summarizeStrategyJson(project.creative_strategy) : "";
  return [
    `Project: ${project.title}`,
    project.client ? `Client: ${project.client}` : "",
    project.campaign ? `Campaign: ${project.campaign}` : "",
    project.project_type ? `Project type: ${project.project_type}` : "",
    strategy ? `Creative strategy (defined in Creative Director Mode — stay strategically aligned with it): ${strategy}` : "",
    project.brief_text ? `Brief: ${project.brief_text}` : "",
    project.production_goal ? `Production goal: ${project.production_goal}` : "",
    project.visual_direction ? `Current visual direction: ${project.visual_direction}` : "",
    project.creative_goals ? `Creative goals: ${project.creative_goals}` : "",
    project.constraints ? `Constraints: ${project.constraints}` : "",
    project.provider_targets?.length ? `Providers: ${project.provider_targets.join(", ")}` : "",
    project.aspect_ratios?.length ? `Aspect ratios: ${project.aspect_ratios.join(", ")}` : "",
    comparisonOutcomes.length ? `Prior comparison decisions:\n${comparisonOutcomes.map((item) => `- ${item}`).join("\n")}` : "",
    visualReferenceContext?.trim() ? visualReferenceContext.trim() : "",
    userContext?.trim() ? `Additional direction from user: ${userContext.trim()}` : "",
  ].filter(Boolean).join("\n");
}

function buildGenerationPrompt(
  project: Project,
  comparisonOutcomes: string[],
  userContext?: string,
  visualReferenceContext?: string
): string {
  const context = buildProjectContext(project, comparisonOutcomes, userContext, visualReferenceContext);

  return `You are a senior creative director for advertising and branded visual production.

Develop exactly three materially different creative directions for this project. Keep every direction strategically connected to the brief, brand, product message, production constraints, and known comparison decisions. Avoid cosmetic variations of one idea.

${context}

Return ONLY valid JSON in this exact structure:
${DIRECTION_JSON_SHAPE}`;
}

function buildImprovementPrompt(
  project: Project,
  existing: GeneratedCreativeDirection[],
  userContext?: string,
  visualReferenceContext?: string
): string {
  const context = buildProjectContext(project, [], undefined, visualReferenceContext);
  const focus = userContext?.trim()
    ? `The user asks you to improve them with this focus: ${userContext.trim()}`
    : "Sharpen each direction: stronger campaign idea, more specific visual world, clearer product message.";

  return `You are a senior creative director for advertising and branded visual production.

Here are the current creative directions for this project:
${JSON.stringify({ directions: existing }, null, 2)}

${focus}

Improve each direction in place — keep its core identity and title spirit, but make every field materially better and more production-ready. Do not merge directions or change their count.

${context}

Return ONLY valid JSON with exactly ${existing.length} direction${existing.length === 1 ? "" : "s"}, in the same order, in this exact structure:
${DIRECTION_JSON_SHAPE}`;
}

export async function callDirectionModel(model: AIModel, prompt: string): Promise<string> {
  const apiKey = getApiKey(model.provider);
  requireValidApiKey(model.provider, apiKey);

  if (model.provider === "anthropic") {
    const response = await fetchProviderJson<{ content: { type: string; text: string }[] }>(
      model.provider,
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: model.id,
          max_tokens: 3072,
          messages: [{ role: "user", content: prompt }],
        }),
      }
    );
    return response.content.find((item) => item.type === "text")?.text ?? "";
  }

  // OpenAI and DeepSeek both expose an OpenAI-compatible chat completions endpoint.
  const baseUrl = model.provider === "deepseek" ? "https://api.deepseek.com/chat/completions" : "https://api.openai.com/v1/chat/completions";
  const response = await fetchProviderJson<{ choices: { message: { content: string } }[] }>(
    model.provider,
    baseUrl,
    {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: model.id,
        max_tokens: 3072,
        messages: [{ role: "user", content: prompt }],
      }),
    }
  );
  return response.choices[0]?.message?.content ?? "";
}

export async function generateCreativeDirections(
  project: Project,
  model: AIModel,
  comparisonOutcomes: string[] = [],
  userContext?: string,
  visualReferenceContext?: string
): Promise<GeneratedCreativeDirection[]> {
  const prompt = buildGenerationPrompt(project, comparisonOutcomes, userContext, visualReferenceContext);
  const raw = await callDirectionModel(model, prompt);
  return parseCreativeDirections(raw);
}

/** Improve the existing directions in place (same count, same order) using the user's focus input. */
export async function improveCreativeDirections(
  project: Project,
  model: AIModel,
  existing: GeneratedCreativeDirection[],
  userContext?: string,
  visualReferenceContext?: string
): Promise<GeneratedCreativeDirection[]> {
  if (!existing.length) throw new Error("There are no directions to improve yet.");
  const prompt = buildImprovementPrompt(project, existing, userContext, visualReferenceContext);
  const raw = await callDirectionModel(model, prompt);
  return parseCreativeDirections(raw, existing.length);
}
