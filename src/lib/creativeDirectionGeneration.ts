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

function extractJson(raw: string): unknown {
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

export function parseCreativeDirections(raw: string): GeneratedCreativeDirection[] {
  const parsed = extractJson(raw) as { directions?: unknown };
  if (!Array.isArray(parsed?.directions) || parsed.directions.length !== 3) {
    throw new Error("Creative Director must return exactly three directions.");
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

function buildGenerationPrompt(project: Project, comparisonOutcomes: string[], userContext?: string): string {
  const context = [
    `Project: ${project.title}`,
    project.client ? `Client: ${project.client}` : "",
    project.campaign ? `Campaign: ${project.campaign}` : "",
    project.project_type ? `Project type: ${project.project_type}` : "",
    project.brief_text ? `Brief: ${project.brief_text}` : "",
    project.production_goal ? `Production goal: ${project.production_goal}` : "",
    project.visual_direction ? `Current visual direction: ${project.visual_direction}` : "",
    project.creative_goals ? `Creative goals: ${project.creative_goals}` : "",
    project.constraints ? `Constraints: ${project.constraints}` : "",
    project.provider_targets?.length ? `Providers: ${project.provider_targets.join(", ")}` : "",
    project.aspect_ratios?.length ? `Aspect ratios: ${project.aspect_ratios.join(", ")}` : "",
    comparisonOutcomes.length ? `Prior comparison decisions:\n${comparisonOutcomes.map((item) => `- ${item}`).join("\n")}` : "",
    userContext?.trim() ? `Additional direction from user: ${userContext.trim()}` : "",
  ].filter(Boolean).join("\n");

  return `You are a senior creative director for advertising and branded visual production.

Develop exactly three materially different creative directions for this project. Keep every direction strategically connected to the brief, brand, product message, production constraints, and known comparison decisions. Avoid cosmetic variations of one idea.

${context}

Return ONLY valid JSON in this exact structure:
{
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
}

export async function generateCreativeDirections(
  project: Project,
  model: AIModel,
  comparisonOutcomes: string[] = [],
  userContext?: string
): Promise<GeneratedCreativeDirection[]> {
  const apiKey = getApiKey(model.provider);
  requireValidApiKey(model.provider, apiKey);
  const prompt = buildGenerationPrompt(project, comparisonOutcomes, userContext);
  let raw = "";

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
    raw = response.content.find((item) => item.type === "text")?.text ?? "";
  } else {
    const response = await fetchProviderJson<{ choices: { message: { content: string } }[] }>(
      model.provider,
      "https://api.openai.com/v1/chat/completions",
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
    raw = response.choices[0]?.message?.content ?? "";
  }

  return parseCreativeDirections(raw);
}
