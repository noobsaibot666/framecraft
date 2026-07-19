import { getPreferences } from "./userPreferences";

export const AI_KEY_ANTHROPIC = "fc_anthropic_key";
export const AI_KEY_OPENAI    = "fc_openai_key";
export const AI_KEY_DEEPSEEK  = "fc_deepseek_key";

export interface AIModel {
  id: string;
  label: string;
  provider: "anthropic" | "openai" | "deepseek";
  tier: "fast" | "balanced" | "powerful" | "flagship";
}

export type AIProvider = AIModel["provider"];

/**
 * Response depth dial, independent of model choice — scales max output tokens
 * and appends a short instruction to the system prompt. Provider-uniform
 * (token budget + prompt instruction only) rather than Anthropic-only
 * extended-thinking, so it behaves the same across all three providers.
 */
export type AIQuality = "draft" | "standard" | "thorough";

export const AI_QUALITIES: { id: AIQuality; label: string; description: string }[] = [
  { id: "draft",    label: "Draft",    description: "Fastest, shortest — good for quick iteration." },
  { id: "standard", label: "Standard", description: "Balanced default." },
  { id: "thorough", label: "Thorough", description: "Slower, more detailed — more tokens, deeper coverage." },
];

const QUALITY_TOKEN_SCALE: Record<AIQuality, number> = { draft: 0.6, standard: 1, thorough: 1.6 };

export function scaleMaxTokensForQuality(baseMaxTokens: number, quality: AIQuality): number {
  return Math.max(256, Math.round(baseMaxTokens * QUALITY_TOKEN_SCALE[quality]));
}

const QUALITY_INSTRUCTIONS: Record<AIQuality, string> = {
  draft: "Prioritize speed: keep the response concise and skip exhaustive edge-case coverage.",
  standard: "",
  thorough: "Take extra care: consider more nuance, coverage, and detail than usual before finalizing your answer.",
};

export function qualityInstruction(quality: AIQuality): string {
  return QUALITY_INSTRUCTIONS[quality];
}

// Ordered priciest/most-capable → cheapest within each provider, so any UI that
// lists a provider's models in AI_MODELS order (or filters by getConnectedModels())
// reads top-to-bottom as "flagship down to the cheaper model".
export const AI_MODELS: AIModel[] = [
  { id: "claude-fable-5",           label: "Claude Fable 5",     provider: "anthropic", tier: "flagship"  },
  { id: "claude-opus-4-8",          label: "Claude Opus 4.8",    provider: "anthropic", tier: "powerful"  },
  { id: "claude-sonnet-5",          label: "Claude Sonnet 5",    provider: "anthropic", tier: "balanced"  },
  { id: "claude-haiku-4-5-20251001",label: "Claude Haiku 4.5",   provider: "anthropic", tier: "fast"      },
  { id: "gpt-4o",                   label: "GPT-4o",             provider: "openai",    tier: "powerful"  },
  { id: "gpt-4o-mini",              label: "GPT-4o mini",        provider: "openai",    tier: "fast"      },
  { id: "deepseek-reasoner",        label: "DeepSeek Reasoner",  provider: "deepseek",  tier: "powerful"  },
  { id: "deepseek-chat",            label: "DeepSeek Chat",      provider: "deepseek",  tier: "fast"      },
];

export function providerLabel(provider: AIProvider): string {
  if (provider === "anthropic") return "Anthropic";
  if (provider === "openai") return "OpenAI";
  return "DeepSeek";
}

export function validateApiKey(provider: AIProvider, key: string): { valid: boolean; message?: string } {
  const trimmed = key.trim();
  const label = providerLabel(provider);
  if (!trimmed) return { valid: false, message: `Add an ${label} API key in Settings.` };
  if (provider === "anthropic" && !trimmed.startsWith("sk-ant-")) {
    return { valid: false, message: "Anthropic API keys should start with sk-ant-." };
  }
  if (provider === "openai" && !trimmed.startsWith("sk-")) {
    return { valid: false, message: "OpenAI API keys should start with sk-." };
  }
  if (provider === "deepseek" && !trimmed.startsWith("sk-")) {
    return { valid: false, message: "DeepSeek API keys should start with sk-." };
  }
  return { valid: true };
}

export function providerErrorMessage(provider: AIProvider, status: number, payload: unknown): string {
  const label = providerLabel(provider);
  let message = "";
  if (typeof payload === "string") {
    message = payload;
  } else if (payload && typeof payload === "object") {
    const value = payload as { error?: { message?: string }; message?: string; type?: string };
    message = value.error?.message ?? value.message ?? value.type ?? "";
  }
  const trimmed = message.trim() || "No error details returned.";
  return `${label} request failed (${status}): ${trimmed.slice(0, 240)}`;
}

export function getApiKey(provider: AIProvider): string {
  const key = provider === "anthropic" ? AI_KEY_ANTHROPIC : provider === "openai" ? AI_KEY_OPENAI : AI_KEY_DEEPSEEK;
  return (localStorage.getItem(key) ?? "").trim();
}

/** Connected models only — the provider has a key that passes format validation. */
export function getConnectedModels(): AIModel[] {
  return AI_MODELS.filter((m) => validateApiKey(m.provider, getApiKey(m.provider)).valid);
}

function isModelConnected(model: AIModel): boolean {
  return validateApiKey(model.provider, getApiKey(model.provider)).valid;
}

/**
 * Resolves a project's saved default AI model (e.g. `CinemaProject.script_model`)
 * to a connected AIModel, falling back to pickAvailableModel() when the project
 * has no preference set or its saved model's key is no longer connected.
 */
export function resolveModelPreference(preferredId?: string | null): AIModel | undefined {
  if (preferredId) {
    const model = AI_MODELS.find((m) => m.id === preferredId);
    if (model && isModelConnected(model)) return model;
  }
  return pickAvailableModel();
}

/** The user's chosen "standard model" from Settings, if set and still connected. */
function preferredConnectedModel(): AIModel | undefined {
  const id = getPreferences().defaultAiModelId;
  if (!id) return undefined;
  const model = AI_MODELS.find((m) => m.id === id);
  return model && isModelConnected(model) ? model : undefined;
}

/**
 * Auto-select a model when the caller hasn't chosen one. Honors the user's
 * Settings > AI Integration > Standard Model preference when it's set and its
 * key is still connected; otherwise prefers the cheapest connected OpenAI
 * model (per default-model policy), falling back to Anthropic, then DeepSeek.
 * Returns undefined if nothing is configured.
 */
export function pickAvailableModel(): AIModel | undefined {
  const preferred = preferredConnectedModel();
  if (preferred) return preferred;

  for (const provider of ["openai", "anthropic", "deepseek"] as const) {
    if (validateApiKey(provider, getApiKey(provider)).valid) {
      return AI_MODELS.find((m) => m.provider === provider && m.tier === "fast")
        ?? AI_MODELS.find((m) => m.provider === provider);
    }
  }
  return undefined;
}

/**
 * Like pickAvailableModel, for image-description/vision tasks. DeepSeek is
 * included by explicit user choice — its public API's image-input support is
 * unverified from here, so selecting it may surface a normal request error
 * rather than a description if its endpoint doesn't accept image content.
 */
export function pickVisionModel(): AIModel | undefined {
  const preferred = preferredConnectedModel();
  if (preferred) return preferred;

  for (const provider of ["openai", "anthropic", "deepseek"] as const) {
    if (validateApiKey(provider, getApiKey(provider)).valid) {
      return AI_MODELS.find((m) => m.provider === provider && m.tier === "fast")
        ?? AI_MODELS.find((m) => m.provider === provider);
    }
  }
  return undefined;
}
