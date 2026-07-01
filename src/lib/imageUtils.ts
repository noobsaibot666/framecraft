// Upload guards — reject oversized/unsupported files before reading them into memory.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"] as const;

/** Returns a human-readable error message if the file is invalid, or null if it passes. */
export function validateImageFile(file: File, maxBytes = MAX_UPLOAD_BYTES): string | null {
  // Some drag-drop/paste sources leave `type` empty; fall back to extension when it does.
  const type = file.type?.toLowerCase() ?? "";
  const looksLikeImage = type.startsWith("image/") || /\.(jpe?g|png|webp|gif|avif)$/i.test(file.name);
  if (!looksLikeImage) return "Unsupported file type — please choose a JPEG, PNG, WEBP, GIF, or AVIF image.";
  if (type && type.startsWith("image/") && !ALLOWED_IMAGE_TYPES.includes(type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return `Unsupported image format (${type}). Use JPEG, PNG, WEBP, GIF, or AVIF.`;
  }
  if (file.size > maxBytes) {
    const mb = (maxBytes / (1024 * 1024)).toFixed(0);
    const actual = (file.size / (1024 * 1024)).toFixed(1);
    return `Image is too large (${actual} MB). Maximum is ${mb} MB.`;
  }
  return null;
}

export function generateThumbnail(file: File, maxSize = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas context unavailable")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

export function fileToPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

export async function fileToDataUrl(file: File): Promise<string> {
  const invalid = validateImageFile(file);
  if (invalid) throw new Error(invalid);
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${file.type || "application/octet-stream"};base64,${btoa(binary)}`;
}
