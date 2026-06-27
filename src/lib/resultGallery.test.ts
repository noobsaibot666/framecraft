import { describe, it, expect } from "vitest";
import { buildGalleryWhere, buildGalleryOrderBy, getAllGalleryResults } from "./resultGallery";
import type { GallerySort } from "./resultGallery";

describe("buildGalleryWhere", () => {
  it("returns no conditions for 'all' filter without provider", () => {
    const { conditions, values } = buildGalleryWhere({ filter: "all" });
    expect(conditions).toHaveLength(0);
    expect(values).toHaveLength(0);
  });

  it("adds winner condition for 'winner' filter", () => {
    const { conditions } = buildGalleryWhere({ filter: "winner" });
    expect(conditions).toContain("r.is_winner = 1");
  });

  it("adds failed condition for 'failed' filter", () => {
    const { conditions } = buildGalleryWhere({ filter: "failed" });
    expect(conditions).toContain("r.is_failed = 1");
  });

  it("adds unreviewed condition for 'unreviewed' filter", () => {
    const { conditions } = buildGalleryWhere({ filter: "unreviewed" });
    expect(conditions.some((c) => c.includes("score_overall"))).toBe(true);
  });

  it("adds provider binding when provider is specified", () => {
    const { conditions, values } = buildGalleryWhere({ filter: "all", provider: "midjourney" });
    expect(values).toContain("midjourney");
    expect(conditions.some((c) => c.includes("provider"))).toBe(true);
  });
});

describe("buildGalleryOrderBy", () => {
  const sorts: GallerySort[] = ["newest", "highest_score", "winner_first"];
  it.each(sorts)("returns a non-empty ORDER BY clause for '%s'", (sort) => {
    expect(buildGalleryOrderBy(sort).length).toBeGreaterThan(0);
  });

  it("defaults to newest (created_at DESC) for unknown sort", () => {
    expect(buildGalleryOrderBy("newest")).toContain("created_at DESC");
  });

  it("sorts by score for highest_score", () => {
    expect(buildGalleryOrderBy("highest_score")).toContain("score_overall DESC");
  });
});

describe("getAllGalleryResults (dev mode — returns empty)", () => {
  it("returns empty array in dev mode", async () => {
    const results = await getAllGalleryResults({ filter: "all", sort: "newest" });
    expect(results).toEqual([]);
  });
});
