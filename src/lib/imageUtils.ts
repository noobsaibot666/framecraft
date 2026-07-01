export interface ImageValidationOptions {
  maxBytes?: number;
  maxDimension?: number;
  maxPixels?: number;
}

type DimensionReader = (file: File) => Promise<{ width: number; height: number }>;

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(file);
      return { width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap?.close();
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The selected file is not a valid image."));
    };
    image.src = url;
  });
}

export async function validateImageFile(
  file: File,
  options: ImageValidationOptions = {},
  dimensions: DimensionReader = readImageDimensions
): Promise<{ width: number; height: number }> {
  const maxBytes = options.maxBytes ?? 25 * 1024 * 1024;
  const maxDimension = options.maxDimension ?? 12_000;
  const maxPixels = options.maxPixels ?? 40_000_000;
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) throw new Error("Use a JPEG, PNG, or WebP image.");
  if (file.size === 0) throw new Error("The selected image is empty.");
  if (file.size > maxBytes) throw new Error(`The selected image exceeds ${formatBytes(maxBytes)}.`);
  let result: { width: number; height: number };
  try {
    result = await dimensions(file);
  } catch {
    throw new Error("The selected file could not be decoded as an image.");
  }
  if (result.width <= 0 || result.height <= 0) throw new Error("The selected image has invalid dimensions.");
  if (result.width > maxDimension || result.height > maxDimension) {
    throw new Error(`Image dimensions must not exceed ${maxDimension.toLocaleString()} pixels.`);
  }
  if (result.width * result.height > maxPixels) {
    throw new Error(`Image area must not exceed ${Math.round(maxPixels / 1_000_000)} megapixels.`);
  }
  return result;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024 / 1024)} MiB`;
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
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${file.type || "application/octet-stream"};base64,${btoa(binary)}`;
}
