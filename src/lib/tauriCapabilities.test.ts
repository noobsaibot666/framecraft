import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Tauri FS capabilities", () => {
  it("allows portable library read/write outside app data", () => {
    const capabilityPath = resolve(process.cwd(), "src-tauri/capabilities/default.json");
    const capability = JSON.parse(readFileSync(capabilityPath, "utf8")) as {
      permissions?: Array<string | { identifier?: string; allow?: string[] }>;
    };

    const fsScope = capability.permissions?.find(
      (permission): permission is { identifier: string; allow: string[] } =>
        typeof permission === "object" && permission.identifier === "fs:scope"
    );

    expect(fsScope?.allow).toEqual(
      expect.arrayContaining(["$APPDATA", "$APPDATA/**", "$HOME", "$HOME/**", "/Volumes", "/Volumes/**"])
    );
    expect(fsScope?.allow).toContain("**/*");
  });

  it("uses built-in recursive scopes for common user-selected library locations", () => {
    const capabilityPath = resolve(process.cwd(), "src-tauri/capabilities/default.json");
    const capability = JSON.parse(readFileSync(capabilityPath, "utf8")) as {
      permissions?: Array<string | { identifier?: string; allow?: string[] }>;
    };

    expect(capability.permissions).toEqual(
      expect.arrayContaining([
        "fs:allow-home-read-recursive",
        "fs:allow-home-write-recursive",
        "fs:allow-download-read-recursive",
        "fs:allow-download-write-recursive",
        "fs:allow-document-read-recursive",
        "fs:allow-document-write-recursive",
      ])
    );
  });

  it("allows selected library directories before their child files exist", () => {
    const capabilityPath = resolve(process.cwd(), "src-tauri/capabilities/default.json");
    const capability = JSON.parse(readFileSync(capabilityPath, "utf8")) as {
      permissions?: Array<string | { identifier?: string; allow?: string[] }>;
    };

    const fsScope = capability.permissions?.find(
      (permission): permission is { identifier: string; allow: string[] } =>
        typeof permission === "object" && permission.identifier === "fs:scope"
    );

    expect(fsScope?.allow).toEqual(expect.arrayContaining(["$HOME", "$HOME/**", "/Volumes", "/Volumes/**"]));
  });
});
