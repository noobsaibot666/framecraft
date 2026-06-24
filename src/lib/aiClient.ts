import { providerErrorMessage, providerLabel, validateApiKey, type AIProvider } from "./aiConfig";

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
