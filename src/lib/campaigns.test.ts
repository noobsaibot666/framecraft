import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getProjectsForCampaign,
  setProjectCampaign,
} from "./campaigns";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./dbConnection", () => ({ getFramecraftDb: mocks.getDb }));

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

// ─── DB error propagation (Tauri branch) ─────────────────────

function fakeDb(error: string) {
  const reject = () => Promise.reject(error);
  return { select: reject, execute: reject };
}

describe("campaigns DB error propagation", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("getCampaigns propagates non-schema DB errors", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    mocks.getDb.mockResolvedValue(fakeDb("disk I/O error"));
    const { getCampaigns: getCampaignsFresh } = await import("./campaigns");
    await expect(getCampaignsFresh()).rejects.toThrow("getCampaigns: disk I/O error");
  });

  it("getProjectsForCampaign propagates DB errors", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    mocks.getDb.mockResolvedValue(fakeDb("SQLITE_BUSY"));
    const { getProjectsForCampaign: fresh } = await import("./campaigns");
    await expect(fresh("c")).rejects.toThrow("getProjectsForCampaign: SQLITE_BUSY");
  });

  it("searchCampaigns propagates DB errors", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    mocks.getDb.mockResolvedValue(fakeDb("corrupt page"));
    const { searchCampaigns: fresh } = await import("./campaigns");
    await expect(fresh("brand")).rejects.toThrow("searchCampaigns: corrupt page");
  });

  it("setProjectCampaign propagates non-schema DB errors", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    mocks.getDb.mockResolvedValue(fakeDb("permission denied"));
    const { setProjectCampaign: fresh } = await import("./campaigns");
    await expect(fresh("proj", "camp")).rejects.toThrow("setProjectCampaign: permission denied");
  });

  it("getCampaigns falls back silently when campaign_id column is missing", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const fallbackRows = [{ id: "c1", title: "Brand Launch", status: "active", created_at: "t", updated_at: "t", project_count: 0, winner_count: 0 }];
    mocks.getDb.mockResolvedValue({
      select: vi.fn()
        .mockRejectedValueOnce("table projects has no column named campaign_id")
        .mockResolvedValueOnce(fallbackRows),
      execute: vi.fn(),
    });
    const { getCampaigns: fresh } = await import("./campaigns");
    const result = await fresh();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Brand Launch");
  });
});
