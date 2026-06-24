export const AI_KEY_ANTHROPIC = "fc_anthropic_key";
export const AI_KEY_OPENAI    = "fc_openai_key";
export const AI_MODEL_KEY     = "fc_ai_model";
export const DEFAULT_MODEL_ID = "claude-sonnet-4-6";

export interface AIModel {
  id: string;
  label: string;
  provider: "anthropic" | "openai";
  tier: "fast" | "balanced" | "powerful";
}

export const AI_MODELS: AIModel[] = [
  { id: "claude-sonnet-4-6",        label: "Claude Sonnet 4.6",  provider: "anthropic", tier: "balanced"  },
  { id: "claude-opus-4-8",          label: "Claude Opus 4.8",    provider: "anthropic", tier: "powerful"  },
  { id: "claude-haiku-4-5-20251001",label: "Claude Haiku 4.5",   provider: "anthropic", tier: "fast"      },
  { id: "gpt-4o",                   label: "GPT-4o",             provider: "openai",    tier: "powerful"  },
  { id: "gpt-4o-mini",              label: "GPT-4o mini",        provider: "openai",    tier: "fast"      },
];

export function getActiveModel(): AIModel {
  const id = localStorage.getItem(AI_MODEL_KEY) ?? DEFAULT_MODEL_ID;
  return AI_MODELS.find((m) => m.id === id) ?? AI_MODELS[0];
}

export function getApiKey(provider: "anthropic" | "openai"): string {
  const key = provider === "anthropic" ? AI_KEY_ANTHROPIC : AI_KEY_OPENAI;
  return localStorage.getItem(key) ?? "";
}
