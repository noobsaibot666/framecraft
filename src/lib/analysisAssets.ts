import type { AnalysisResult } from "./analyzeImage";
import type { BriefResult, GeneratedPrompt, SuggestedRecipe } from "./aiResultParsers";
import type { Provider } from "@/types";
import type { CreatePromptInput } from "./db";

const SUPPORTED_PROVIDERS = new Set<Provider>([
  "midjourney",
  "dalle",
  "stable_diffusion",
  "firefly",
  "ideogram",
  "flux",
  "nano_banana",
  "gpt_image",
  "seedance",
  "kling",
  "runway",
  "higgsfield",
  "other",
]);

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function lines(values: Array<string | undefined>): string | undefined {
  const compact = values.filter((value): value is string => Boolean(value?.trim()));
  return compact.length ? compact.join("\n") : undefined;
}

function joined(values: string[] | undefined, separator = "; "): string | undefined {
  return values?.length ? values.join(separator) : undefined;
}

export function normalizeAnalysisProvider(provider: string | undefined): Provider {
  return SUPPORTED_PROVIDERS.has(provider as Provider) ? provider as Provider : "midjourney";
}

export function buildImagePromptAsset(
  result: AnalysisResult,
  editableTags: string[],
  promptText = result.suggested_prompt,
  title = result.title
): CreatePromptInput {
  return {
    title,
    prompt_text: promptText,
    provider: normalizeAnalysisProvider(result.provider),
    tags: unique([...editableTags, ...result.tags, "analysis", "image-analysis", result.quality_tier]),
    notes: lines([
      "Source: Image Analyzer",
      result.quality_tier ? `Quality tier: ${result.quality_tier}` : undefined,
      result.style_notes ? `Style notes: ${result.style_notes}` : undefined,
      joined(result.elements) ? `Elements: ${joined(result.elements)}` : undefined,
      joined(result.ai_look_risks) ? `AI-look risks: ${joined(result.ai_look_risks)}` : undefined,
    ]),
    aspect_ratio: result.aspect_ratio || undefined,
    avoidance_text: result.avoidance_suggestions?.length
      ? result.avoidance_suggestions.join(", ")
      : undefined,
  };
}

export function buildBriefPromptAsset(prompt: GeneratedPrompt, brief: BriefResult): CreatePromptInput {
  return {
    title: prompt.title,
    prompt_text: prompt.prompt,
    provider: "midjourney",
    tags: unique([...prompt.tags, "analysis", "brief-analysis", brief.tone]),
    aspect_ratio: prompt.aspect_ratio || undefined,
    avoidance_text: unique([...(brief.key_constraints ?? []), ...(brief.risk_areas ?? [])]).join(", ") || undefined,
    notes: lines([
      "Source: Brief Analyzer",
      prompt.use_case ? `Use case: ${prompt.use_case}` : undefined,
      brief.summary ? `Brief summary: ${brief.summary}` : undefined,
      brief.production_goal ? `Production goal: ${brief.production_goal}` : undefined,
      brief.creative_direction ? `Creative direction: ${brief.creative_direction}` : undefined,
      joined(brief.required_deliverables) ? `Required deliverables: ${joined(brief.required_deliverables)}` : undefined,
      joined(brief.key_elements) ? `Key elements: ${joined(brief.key_elements)}` : undefined,
      joined(brief.key_constraints) ? `Constraints: ${joined(brief.key_constraints)}` : undefined,
      joined(brief.risk_areas) ? `Risk areas: ${joined(brief.risk_areas)}` : undefined,
    ]),
  };
}

export function buildBriefRecipeAsset(recipe: SuggestedRecipe, brief: BriefResult): CreatePromptInput {
  return {
    title: recipe.title,
    prompt_text: recipe.token_sequence.join(", "),
    provider: "midjourney",
    is_recipe: true,
    tags: unique(["analysis", "brief-analysis", "recipe", brief.tone]),
    notes: lines([
      "Source: Brief Analyzer",
      recipe.description,
      brief.production_goal ? `Production goal: ${brief.production_goal}` : undefined,
      joined(brief.key_elements) ? `Key elements: ${joined(brief.key_elements)}` : undefined,
    ]),
  };
}
