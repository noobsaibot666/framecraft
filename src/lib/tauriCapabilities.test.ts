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

    expect(fsScope?.allow).toContain("$APPDATA/**/*");
    expect(fsScope?.allow).toContain("$HOME/**/*");
    expect(fsScope?.allow).toContain("/Volumes/**/*");
    expect(fsScope?.allow).toContain("**/*");
  });
});
