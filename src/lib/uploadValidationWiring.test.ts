import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("image upload validation wiring", () => {
  for (const [file, conversion] of [
    ["ResultReview.tsx", "fileToDataUrl"],
    ["ComparisonLab.tsx", "fileToDataUrl"],
    ["ManualImport.tsx", "readAsDataURL"],
    ["ReferenceLibrary.tsx", "fileToDataUrl"],
  ] as const) {
    it(`${file} validates before converting image bytes`, () => {
      const source = readFileSync(resolve(process.cwd(), "src/pages", file), "utf8");
      expect(source).toContain("validateImageFile");
      expect(source.indexOf("validateImageFile")).toBeLessThan(source.lastIndexOf(conversion));
    });
  }
});
