import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("stale request guard wiring", () => {
  for (const file of [
    "pages/PromptDetail.tsx",
    "pages/ProjectAssistant.tsx",
    "pages/CraftPrompt.tsx",
    "lib/useImageDisplaySrc.ts",
    "components/ui/TokenCloud.tsx",
    "components/ui/RecommendationPanel.tsx",
  ]) {
    it(`${file} checks request ownership before async state updates`, () => {
      const source = readFileSync(resolve(process.cwd(), "src", file), "utf8");
      expect(source).toContain("createLatestRequestGuard");
      expect(source).toContain("isCurrent");
      expect(source).toContain("invalidate");
    });
  }
});
