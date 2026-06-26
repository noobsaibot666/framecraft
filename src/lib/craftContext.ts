import type { Project, Token } from "@/types";

export interface ProjectTokenSuggestion {
  token: Token;
  text: string;
  reason: string;
}

interface SuggestionOptions {
  selectedTexts?: string[];
  promptText?: string;
  limit?: number;
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48);
}

function splitPhrases(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter((part) => part.length >= 3 && part.length <= 64);
}

function appendPhrases(list: string[], raw?: string) {
  if (!raw) return;
  list.push(...splitPhrases(raw));
}

export function buildProjectTokenSuggestions(
  project: Project | null,
  options: SuggestionOptions = {}
): ProjectTokenSuggestion[] {
  if (!project) return [];

  const selected = new Set((options.selectedTexts ?? []).map((text) => text.toLowerCase()));
  const promptLower = (options.promptText ?? "").toLowerCase();
  const candidates: string[] = [];

  candidates.push(...(project.tags ?? []));
  appendPhrases(candidates, project.visual_direction);
  appendPhrases(candidates, project.creative_goals);
  appendPhrases(candidates, project.image_needs);
  appendPhrases(candidates, project.video_needs);
  appendPhrases(candidates, project.intended_output);

  const seen = new Set<string>();
  const unique = candidates.filter((text) => {
    const key = text.toLowerCase();
    if (seen.has(key) || selected.has(key) || promptLower.includes(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, options.limit ?? 8).map((text) => ({
    text,
    reason: "Project context",
    token: {
      id: `project_${slug(text)}`,
      text,
      category_id: "project_context",
      category_name: "project_context",
      use_count: 0,
      quality_score: 0,
      is_builtin: false,
      is_favorite: false,
    },
  }));
}

export function buildSuppressionText(project: Project | null, avoidanceText?: string): string {
  return [project?.constraints, avoidanceText].filter(Boolean).join(", ").toLowerCase();
}
