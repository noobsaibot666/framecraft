import type { AnalysisResult } from "@/lib/analyzeImage";
import type { CreatePromptInput } from "@/lib/db";

export interface FrameAnalysisResult {
  frameIdx: number;
  result: AnalysisResult;
  error?: string;
}

export function frameFilename(videoName: string, timestamp: number): string {
  const base = videoName
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "video";
  const totalSeconds = Math.max(0, Math.floor(timestamp));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${base}-frame-${String(minutes).padStart(2, "0")}m${String(seconds).padStart(2, "0")}s.png`;
}

export function buildFramePromptInput(
  result: AnalysisResult,
  frameDataUrl: string
): CreatePromptInput {
  return {
    title: result.title,
    prompt_text: result.suggested_prompt,
    provider: "midjourney",
    tags: result.tags,
    aspect_ratio: result.aspect_ratio || undefined,
    notes: result.style_notes,
    avoidance_text: result.avoidance_suggestions?.length
      ? result.avoidance_suggestions.join(", ")
      : undefined,
    image_ref: frameDataUrl,
  };
}

export function importableFrameResults(
  results: FrameAnalysisResult[],
  importedIds: Set<number>
): FrameAnalysisResult[] {
  return results.filter((r) => !r.error && !importedIds.has(r.frameIdx));
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
