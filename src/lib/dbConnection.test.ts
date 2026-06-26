import { afterEach, describe, expect, it, vi } from "vitest";

const load = vi.fn(async (url: string) => ({ url }));
const invoke = vi.fn(async () => []);

vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load },
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke,
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

  it("uses native sqlite bridge for selected portable libraries", async () => {
    vi.stubGlobal("window", {
      __TAURI_INTERNALS__: {},
      localStorage: {
        getItem: (key: string) => key === "framecraft_library_path" ? "/Volumes/NAS/Client.framecraftlib" : null,
      },
    });
    const { getFramecraftDb } = await import("./dbConnection");

    const db = await getFramecraftDb();
    await db.select("SELECT name FROM sqlite_master WHERE type = $1", ["table"]);

    expect(load).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith("native_sqlite_select", {
      dbPath: "/Volumes/NAS/Client.framecraftlib/framecraft.db",
      query: "SELECT name FROM sqlite_master WHERE type = $1",
      bindValues: ["table"],
    });
  });

  it("throws outside Tauri context", async () => {
    vi.stubGlobal("window", {});
    const { getFramecraftDb } = await import("./dbConnection");

    await expect(getFramecraftDb()).rejects.toThrow("Not in Tauri context");
  });
});
