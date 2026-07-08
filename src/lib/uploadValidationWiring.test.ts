import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("image upload validation wiring", () => {
  for (const [file, conversion, validator] of [
    ["ResultReview.tsx", "fileToDataUrl", "validateMediaFile"],
    ["ComparisonLab.tsx", "fileToDataUrl", "validateMediaFile"],
    ["ManualImport.tsx", "readAsDataURL", "validateImageFile"],
    ["ReferenceLibrary.tsx", "fileToDataUrl", "validateMediaFile"],
  ] as const) {
    it(`${file} validates before converting image bytes`, () => {
      const source = readFileSync(resolve(process.cwd(), "src/pages", file), "utf8");
      expect(source).toContain(validator);
      expect(source.indexOf(validator)).toBeLessThan(source.lastIndexOf(conversion));
    });
  }
});
