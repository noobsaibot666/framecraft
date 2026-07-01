/**
 * Fetches an external image URL and returns it as a base64 data URL.
 *
 * Strategy (in order):
 *   1. Native OS HTTP via @tauri-apps/plugin-http (NSURLSession on macOS, WinHTTP on Windows).
 *      This uses the real OS TLS stack so Cloudflare's JA3 fingerprint check passes.
 *   2. Browser WebView fetch + Rust compress_image_from_bytes.
 *      Falls through when the native fetch gets a non-2xx (e.g. CORS blocks).
 *   3. Rust reqwest with Discord Referer and Chrome UA headers.
 *      Last resort — reqwest's TLS fingerprint is weaker, but still works for many CDNs.
 *
 * Only genuine image decode errors (step 1 or 2 returned bytes but Rust couldn't decode them)
 * cause an early throw — those won't be fixed by retrying with a different HTTP client.
 */
export async function fetchImageAsDataUrl(url: string): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");

  // ── Tier 1: native OS HTTP (NSURLSession / WinHTTP) ──────────────────────
  // Uses the real OS TLS stack → correct JA3 fingerprint → passes Cloudflare.
  try {
    const { fetch: nativeFetch } = await import("@tauri-apps/plugin-http");
    const res = await nativeFetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://discord.com/",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      connectTimeout: 15000,
    });
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      try {
        return await invoke<string>("compress_image_from_bytes", { bytes: uint8Array });
      } catch (parseErr) {
        // Bytes arrived but Rust can't decode — bad image format, not a network issue.
        throw new ImageDecodeError(parseErr);
      }
    }
    // 4xx/5xx: fall through to next tier.
    console.warn(`[fetchImageUrl] Native fetch got ${res.status}, trying browser fetch`);
  } catch (err: unknown) {
    if (err instanceof ImageDecodeError) throw err.cause ?? err;
    // Plugin not available or other network error → fall through to Tier 2.
    console.warn("[fetchImageUrl] Native fetch failed, trying browser fetch:", err);
  }

  // ── Tier 2: WebView browser fetch + Rust compress ────────────────────────
  // Works for URLs that allow CORS from tauri://localhost; skipped for others.
  try {
    const res = await fetch(url, {
      mode: "cors",
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      try {
        return await invoke<string>("compress_image_from_bytes", { bytes: uint8Array });
      } catch (parseErr) {
        throw new ImageDecodeError(parseErr);
      }
    }
    console.warn(`[fetchImageUrl] Browser fetch got ${res.status}, falling back to Rust reqwest`);
  } catch (err: unknown) {
    if (err instanceof ImageDecodeError) throw err.cause ?? err;
    // CORS block, timeout, or network error → fall through to Tier 3.
    console.warn("[fetchImageUrl] Browser fetch failed, falling back to Rust reqwest:", err);
  }

  // ── Tier 3: Rust reqwest (blocking, Discord Referer) ─────────────────────
  return invoke<string>("fetch_image_as_data_url", { url });
}

/** Sentinel: image bytes arrived but couldn't be decoded — no point retrying. */
class ImageDecodeError extends Error {
  cause: unknown;
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.cause = cause;
    this.name = "ImageDecodeError";
  }
}

/** Returns true if the URL looks like a direct image URL */
export function isDirectImageUrl(url: string): boolean {
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
  return /\.(png|jpe?g|webp|gif|avif|bmp|tiff?)(\?.*)?$/i.test(url);
}

/** Returns true if this looks like a Midjourney CDN or job URL */
export function isMidjourneyUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname.endsWith("midjourney.com") || u.hostname.endsWith("discordapp.com");
  } catch {
    return false;
  }
}

/** Returns true if a URL is worth attempting to fetch as a thumbnail */
export function looksLikeThumbnailUrl(url: string): boolean {
  return isDirectImageUrl(url) || isMidjourneyUrl(url);
}
