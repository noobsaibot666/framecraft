import { afterEach, describe, expect, it, vi } from "vitest";
import { providerErrorMessage, validateApiKey } from "./aiConfig";
import { fetchProviderJson } from "./aiClient";

describe("AI provider hardening", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("validates provider key formats without network calls", () => {
    expect(validateApiKey("anthropic", "sk-ant-api03-abc123").valid).toBe(true);
    expect(validateApiKey("openai", "sk-proj-abc123").valid).toBe(true);
    expect(validateApiKey("openai", "abc123").valid).toBe(false);
    expect(validateApiKey("anthropic", "").message).toContain("Add an Anthropic API key");
  });

  it("normalizes provider error payloads", () => {
    expect(providerErrorMessage("openai", 401, { error: { message: "Invalid API key" } })).toBe(
      "OpenAI request failed (401): Invalid API key"
    );
    expect(providerErrorMessage("anthropic", 429, "rate_limit")).toBe(
      "Anthropic request failed (429): rate_limit"
    );
  });

  it("returns parsed JSON for successful provider responses", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    await expect(fetchProviderJson<{ ok: boolean }>("openai", "https://example.test", {}, 1000)).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("https://example.test", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it("throws normalized errors for failed provider responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Bad auth" } }), { status: 401 })
    );

    await expect(fetchProviderJson("anthropic", "https://example.test", {}, 1000)).rejects.toThrow(
      "Anthropic request failed (401): Bad auth"
    );
  });

  it("turns aborted requests into timeout errors", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      const signal = init?.signal as AbortSignal | undefined;
      signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));

    const request = expect(fetchProviderJson("openai", "https://example.test", {}, 5000)).rejects.toThrow(
      "OpenAI request timed out after 5 seconds."
    );
    await vi.advanceTimersByTimeAsync(5000);
    await request;
  });
});
