import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("recommendation cache invalidation wiring", () => {
  it("invalidates after every recommendation-affecting database write family", () => {
    const db = readFileSync(resolve(process.cwd(), "src/lib/db.ts"), "utf8");
    for (const functionName of [
      "clearAllData", "createToken", "toggleTokenFavorite", "batchUpdatePrompts", "updateTokenQualityFromResult", "createAvoidancePattern",
      "deleteAvoidancePattern", "updateSREFRating", "createSREF", "deleteSREF",
      "updateProfileRating", "createProfile", "deleteProfile",
    ]) {
      const start = db.indexOf(`function ${functionName}`);
      const next = db.indexOf("\nexport ", start + 1);
      expect(db.slice(start, next < 0 ? undefined : next), functionName).toContain("invalidateRecommendationCache()");
    }
  });

  it("invalidates after prompt and result reference relationship changes", () => {
    const references = readFileSync(resolve(process.cwd(), "src/lib/references.ts"), "utf8");
    for (const functionName of ["linkReferenceToPrompt", "unlinkReferenceFromPrompt", "linkReferenceToResult"]) {
      const start = references.indexOf(`function ${functionName}`);
      const next = references.indexOf("\nexport ", start + 1);
      expect(references.slice(start, next < 0 ? undefined : next), functionName).toContain("invalidateRecommendationCache()");
    }
  });
});
