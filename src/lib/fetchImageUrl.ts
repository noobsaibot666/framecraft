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
    const res = await fetch(url, { mode: "cors" });
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      // Pass the raw bytes to Rust for background CPU processing (resizing & compression)
      // Tauri v2 natively optimizes passing Uint8Array to Vec<u8> IPC
      const uint8Array = new Uint8Array(buffer);
      return await invoke<string>("compress_image_from_bytes", { bytes: uint8Array });
    }
  } catch (err) {
    console.warn("Browser fetch failed, falling back to Rust reqwest", err);
  }

  // Fallback to pure Rust reqwest if browser fetch fails (e.g. CORS block that reqwest wouldn't care about)
  return invoke<string>("fetch_image_as_data_url", { url });
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
    return u.hostname.endsWith("midjourney.com");
  } catch {
    return false;
  }
}
