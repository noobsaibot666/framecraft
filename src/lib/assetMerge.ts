// Cinema Studio — character-sheet merge tool (Phase 124). Composites 2-3
// asset images side by side into one new asset, so a set of separately
// generated views (front / back / portrait) becomes a single unified
// character-sheet reference — the same canvas-drawing technique
// fileStore.ts already uses for thumbnailing, applied as a horizontal strip
// instead of a scale-down. Source assets are never modified or deleted.

const MERGE_JPEG_QUALITY = 0.92;
export const MIN_MERGE_SOURCES = 2;
export const MAX_MERGE_SOURCES = 3;

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load one of the selected images."));
    img.src = dataUrl;
  });
}

/**
 * Merges 2-3 image data URLs into one horizontal-strip composite, each
 * scaled to a common target height (the shortest source image's height, so
 * nothing upscales) and placed left to right in the given order.
 */
export async function mergeImagesSideBySide(dataUrls: string[]): Promise<string> {
  if (dataUrls.length < MIN_MERGE_SOURCES || dataUrls.length > MAX_MERGE_SOURCES) {
    throw new Error(`Select ${MIN_MERGE_SOURCES}-${MAX_MERGE_SOURCES} images to merge.`);
  }

  const images = await Promise.all(dataUrls.map(loadImage));
  const targetHeight = Math.min(...images.map((img) => img.height));
  const scaledWidths = images.map((img) => Math.round(img.width * (targetHeight / img.height)));
  const gap = 4;
  const totalWidth = scaledWidths.reduce((sum, w) => sum + w, 0) + gap * (images.length - 1);

  const canvas = document.createElement("canvas");
  canvas.width = totalWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable.");

  ctx.fillStyle = "#e5e5e5";
  ctx.fillRect(0, 0, totalWidth, targetHeight);

  let x = 0;
  images.forEach((img, i) => {
    ctx.drawImage(img, x, 0, scaledWidths[i], targetHeight);
    x += scaledWidths[i] + gap;
  });

  return canvas.toDataURL("image/jpeg", MERGE_JPEG_QUALITY);
}
