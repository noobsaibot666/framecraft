type RouteLoader = () => Promise<unknown>;

const loaders: Record<string, RouteLoader> = {
  "/": () => import("@/pages/Dashboard"),
  "/library": () => import("@/pages/PromptLibrary"),
  "/projects": () => import("@/pages/ProjectLibrary"),
  "/results": () => import("@/pages/ResultGallery"),
  "/craft": () => import("@/pages/CraftPrompt"),
  "/references": () => import("@/pages/ReferenceLibrary"),
  "/tokens": () => import("@/pages/TokenLibrary"),
  "/campaigns": () => import("@/pages/CampaignLibrary"),
  "/queue": () => import("@/pages/GenerationQueue"),
  "/recipes": () => import("@/pages/RecipeLibrary"),
  "/import": () => import("@/pages/ManualImport"),
  "/srefs": () => import("@/pages/SREFLibrary"),
  "/analyze": () => import("@/pages/ImageAnalyzer"),
  "/brief": () => import("@/pages/BriefAnalyzer"),
  "/frames": () => import("@/pages/VideoFrames"),
  "/compare": () => import("@/pages/ComparisonLab"),
  "/settings": () => import("@/pages/Settings"),
};

const MAX_TRACKED_PREFETCHES = 8;
const prefetched = new Set<string>();

export function prefetchRoute(path: string): void {
  const loader = loaders[path];
  if (!loader || prefetched.has(path)) return;
  prefetched.add(path);
  if (prefetched.size > MAX_TRACKED_PREFETCHES) {
    const oldest = prefetched.values().next().value as string | undefined;
    if (oldest) prefetched.delete(oldest);
  }
  void loader().catch(() => prefetched.delete(path));
}

export function scheduleLikelyRoutePrefetch(): () => void {
  const warm = () => {
    prefetchRoute("/library");
    prefetchRoute("/projects");
  };
  const requestIdle = window.requestIdleCallback?.bind(window);
  if (requestIdle) {
    const id = requestIdle(warm, { timeout: 2_000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = globalThis.setTimeout(warm, 1_000);
  return () => globalThis.clearTimeout(id);
}
