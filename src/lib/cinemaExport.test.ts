import { beforeEach, describe, expect, it } from "vitest";
import { exportAssetsWithNaming, getExtensionFromDataUrl, tagToFilename } from "./cinemaExport";
import type { CinemaAsset } from "@/types";

function asset(overrides: Partial<CinemaAsset> = {}): CinemaAsset {
  return {
    id: "a1",
    project_id: "p1",
    folder_id: "f1",
    tag: "@eduardo",
    title: "Eduardo",
    asset_type: "character_sheet",
    is_primary: false,
    canvas_x: 0,
    canvas_y: 0,
    sort_order: 0,
    created_at: "t",
    updated_at: "t",
    ...overrides,
  };
}

describe("getExtensionFromDataUrl", () => {
  it("extracts the image type from a data URL", () => {
    expect(getExtensionFromDataUrl("data:image/png;base64,abc")).toBe("png");
    expect(getExtensionFromDataUrl("data:image/webp;base64,abc")).toBe("webp");
  });

  it("normalizes jpeg to jpg", () => {
    expect(getExtensionFromDataUrl("data:image/jpeg;base64,abc")).toBe("jpg");
  });

  it("falls back to png for an unrecognized data URL", () => {
    expect(getExtensionFromDataUrl("not-a-data-url")).toBe("png");
  });
});

describe("tagToFilename", () => {
  it("strips the leading @ and lowercases", () => {
    expect(tagToFilename("@Eduardo")).toBe("eduardo");
  });

  it("replaces unsafe characters with underscores, trimming leading/trailing ones", () => {
    expect(tagToFilename("@loc cabin!")).toBe("loc_cabin");
  });
});

describe("exportAssetsWithNaming", () => {
  // This app's Vitest suite runs in the default "node" environment (no real
  // DOM) — stub just enough of `document` for the download-anchor trick,
  // same lightweight-mock convention as the localStorage stubs elsewhere
  // (e.g. cinemaProjects.test.ts / promptFormula.test.ts).
  const clicked: { href: string; download: string }[] = [];
  beforeEach(() => {
    clicked.length = 0;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        createElement: (_tag: string) => {
          const el = { href: "", download: "", click: function () { clicked.push({ href: this.href, download: this.download }); } };
          return el;
        },
      },
    });
  });

  it("counts assets with file_data as exported and others as skipped", async () => {
    const assets = [
      asset({ id: "a1", tag: "@a", file_data: "data:image/png;base64,x" }),
      asset({ id: "a2", tag: "@b" }),
    ];
    const result = await exportAssetsWithNaming(assets);
    expect(result).toEqual({ exported: 1, skipped: 1 });
    expect(clicked).toEqual([{ href: "data:image/png;base64,x", download: "a.png" }]);
  });

  it("exports nothing when no assets have images", async () => {
    const result = await exportAssetsWithNaming([asset({ tag: "@a" }), asset({ tag: "@b" })]);
    expect(result).toEqual({ exported: 0, skipped: 2 });
    expect(clicked).toEqual([]);
  });
});
