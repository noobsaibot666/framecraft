import { describe, expect, it } from "vitest";
import { buildProjectTokenSuggestions, buildSuppressionText } from "./craftContext";
import type { Project } from "@/types";

const project: Project = {
  id: "project-1",
  title: "Launch Campaign",
  status: "draft",
  project_type: "campaign",
  intended_output: "Hero image series, short motion tests",
  image_needs: "premium studio realism, product closeups",
  video_needs: "slow camera movement; liquid pour",
  visual_direction: "restrained luxury, natural skin texture",
  constraints: "avoid plastic skin, no fake cinematic sheen",
  creative_goals: "reusable prompt baseline, grounded product lighting",
  aspect_ratios: ["16:9"],
  provider_targets: ["midjourney"],
  tags: ["skincare", "launch"],
  created_at: "2026-06-26T00:00:00Z",
  updated_at: "2026-06-26T00:00:00Z",
};

describe("craftContext", () => {
  it("builds deduplicated project token suggestions from setup fields", () => {
    const suggestions = buildProjectTokenSuggestions(project, {
      selectedTexts: ["restrained luxury"],
      promptText: "existing premium studio realism prompt",
    });

    expect(suggestions.map((s) => s.text)).toContain("natural skin texture");
    expect(suggestions.map((s) => s.text)).toContain("product closeups");
    expect(suggestions.map((s) => s.text)).toContain("slow camera movement");
    expect(suggestions.map((s) => s.text)).toContain("skincare");
    expect(suggestions.map((s) => s.text)).not.toContain("restrained luxury");
    expect(suggestions.map((s) => s.text)).not.toContain("premium studio realism");
  });

  it("keeps project suggestions bounded", () => {
    const suggestions = buildProjectTokenSuggestions(project, { limit: 3 });
    expect(suggestions).toHaveLength(3);
  });

  it("combines project constraints and avoidance text for token suppression", () => {
    const suppression = buildSuppressionText(project, "no waxy surfaces");

    expect(suppression).toContain("avoid plastic skin");
    expect(suppression).toContain("no fake cinematic sheen");
    expect(suppression).toContain("no waxy surfaces");
  });
});
