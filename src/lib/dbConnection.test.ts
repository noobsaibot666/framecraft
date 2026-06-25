import { afterEach, describe, expect, it, vi } from "vitest";

const load = vi.fn(async (url: string) => ({ url }));

vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load },
}));

describe("dbConnection", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads the current default Framecraft sqlite URL once", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const { getFramecraftDb } = await import("./dbConnection");

    const first = await getFramecraftDb();
    const second = await getFramecraftDb();

    expect(first).toBe(second);
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith("sqlite:framecraft.db");
  });

  it("throws outside Tauri context", async () => {
    vi.stubGlobal("window", {});
    const { getFramecraftDb } = await import("./dbConnection");

    await expect(getFramecraftDb()).rejects.toThrow("Not in Tauri context");
  });
});
