import { describe, expect, it } from "vitest";
import { createShotPromptVersion, getShotPromptVersions } from "./cinemaShotPromptVersions";

describe("cinema shot prompt version development store", () => {
  it("creates and lists versions newest-first for a shot", async () => {
    const shotId = "shot-a";
    await createShotPromptVersion(shotId, "First prompt", "v1");
    await new Promise((r) => setTimeout(r, 2));
    await createShotPromptVersion(shotId, "Second prompt", "v2");

    const versions = await getShotPromptVersions(shotId);
    expect(versions.length).toBe(2);
    expect(versions[0].content).toBe("Second prompt");
    expect(versions[1].content).toBe("First prompt");
  });

  it("scopes versions per shot", async () => {
    await createShotPromptVersion("shot-b", "Shot B prompt");
    const versionsOther = await getShotPromptVersions("shot-scoped-other");
    expect(versionsOther.some((v) => v.content === "Shot B prompt")).toBe(false);
  });
});
