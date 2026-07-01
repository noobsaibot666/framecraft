import { describe, expect, it, vi } from "vitest";
import { resolveLibraryPaths } from "./libraryConfig";
import {
  importReferenceImage,
  importProjectResultImage,
  importResultImage,
  type SharedImportDeps,
} from "./sharedImport";

const PNG_DATA_URL = "data:image/png;base64,AQID";

const STAGED_REF = {
  originalTemp: "/refs/ref-a_staging.png",
  thumbnailTemp: "/refs/ref-a_staging_thumb.jpg",
  originalFinal: "/refs/ref-a.png",
  thumbnailFinal: "/refs/ref-a_thumb.jpg",
};

const STAGED_RESULT = {
  originalTemp: "/results/result-a_staging.png",
  thumbnailTemp: "/results/result-a_staging_thumb.jpg",
  originalFinal: "/results/result-a.png",
  thumbnailFinal: "/results/result-a_thumb.jpg",
};

function deps(mode: "portable" | "appData", valid = true): SharedImportDeps {
  return {
    getLibraryState: vi.fn(async () => ({
      selection: { mode, path: mode === "portable" ? "/lib/Work.framecraftlib" : null },
      paths: resolveLibraryPaths("/lib/Work.framecraftlib"),
      validation: mode === "portable" ? { ok: valid, errors: valid ? [] : ["Missing inbox directory"] } : null,
      nativeAvailable: true,
      activeLock: null,
    })),
    getIdentity: vi.fn(async () => ({ machine: "mac", user: "alan" })),
    createFs: vi.fn(async () => ({
      mkdir: vi.fn(),
      exists: vi.fn(),
      writeTextFile: vi.fn(),
      writeFile: vi.fn(),
      readTextFile: vi.fn(),
      readDir: vi.fn(),
      renameFile: vi.fn(),
      copyFile: vi.fn(),
      removeFile: vi.fn(),
    })),
    publishSharedIngestJob: vi.fn(async () => undefined),
    stageManagedImage: vi.fn(async (_kind, id) =>
      id.startsWith("ref") ? STAGED_REF : STAGED_RESULT
    ),
    publishStagedMedia: vi.fn(async () => undefined),
    cleanupStagedMedia: vi.fn(async () => undefined),
    removeManagedPaths: vi.fn(async () => undefined),
    createReference: vi.fn(async () => "ref-a"),
    deleteReference: vi.fn(async () => undefined),
    createResult: vi.fn(async () => "result-a"),
    deleteResult: vi.fn(async () => undefined),
    addResultToProject: vi.fn(async () => undefined),
    removeResultFromProject: vi.fn(async () => undefined),
    thumbnailFromDataUrl: vi.fn(async () => "data:image/jpeg;base64,BAUG"),
    generateId: vi.fn(() => "job-a"),
    now: vi.fn(() => "2026-06-25T10:00:00.000Z"),
  };
}

describe("sharedImport", () => {
  it("queues reference image imports for portable libraries", async () => {
    const d = deps("portable");

    const result = await importReferenceImage({
      referenceId: "ref-a",
      dataUrl: PNG_DATA_URL,
      reference: { title: "Mood", kind: "image" },
      originalName: "mood.png",
    }, d);

    expect(result).toEqual({ id: "ref-a", queued: true });
    expect(d.publishSharedIngestJob).toHaveBeenCalledOnce();
    expect(d.createReference).not.toHaveBeenCalled();
  });

  it("stages, inserts, then publishes for local app-data reference imports", async () => {
    const d = deps("appData");

    const result = await importReferenceImage({
      referenceId: "ref-a",
      dataUrl: PNG_DATA_URL,
      reference: { title: "Mood", kind: "image" },
      originalName: "mood.png",
    }, d);

    expect(result).toEqual({ id: "ref-a", queued: false });
    expect(d.stageManagedImage).toHaveBeenCalledWith("reference", "ref-a", PNG_DATA_URL);
    expect(d.createReference).toHaveBeenCalledWith({
      id: "ref-a",
      title: "Mood",
      kind: "image",
      file_data: STAGED_REF.originalFinal,
      thumbnail_data: STAGED_REF.thumbnailFinal,
    });
    expect(d.publishStagedMedia).toHaveBeenCalledWith(STAGED_REF);
    expect(d.publishSharedIngestJob).not.toHaveBeenCalled();
  });

  it("cleans up staged files when reference DB insertion fails", async () => {
    const d = deps("appData");
    d.createReference = vi.fn().mockRejectedValue(new Error("constraint failed"));

    await expect(importReferenceImage({
      referenceId: "ref-a",
      dataUrl: PNG_DATA_URL,
      reference: { title: "Mood", kind: "image" },
    }, d)).rejects.toThrow("constraint failed");

    expect(d.cleanupStagedMedia).toHaveBeenCalledWith(STAGED_REF);
    expect(d.publishStagedMedia).not.toHaveBeenCalled();
    expect(d.deleteReference).not.toHaveBeenCalled();
  });

  it("compensates with a row delete when reference publish fails", async () => {
    const d = deps("appData");
    d.publishStagedMedia = vi.fn().mockRejectedValue(new Error("rename failed"));

    await expect(importReferenceImage({
      referenceId: "ref-a",
      dataUrl: PNG_DATA_URL,
      reference: { title: "Mood", kind: "image" },
    }, d)).rejects.toThrow("rename failed");

    expect(d.deleteReference).toHaveBeenCalledWith("ref-a");
    expect(d.removeManagedPaths).toHaveBeenCalledWith([
      STAGED_REF.originalTemp, STAGED_REF.thumbnailTemp,
      STAGED_REF.originalFinal, STAGED_REF.thumbnailFinal,
    ]);
  });

  it("queues result image imports for portable libraries", async () => {
    const d = deps("portable");

    const result = await importResultImage({
      resultId: "result-a",
      promptId: "prompt-a",
      dataUrl: PNG_DATA_URL,
      result: { provider: "midjourney", score_overall: 4 },
      originalName: "result.png",
    }, d);

    expect(result).toEqual({ id: "result-a", queued: true });
    expect(d.publishSharedIngestJob).toHaveBeenCalledOnce();
    expect(d.createResult).not.toHaveBeenCalled();
  });

  it("cleans up staged files when result DB insertion fails", async () => {
    const d = deps("appData");
    d.createResult = vi.fn().mockRejectedValue(new Error("disk full"));

    await expect(importResultImage({
      resultId: "result-a",
      promptId: "prompt-a",
      dataUrl: PNG_DATA_URL,
      result: { provider: "midjourney", score_overall: 4 },
    }, d)).rejects.toThrow("disk full");

    expect(d.cleanupStagedMedia).toHaveBeenCalledWith(STAGED_RESULT);
    expect(d.publishStagedMedia).not.toHaveBeenCalled();
  });

  it("refuses portable imports when the active library package is invalid", async () => {
    const d = deps("portable", false);

    await expect(importReferenceImage({
      referenceId: "ref-a",
      dataUrl: PNG_DATA_URL,
      reference: { title: "Mood", kind: "image" },
      originalName: "mood.png",
    }, d)).rejects.toThrow("Repair the active library before importing: Missing inbox directory");

    expect(d.createReference).not.toHaveBeenCalled();
    expect(d.publishSharedIngestJob).not.toHaveBeenCalled();
  });

  it("queues result and project-link jobs for portable project result imports", async () => {
    const d = deps("portable");
    d.generateId = vi.fn()
      .mockReturnValueOnce("job-result")
      .mockReturnValueOnce("job-link");

    const result = await importProjectResultImage({
      resultId: "result-a",
      projectId: "project-1",
      promptId: "prompt-a",
      dataUrl: PNG_DATA_URL,
      result: { provider: "midjourney", notes: "Imported from project workspace" },
      originalName: "result.png",
    }, d);

    expect(result).toEqual({ id: "result-a", queued: true });
    expect(d.publishSharedIngestJob).toHaveBeenCalledTimes(2);
    expect(d.addResultToProject).not.toHaveBeenCalled();
  });

  it("stages, inserts, links, then publishes for local project result imports", async () => {
    const d = deps("appData");

    const result = await importProjectResultImage({
      resultId: "result-a",
      projectId: "project-1",
      promptId: "prompt-a",
      dataUrl: PNG_DATA_URL,
      result: { provider: "midjourney", notes: "Imported from project workspace" },
      originalName: "result.png",
    }, d);

    expect(result).toEqual({ id: "result-a", queued: false });
    expect(d.stageManagedImage).toHaveBeenCalledWith("result", "result-a", PNG_DATA_URL);
    expect(d.createResult).toHaveBeenCalled();
    expect(d.addResultToProject).toHaveBeenCalledWith("project-1", "result-a");
    expect(d.publishStagedMedia).toHaveBeenCalledWith(STAGED_RESULT);
  });

  it("deletes result row and cleans up staged files when addResultToProject fails", async () => {
    const d = deps("appData");
    d.addResultToProject = vi.fn().mockRejectedValue(new Error("FK constraint"));

    await expect(importProjectResultImage({
      resultId: "result-a",
      projectId: "project-1",
      promptId: "prompt-a",
      dataUrl: PNG_DATA_URL,
      result: { provider: "midjourney" },
    }, d)).rejects.toThrow("FK constraint");

    expect(d.deleteResult).toHaveBeenCalledWith("result-a");
    expect(d.cleanupStagedMedia).toHaveBeenCalledWith(STAGED_RESULT);
    expect(d.publishStagedMedia).not.toHaveBeenCalled();
  });

  it("compensates with row delete and link removal when project result publish fails", async () => {
    const d = deps("appData");
    d.publishStagedMedia = vi.fn().mockRejectedValue(new Error("rename failed"));

    await expect(importProjectResultImage({
      resultId: "result-a",
      projectId: "project-1",
      promptId: "prompt-a",
      dataUrl: PNG_DATA_URL,
      result: { provider: "midjourney" },
    }, d)).rejects.toThrow("rename failed");

    expect(d.removeResultFromProject).toHaveBeenCalledWith("project-1", "result-a");
    expect(d.deleteResult).toHaveBeenCalledWith("result-a");
    expect(d.removeManagedPaths).toHaveBeenCalledWith([
      STAGED_RESULT.originalTemp, STAGED_RESULT.thumbnailTemp,
      STAGED_RESULT.originalFinal, STAGED_RESULT.thumbnailFinal,
    ]);
  });
});
