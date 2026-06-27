import { describe, it, expect } from "vitest";
import {
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getProjectsForCampaign,
  setProjectCampaign,
} from "./campaigns";

// All DB calls are Tauri-gated — dev/test mode returns empty/null/void.

describe("getCampaigns (dev mode)", () => {
  it("resolves to empty array", async () => {
    await expect(getCampaigns()).resolves.toEqual([]);
  });
});

describe("getCampaign (dev mode)", () => {
  it("resolves to null for any id", async () => {
    await expect(getCampaign("any-id")).resolves.toBeNull();
  });
});

describe("createCampaign (dev mode)", () => {
  it("returns a Campaign-shaped object", async () => {
    const c = await createCampaign({ title: "Summer 2026", client: "Acme" });
    expect(c.title).toBe("Summer 2026");
    expect(c.client).toBe("Acme");
    expect(c.status).toBe("active");
    expect(typeof c.id).toBe("string");
    expect(c.id.length).toBeGreaterThan(0);
  });

  it("sets project_count to 0 in dev mode", async () => {
    const c = await createCampaign({ title: "Test" });
    expect(c.project_count).toBe(0);
  });
});

describe("updateCampaign (dev mode)", () => {
  it("resolves without throwing", async () => {
    await expect(updateCampaign("id", { title: "New title" })).resolves.toBeUndefined();
  });
});

describe("deleteCampaign (dev mode)", () => {
  it("resolves without throwing", async () => {
    await expect(deleteCampaign("id")).resolves.toBeUndefined();
  });
});

describe("getProjectsForCampaign (dev mode)", () => {
  it("resolves to empty array", async () => {
    await expect(getProjectsForCampaign("campaign-id")).resolves.toEqual([]);
  });
});

describe("setProjectCampaign (dev mode)", () => {
  it("resolves without throwing", async () => {
    await expect(setProjectCampaign("proj-id", "camp-id")).resolves.toBeUndefined();
  });
  it("accepts null to unlink", async () => {
    await expect(setProjectCampaign("proj-id", null)).resolves.toBeUndefined();
  });
});
