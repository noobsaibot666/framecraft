const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// Pre-cache convertFileSrc so toDisplaySrc stays synchronous
let _convertFileSrc: ((path: string) => string) | undefined;
if (isTauri) {
  import("@tauri-apps/api/core")
    .then((m) => { _convertFileSrc = m.convertFileSrc; })
    .catch(() => {});
}

// ─── Path helpers ─────────────────────────────────────────────

async function appDataBase(): Promise<string> {
  const { appDataDir } = await import("@tauri-apps/api/path");
  const dir = await appDataDir();
  return dir.endsWith("/") ? dir : dir + "/";
}

export function getResultDir(base: string): string {
  return `${base}results/`;
}

export function getRefDir(base: string): string {
  return `${base}references/`;
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
  return "jpg";
}

// ─── Public API ───────────────────────────────────────────────

export async function thumbnailFromDataUrl(dataUrl: string, maxWidth = 320): Promise<string> {
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
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function saveResultImage(
  resultId: string,
  dataUrl: string
): Promise<{ filePath: string; thumbPath: string }> {
  if (!isTauri) return { filePath: dataUrl, thumbPath: dataUrl };

  const { writeFile, mkdir } = await import("@tauri-apps/plugin-fs");
  const base = await appDataBase();
  const dir = getResultDir(base);
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
  const base = await appDataBase();
  const dir = getRefDir(base);
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
  const bytes = await readFile(filePath);
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "jpg";
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return `data:${mime};base64,${btoa(binary)}`;
}

// Synchronous: converts an absolute file path to a Tauri asset URL suitable
// for <img src>. Returns the data URL as-is, and undefined for null/empty paths.
export function toDisplaySrc(filePath: string | undefined): string | undefined {
  if (!filePath) return undefined;
  if (filePath.startsWith("data:")) return filePath;
  if (!isTauri || !_convertFileSrc) return undefined;
  return _convertFileSrc(filePath);
}

export async function deleteResultFiles(resultId: string): Promise<void> {
  if (!isTauri) return;
  const { remove } = await import("@tauri-apps/plugin-fs");
  const base = await appDataBase();
  const dir = getResultDir(base);
  for (const ext of ["jpg", "png", "webp"]) {
    try { await remove(`${dir}${resultId}.${ext}`); } catch {}
  }
  try { await remove(`${dir}${resultId}_thumb.jpg`); } catch {}
}

export async function deleteReferenceFiles(refId: string): Promise<void> {
  if (!isTauri) return;
  const { remove } = await import("@tauri-apps/plugin-fs");
  const base = await appDataBase();
  const dir = getRefDir(base);
  for (const ext of ["jpg", "png", "webp"]) {
    try { await remove(`${dir}${refId}.${ext}`); } catch {}
  }
  try { await remove(`${dir}${refId}_thumb.jpg`); } catch {}
}
