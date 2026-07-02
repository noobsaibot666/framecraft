export const AI_KEY_ANTHROPIC = "fc_anthropic_key";
export const AI_KEY_OPENAI    = "fc_openai_key";
export const AI_KEY_DEEPSEEK  = "fc_deepseek_key";

export interface AIModel {
  id: string;
  label: string;
  provider: "anthropic" | "openai" | "deepseek";
  tier: "fast" | "balanced" | "powerful";
}

export type AIProvider = AIModel["provider"];

export const AI_MODELS: AIModel[] = [
  { id: "claude-sonnet-4-6",        label: "Claude Sonnet 4.6",  provider: "anthropic", tier: "balanced"  },
  { id: "claude-opus-4-8",          label: "Claude Opus 4.8",    provider: "anthropic", tier: "powerful"  },
  { id: "claude-haiku-4-5-20251001",label: "Claude Haiku 4.5",   provider: "anthropic", tier: "fast"      },
  { id: "gpt-4o",                   label: "GPT-4o",             provider: "openai",    tier: "powerful"  },
  { id: "gpt-4o-mini",              label: "GPT-4o mini",        provider: "openai",    tier: "fast"      },
  { id: "deepseek-chat",            label: "DeepSeek Chat",      provider: "deepseek",  tier: "fast"      },
  { id: "deepseek-reasoner",        label: "DeepSeek Reasoner",  provider: "deepseek",  tier: "powerful"  },
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

/**
 * Auto-select a model when the caller hasn't chosen one. Prefers the cheapest
 * connected OpenAI model (per default-model policy), falling back to Anthropic,
 * then DeepSeek. Returns undefined if nothing is configured.
 */
export function pickAvailableModel(): AIModel | undefined {
  for (const provider of ["openai", "anthropic", "deepseek"] as const) {
    if (validateApiKey(provider, getApiKey(provider)).valid) {
      return AI_MODELS.find((m) => m.provider === provider && m.tier === "fast")
        ?? AI_MODELS.find((m) => m.provider === provider);
    }
  }
  return undefined;
}
