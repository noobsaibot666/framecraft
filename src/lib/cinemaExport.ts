// Cinema Studio — export & copy (Phase 128). Assets export as individually
// downloaded files named by their `@tag` (no zip dependency added — matches
// the app's existing no-new-dependency convention); prompt copy reuses the
// same `navigator.clipboard.writeText` pattern already used throughout the
// app (e.g. PromptDetail's "Copy for [provider]").
import { slugify } from "./utils";
import type { CinemaAsset } from "@/types";

export function getExtensionFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/(\w+);/);
  const type = match?.[1] ?? "png";
  return type === "jpeg" ? "jpg" : type;
}

/** Same slug convention `suggestAssetTag` (cinemaAssets.ts) already uses for the `@tag` itself. */
export function tagToFilename(tag: string): string {
  return slugify(tag.replace(/^@/, ""));
}

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Downloads every asset that has image data, one file per asset, named
 * `<tag>.<ext>` — e.g. `@eduardo` → `eduardo.png`. Staggered slightly since
 * browsers can throttle/block several synchronous downloads triggered in
 * the same tick. Returns how many assets were exported vs. skipped
 * (no file_data yet).
 */
export async function exportAssetsWithNaming(assets: CinemaAsset[]): Promise<{ exported: number; skipped: number }> {
  let exported = 0;
  let skipped = 0;
  for (const asset of assets) {
    if (!asset.file_data) { skipped += 1; continue; }
    const filename = `${tagToFilename(asset.tag)}.${getExtensionFromDataUrl(asset.file_data)}`;
    triggerDownload(asset.file_data, filename);
    exported += 1;
    if (exported < assets.length) await sleep(150);
  }
  return { exported, skipped };
}

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
