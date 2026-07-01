import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("route loading and production chunks", () => {
  it("keeps route pages lazy without eager module-evaluation imports", () => {
    const source = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    expect(source).not.toMatch(/void import\("@\/pages\//);
    expect(source).toContain("fallback={<RouteFallback />}");
  });

  it("defines stable manual vendor chunks without grouping application pages", () => {
    const source = readFileSync(resolve(process.cwd(), "vite.config.ts"), "utf8");
    expect(source).toContain("manualChunks");
    expect(source).toContain("vendor-react");
    expect(source).toContain("vendor-tauri");
    expect(source).not.toContain('"@/pages"');
  });

  it("prefetches likely routes only on idle or navigation intent", () => {
    const shell = readFileSync(resolve(process.cwd(), "src/components/layout/AppShell.tsx"), "utf8");
    const sidebar = readFileSync(resolve(process.cwd(), "src/components/layout/Sidebar.tsx"), "utf8");
    const prefetch = readFileSync(resolve(process.cwd(), "src/lib/routePrefetch.ts"), "utf8");
    expect(shell).toContain("scheduleLikelyRoutePrefetch");
    expect(sidebar).toContain("onMouseEnter={() => prefetchRoute(to)}");
    expect(prefetch).toContain("requestIdleCallback");
    expect(prefetch).toContain("MAX_TRACKED_PREFETCHES");
  });
});
