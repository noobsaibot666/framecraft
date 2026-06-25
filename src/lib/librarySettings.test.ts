import { describe, expect, it, vi } from "vitest";
import { LIBRARY_PATH_STORAGE_KEY, type LibraryStorage } from "./libraryConfig";
import { collectPortableMediaFilenames, selectValidatedLibrary } from "./librarySettings";

function createStorage(): LibraryStorage & { data: Record<string, string> } {
  const storage = {
    data: {} as Record<string, string>,
    getItem(key: string) {
      return storage.data[key] ?? null;
    },
    setItem(key: string, value: string) {
      storage.data[key] = value;
    },
    removeItem(key: string) {
      delete storage.data[key];
    },
  };
  return storage;
}

describe("librarySettings", () => {
  it("persists only a valid portable library selection", async () => {
    const storage = createStorage();
    const validateLibrary = vi.fn(async () => ({ ok: true, errors: [] }));

    await expect(
      selectValidatedLibrary("/Volumes/NAS/Client.framecraftlib", { storage, validateLibrary })
    ).resolves.toEqual({
      path: "/Volumes/NAS/Client.framecraftlib",
      restartRequired: true,
    });

    expect(validateLibrary).toHaveBeenCalledWith("/Volumes/NAS/Client.framecraftlib");
    expect(storage.data[LIBRARY_PATH_STORAGE_KEY]).toBe("/Volumes/NAS/Client.framecraftlib");
  });

  it("rejects an invalid portable library selection", async () => {
    const storage = createStorage();

    await expect(
      selectValidatedLibrary("/Volumes/NAS/Broken.framecraftlib", {
        storage,
        validateLibrary: async () => ({ ok: false, errors: ["Missing framecraft.db"] }),
      })
    ).rejects.toThrow("Missing framecraft.db");

    expect(storage.data[LIBRARY_PATH_STORAGE_KEY]).toBeUndefined();
  });

  it("collects result and reference media paths relative to app data", () => {
    const files = collectPortableMediaFilenames(
      {
        resultPaths: [
          "/app/results/a.png",
          "/app/results/a_thumb.jpg",
          "data:image/png;base64,abc",
          "/outside/skip.png",
        ],
        referencePaths: ["/app/references/ref/b.jpg", "/app/references/ref/b_thumb.jpg"],
      },
      {
        resultsDir: "/app/results/",
        referencesDir: "/app/references/",
      }
    );

    expect(files).toEqual({
      resultFiles: ["a.png", "a_thumb.jpg"],
      referenceFiles: ["ref/b.jpg", "ref/b_thumb.jpg"],
    });
  });
});
