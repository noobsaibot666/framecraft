import {
  getAppDataLibraryPaths,
  getReferenceDir,
  getResultDir as resolveResultDir,
  type LibraryPaths,
} from "./libraryConfig";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function tauriConvertFileSrc(): ((path: string, protocol?: string) => string) | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as {
    __TAURI_INTERNALS__?: { convertFileSrc?: (path: string, protocol?: string) => string };
  }).__TAURI_INTERNALS__?.convertFileSrc;
}

// Pre-cache convertFileSrc so toDisplaySrc stays synchronous
let _convertFileSrc: ((path: string) => string) | undefined;
if (isTauri) {
  import("@tauri-apps/api/core")
    .then((m) => { _convertFileSrc = m.convertFileSrc; })
    .catch(() => {});
}

// ─── Path helpers ─────────────────────────────────────────────

export function getResultDir(base: string): string {
  return resolveResultDir(base);
}

export function getRefDir(base: string): string {
  return getReferenceDir(base);
}

// ─── Internal helpers ─────────────────────────────────────────

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function extFromDataUrl(dataUrl: string): string {
  if (dataUrl.startsWith("data:image/png")) return "png";
  if (dataUrl.startsWith("data:image/webp")) return "webp";
  if (dataUrl.startsWith("data:video/quicktime")) return "mov";
  if (dataUrl.startsWith("data:video/webm")) return "webm";
  if (dataUrl.startsWith("data:video/")) return "mp4";
  return "jpg";
}

const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm", "m4v"]);

/** True for a stored path, asset URL, or data URL that points at a video clip
 * rather than a still image — callers use this to pick <video> vs <img>. */
export function isVideoPath(src: string | undefined): boolean {
  if (!src) return false;
  if (src.startsWith("data:video/")) return true;
  if (src.startsWith("data:")) return false;
  const clean = src.split("?")[0].split("#")[0];
  const ext = clean.split(".").pop()?.toLowerCase();
  return !!ext && VIDEO_EXTENSIONS.has(ext);
}

// ─── Public API ───────────────────────────────────────────────

// 0.92 rather than the browser-canvas default (~0.92 too, but we were
// explicitly passing 0.8) — thumbnails were visibly over-compressed/blocky
// at the smaller card sizes they're displayed at.
const THUMBNAIL_JPEG_QUALITY = 0.92;

function imageThumbnailFromDataUrl(dataUrl: string, maxWidth: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", THUMBNAIL_JPEG_QUALITY));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Grabs a single frame (just past the first keyframe) from a video data URL
// and encodes it as a JPEG data URL — used as the thumbnail for video results
// so every existing <img>-based thumbnail/cover renderer keeps working
// unmodified even when the underlying result is a video clip.
function videoThumbnailFromDataUrl(dataUrl: string, maxWidth: number): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const cleanup = () => { video.removeAttribute("src"); video.load(); };
    const capture = () => {
      try {
        const sourceWidth = video.videoWidth || maxWidth;
        const sourceHeight = video.videoHeight || maxWidth;
        const ratio = Math.min(maxWidth / sourceWidth, 1);
        const w = Math.max(1, Math.round(sourceWidth * ratio));
        const h = Math.max(1, Math.round(sourceHeight * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas context unavailable");
        ctx.drawImage(video, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", THUMBNAIL_JPEG_QUALITY));
      } catch {
        resolve(dataUrl);
      } finally {
        cleanup();
      }
    };
    video.onloadedmetadata = () => {
      try { video.currentTime = Math.min(0.1, (video.duration || 1) / 2); } catch { capture(); }
    };
    video.onseeked = capture;
    video.onerror = () => resolve(dataUrl);
    video.src = dataUrl;
  });
}

export async function thumbnailFromDataUrl(dataUrl: string, maxWidth = 320): Promise<string> {
  if (dataUrl.startsWith("data:video/")) return videoThumbnailFromDataUrl(dataUrl, maxWidth);
  return imageThumbnailFromDataUrl(dataUrl, maxWidth);
}

export async function saveResultImage(
  resultId: string,
  dataUrl: string
): Promise<{ filePath: string; thumbPath: string }> {
  if (!isTauri) return { filePath: dataUrl, thumbPath: dataUrl };

  const { writeFile, mkdir } = await import("@tauri-apps/plugin-fs");
  const { resultsDir: dir } = await getAppDataLibraryPaths();
  await mkdir(dir, { recursive: true });

  const ext = extFromDataUrl(dataUrl);
  const filePath = `${dir}${resultId}.${ext}`;
  await writeFile(filePath, dataUrlToBytes(dataUrl));

  const thumbDataUrl = await thumbnailFromDataUrl(dataUrl, 320);
  const thumbPath = `${dir}${resultId}_thumb.jpg`;
  await writeFile(thumbPath, dataUrlToBytes(thumbDataUrl));

  return { filePath, thumbPath };
}

export async function saveReferenceImage(
  refId: string,
  dataUrl: string
): Promise<{ filePath: string; thumbPath: string }> {
  if (!isTauri) return { filePath: dataUrl, thumbPath: dataUrl };

  const { writeFile, mkdir } = await import("@tauri-apps/plugin-fs");
  const { referencesDir: dir } = await getAppDataLibraryPaths();
  await mkdir(dir, { recursive: true });

  const ext = extFromDataUrl(dataUrl);
  const filePath = `${dir}${refId}.${ext}`;
  await writeFile(filePath, dataUrlToBytes(dataUrl));

  const thumbDataUrl = await thumbnailFromDataUrl(dataUrl, 320);
  const thumbPath = `${dir}${refId}_thumb.jpg`;
  await writeFile(thumbPath, dataUrlToBytes(thumbDataUrl));

  return { filePath, thumbPath };
}

export async function readImageAsDataUrl(filePath: string): Promise<string> {
  if (!isTauri || filePath.startsWith("data:")) return filePath;
  const { readFile } = await import("@tauri-apps/plugin-fs");
  let resolvedPath = filePath;
  let bytes: Uint8Array;
  try {
    bytes = await readFile(resolvedPath);
  } catch (error) {
    const portablePath = resolvePortableImagePath(filePath, await getAppDataLibraryPaths());
    if (portablePath === filePath) throw error;
    resolvedPath = portablePath;
    bytes = await readFile(resolvedPath);
  }
  return bytesToDataUrl(bytes, resolvedPath);
}

const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m4v: "video/x-m4v",
};

function bytesToDataUrl(bytes: Uint8Array, filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "jpg";
  const mime = EXT_TO_MIME[ext] ?? "image/jpeg";
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return `data:${mime};base64,${btoa(binary)}`;
}

// Synchronous: converts an absolute file path to a Tauri asset URL suitable
// for <img src>. Returns the data URL as-is, and undefined for null/empty paths.
export function toDisplaySrc(filePath: string | undefined): string | undefined {
  if (!filePath) return undefined;
  if (filePath.startsWith("data:")) return filePath;
  const convert = _convertFileSrc ?? tauriConvertFileSrc();
  if (!convert) return undefined;
  return convert(filePath);
}

export function imageDisplaySrc(src: string | undefined): string | undefined {
  if (!src) return undefined;
  if (isDirectImageSrc(src)) {
    return src;
  }
  return toDisplaySrc(src);
}

export function isDirectImageSrc(src: string | undefined): boolean {
  if (!src) return false;
  return (
    src.startsWith("data:") ||
    src.startsWith("blob:") ||
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("asset:") ||
    src.startsWith("tauri://")
  );
}

export function isStoredImagePath(src: string | undefined): boolean {
  return Boolean(src && !isDirectImageSrc(src));
}

export function resolvePortableImagePath(src: string, paths: LibraryPaths): string {
  if (!src || isDirectImageSrc(src)) return src;
  const normalized = src.replace(/\\/g, "/");
  const activeResults = paths.resultsDir;
  const activeReferences = paths.referencesDir;

  if (normalized.startsWith(activeResults) || normalized.startsWith(activeReferences)) {
    return normalized;
  }

  const resultRelative = relativeAfterMediaDir(normalized, "results");
  if (resultRelative) return `${activeResults}${resultRelative}`;

  const referenceRelative = relativeAfterMediaDir(normalized, "references");
  if (referenceRelative) return `${activeReferences}${referenceRelative}`;

  return src;
}

function relativeAfterMediaDir(path: string, dirName: "results" | "references"): string | null {
  const directPrefix = `${dirName}/`;
  if (path.startsWith(directPrefix)) return path.slice(directPrefix.length);

  const marker = `/${dirName}/`;
  const index = path.lastIndexOf(marker);
  if (index < 0) return null;

  const relative = path.slice(index + marker.length);
  return relative && !relative.startsWith("../") ? relative : null;
}

// ─── Staged media lifecycle ───────────────────────────────────

export interface StagedMedia {
  originalTemp: string;
  thumbnailTemp: string;
  originalFinal: string;
  thumbnailFinal: string;
}

export async function stageManagedImage(
  kind: "result" | "reference",
  id: string,
  dataUrl: string
): Promise<StagedMedia> {
  if (!isTauri) {
    return { originalTemp: dataUrl, thumbnailTemp: dataUrl, originalFinal: dataUrl, thumbnailFinal: dataUrl };
  }
  const { writeFile, mkdir } = await import("@tauri-apps/plugin-fs");
  const paths = await getAppDataLibraryPaths();
  const dir = kind === "result" ? paths.resultsDir : paths.referencesDir;
  await mkdir(dir, { recursive: true });

  const ext = extFromDataUrl(dataUrl);
  const originalFinal = `${dir}${id}.${ext}`;
  const thumbnailFinal = `${dir}${id}_thumb.jpg`;
  const originalTemp = `${dir}${id}_staging.${ext}`;
  const thumbnailTemp = `${dir}${id}_staging_thumb.jpg`;

  await writeFile(originalTemp, dataUrlToBytes(dataUrl));
  const thumbDataUrl = await thumbnailFromDataUrl(dataUrl, 320);
  await writeFile(thumbnailTemp, dataUrlToBytes(thumbDataUrl));

  return { originalTemp, thumbnailTemp, originalFinal, thumbnailFinal };
}

export async function publishStagedMedia(media: StagedMedia): Promise<void> {
  if (!isTauri) return;
  const { rename } = await import("@tauri-apps/plugin-fs");
  await rename(media.originalTemp, media.originalFinal);
  await rename(media.thumbnailTemp, media.thumbnailFinal);
}

export async function cleanupStagedMedia(media: StagedMedia): Promise<void> {
  if (!isTauri) return;
  const { remove } = await import("@tauri-apps/plugin-fs");
  try { await remove(media.originalTemp); } catch {}
  try { await remove(media.thumbnailTemp); } catch {}
}

export async function removeManagedPaths(paths: Array<string | null | undefined>): Promise<void> {
  if (!isTauri) return;
  const { remove } = await import("@tauri-apps/plugin-fs");
  for (const p of paths) {
    if (!p) continue;
    try { await remove(p); } catch {}
  }
}

export async function deleteResultFiles(resultId: string): Promise<void> {
  if (!isTauri) return;
  const { remove } = await import("@tauri-apps/plugin-fs");
  const { resultsDir: dir } = await getAppDataLibraryPaths();
  for (const ext of ["jpg", "png", "webp"]) {
    try { await remove(`${dir}${resultId}.${ext}`); } catch {}
  }
  try { await remove(`${dir}${resultId}_thumb.jpg`); } catch {}
}

export async function deleteReferenceFiles(refId: string): Promise<void> {
  if (!isTauri) return;
  const { remove } = await import("@tauri-apps/plugin-fs");
  const { referencesDir: dir } = await getAppDataLibraryPaths();
  for (const ext of ["jpg", "png", "webp"]) {
    try { await remove(`${dir}${refId}.${ext}`); } catch {}
  }
  try { await remove(`${dir}${refId}_thumb.jpg`); } catch {}
}
