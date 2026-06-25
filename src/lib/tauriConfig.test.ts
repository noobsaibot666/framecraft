import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Tauri media asset config", () => {
  it("allows app data and portable library images through the asset protocol", () => {
    const configPath = resolve(process.cwd(), "src-tauri/tauri.conf.json");
    const config = JSON.parse(readFileSync(configPath, "utf8")) as {
      app?: {
        security?: {
          csp?: string;
          assetProtocol?: {
            enable?: boolean;
            scope?: string[];
          };
        };
      };
    };

    expect(config.app?.security?.csp).toContain("asset:");
    expect(config.app?.security?.csp).toContain("http://asset.localhost");
    expect(config.app?.security?.assetProtocol?.enable).toBe(true);
    expect(config.app?.security?.assetProtocol?.scope).toEqual(
      expect.arrayContaining(["$APPDATA", "$APPDATA/**", "$HOME", "$HOME/**", "/Volumes", "/Volumes/**"])
    );
    expect(config.app?.security?.assetProtocol?.scope).toContain("**/*");
  });
});
