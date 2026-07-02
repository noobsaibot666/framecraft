import { providerErrorMessage, providerLabel, validateApiKey, getApiKey, type AIModel, type AIProvider } from "./aiConfig";

export const DEFAULT_AI_TIMEOUT_MS = 60_000;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function readErrorPayload(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => "");
  if (!text) return "";
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function requireValidApiKey(provider: AIProvider, apiKey: string): void {
  const validation = validateApiKey(provider, apiKey);
  if (!validation.valid) throw new Error(validation.message ?? `Invalid ${providerLabel(provider)} API key.`);
}

/** Provider-agnostic single-turn chat completion. Returns the raw text response. */
export async function chatComplete(
  model: AIModel,
  opts: { system: string; user: string; maxTokens: number }
): Promise<string> {
  const apiKey = getApiKey(model.provider);
  requireValidApiKey(model.provider, apiKey);

  if (model.provider === "anthropic") {
    const data = await fetchProviderJson<{ content: { type: string; text: string }[] }>(
      "anthropic",
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
          max_tokens: opts.maxTokens,
          system: opts.system,
          messages: [{ role: "user", content: opts.user }],
        }),
      }
    );
    return data.content.find((c) => c.type === "text")?.text ?? "";
  }

  const data = await fetchProviderJson<{ choices: { message: { content: string } }[] }>(
    "openai",
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: model.id,
        max_tokens: opts.maxTokens,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      }),
    }
  );
  return data.choices[0]?.message?.content ?? "";
}

export async function fetchProviderJson<T>(
  provider: AIProvider,
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_AI_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const payload = await readErrorPayload(response);
      throw new Error(providerErrorMessage(provider, response.status, payload));
    }
    return await response.json() as T;
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`${providerLabel(provider)} request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
