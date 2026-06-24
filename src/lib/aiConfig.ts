export const AI_KEY_ANTHROPIC = "fc_anthropic_key";
export const AI_KEY_OPENAI    = "fc_openai_key";

export interface AIModel {
  id: string;
  label: string;
  provider: "anthropic" | "openai";
  tier: "fast" | "balanced" | "powerful";
}

export type AIProvider = AIModel["provider"];

export const AI_MODELS: AIModel[] = [
  { id: "claude-sonnet-4-6",        label: "Claude Sonnet 4.6",  provider: "anthropic", tier: "balanced"  },
  { id: "claude-opus-4-8",          label: "Claude Opus 4.8",    provider: "anthropic", tier: "powerful"  },
  { id: "claude-haiku-4-5-20251001",label: "Claude Haiku 4.5",   provider: "anthropic", tier: "fast"      },
  { id: "gpt-4o",                   label: "GPT-4o",             provider: "openai",    tier: "powerful"  },
  { id: "gpt-4o-mini",              label: "GPT-4o mini",        provider: "openai",    tier: "fast"      },
];

export function providerLabel(provider: AIProvider): string {
  return provider === "anthropic" ? "Anthropic" : "OpenAI";
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
  const key = provider === "anthropic" ? AI_KEY_ANTHROPIC : AI_KEY_OPENAI;
  return (localStorage.getItem(key) ?? "").trim();
}
