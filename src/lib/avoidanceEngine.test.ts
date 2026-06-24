import { describe, expect, it } from "vitest";
import { detectRisks } from "./avoidanceEngine";
import type { AvoidancePattern } from "@/types";

describe("detectRisks", () => {
  it("matches custom rules using their label, description, and correction text", () => {
    const customPattern: AvoidancePattern = {
      id: "custom_1",
      artifact_type: "custom_reflection_problem",
      label: "Bent watch reflection",
      category: "all",
      description: "Watch faces bending in reflective product shots",
      correction_prompt: "straight watch face reflection, physically accurate watch glass",
      severity: "high",
      is_builtin: false,
    };

    const risks = detectRisks("Luxury watch product shot with bending reflective glass", [customPattern]);

    expect(risks).toHaveLength(1);
    expect(risks[0].triggered_by).toContain("watch");
    expect(risks[0].triggered_by).toContain("reflective");
  });
});
