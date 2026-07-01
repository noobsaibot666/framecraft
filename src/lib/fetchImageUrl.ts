/**
 * Fetches an external image URL via native Rust HTTP and returns it as a base64 data URL.
 * This bypasses Tauri's CSP, browser CORS restrictions, and Cloudflare referrer blocks.
 *
 * Returns undefined if the URL is empty or not an http/https URL.
 * Throws if the fetch fails (status non-2xx, network error, etc).
 */
export async function fetchImageAsDataUrl(url: string): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
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
