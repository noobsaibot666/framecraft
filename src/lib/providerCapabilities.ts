// Single source of truth for which generation providers produce video vs
// still images — used to gate video-only / image-only fields in Project
// Setup and Prompt Craft (Sections 8, 27).

export const VIDEO_PROVIDERS = new Set(["seedance", "kling", "runway", "higgsfield"]);

export function isVideoProvider(provider?: string): boolean {
  return !!provider && VIDEO_PROVIDERS.has(provider);
}
