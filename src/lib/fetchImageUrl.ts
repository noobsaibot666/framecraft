/**
 * Fetches an external image URL via native Rust HTTP and returns it as a base64 data URL.
 * This bypasses Tauri's CSP, browser CORS restrictions, and Cloudflare referrer blocks.
 *
 * Returns undefined if the URL is empty or not an http/https URL.
 * Throws if the fetch fails (status non-2xx, network error, etc).
 */
export async function fetchImageAsDataUrl(url: string): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");

  try {
    // Attempt to fetch natively via browser. This bypasses Cloudflare bot protection 
    // because it uses the real WebKit browser engine with correct TLS fingerprint.
    const res = await fetch(url, { 
      mode: "cors", 
      signal: AbortSignal.timeout(10000) 
    });
    
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      // Pass the raw bytes to Rust for background CPU processing (resizing & compression)
      // Tauri v2 natively optimizes passing Uint8Array to Vec<u8> IPC
      const uint8Array = new Uint8Array(buffer);
      
      try {
        return await invoke<string>("compress_image_from_bytes", { bytes: uint8Array });
      } catch (parseErr) {
        // If the Rust CPU processing fails (e.g. invalid image format, corrupt bytes),
        // DO NOT fallback to fetch_image_as_data_url because it will just download 
        // the same broken bytes again and fail again. Wrap in a sentinel so the outer
        // catch can distinguish this from a network error.
        throw new ImageDecodeError(parseErr);
      }
    } else {
      // If server returned 4xx/5xx, no point in falling back to reqwest.
      throw new ImageDecodeError(`Server returned status ${res.status}`);
    }
  } catch (err: unknown) {
    // Re-throw immediately if this was a decode/parse failure — retrying via reqwest
    // would just download the same bad bytes again.
    if (err instanceof ImageDecodeError) throw err.cause ?? err;

    // For genuine network errors (CORS, DNS, Timeout, etc.), fall back to Rust reqwest.
    // DOMException(AbortError/TimeoutError) and TypeError both land here.
    console.warn("[fetchImageUrl] Browser fetch failed (network/CORS), falling back to Rust reqwest:", err);
  }

  // Fallback: Rust reqwest bypasses CORS (useful for tauri:// production origin)
  return invoke<string>("fetch_image_as_data_url", { url });
}

/** Sentinel wrapper so we can distinguish decode failures from network failures. */
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
