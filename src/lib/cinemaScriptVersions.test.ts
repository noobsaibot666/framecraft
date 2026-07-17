import { describe, expect, it } from "vitest";
import { createScriptVersion, getScriptVersions } from "./cinemaScriptVersions";

describe("cinema script version development store", () => {
  it("creates and lists versions newest-first for a project", async () => {
    const projectId = "script-project-a";
    await createScriptVersion(projectId, "First draft", "v1");
    await new Promise((r) => setTimeout(r, 2));
    await createScriptVersion(projectId, "Second draft", "v2");

    const versions = await getScriptVersions(projectId);
    expect(versions.length).toBe(2);
    expect(versions[0].content).toBe("Second draft");
    expect(versions[1].content).toBe("First draft");
  });

  it("scopes versions per project", async () => {
    await createScriptVersion("script-project-b", "Project B script");
    const versionsA = await getScriptVersions("script-project-scoped-a");
    expect(versionsA.some((v) => v.content === "Project B script")).toBe(false);
  });
});
