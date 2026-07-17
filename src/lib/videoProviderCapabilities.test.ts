import { describe, expect, it } from "vitest";
import { getGeneralStageTips, getProTips, getProviderCapability } from "./videoProviderCapabilities";

describe("videoProviderCapabilities", () => {
  it("returns capability data for higgsfield noting it sees image reference", () => {
    const cap = getProviderCapability("higgsfield");
    expect(cap).toBeDefined();
    expect(cap!.acceptsImageReference).toBe(true);
    expect(cap!.kind).toBe("video");
  });

  it("returns undefined for an unmapped provider", () => {
    expect(getProviderCapability("dalle")).toBeUndefined();
    expect(getProviderCapability(undefined)).toBeUndefined();
  });

  it("returns general stage tips even with no provider selected", () => {
    const tips = getGeneralStageTips("assets");
    expect(tips.length).toBeGreaterThan(0);
  });

  it("combines general tips with provider-specific watch-outs", () => {
    const generalOnly = getProTips("scenes");
    const withProvider = getProTips("scenes", "kling");
    expect(withProvider.length).toBeGreaterThan(generalOnly.length);
  });
});
