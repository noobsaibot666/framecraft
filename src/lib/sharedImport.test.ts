import { describe, expect, it, vi } from "vitest";
import { resolveLibraryPaths } from "./libraryConfig";
import {
  importReferenceImage,
  importProjectResultImage,
  importResultImage,
  type SharedImportDeps,
} from "./sharedImport";

const PNG_DATA_URL = "data:image/png;base64,AQID";

function deps(mode: "portable" | "appData", valid = true): SharedImportDeps {
  return {
    getLibraryState: vi.fn(async () => ({
      selection: { mode, path: mode === "portable" ? "/lib/Work.framecraftlib" : null },
      paths: resolveLibraryPaths("/lib/Work.framecraftlib"),
      validation: mode === "portable" ? { ok: valid, errors: valid ? [] : ["Missing inbox directory"] } : null,
      nativeAvailable: true,
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
    saveReferenceImage: vi.fn(async () => ({ filePath: "/refs/ref-a.png", thumbPath: "/refs/ref-a_thumb.jpg" })),
    createReference: vi.fn(async () => "ref-a"),
    saveResultImage: vi.fn(async () => ({ filePath: "/results/result-a.png", thumbPath: "/results/result-a_thumb.jpg" })),
    createResult: vi.fn(async () => "result-a"),
    addResultToProject: vi.fn(async () => undefined),
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

  it("directly saves reference image imports for local app-data libraries", async () => {
    const d = deps("appData");

    const result = await importReferenceImage({
      referenceId: "ref-a",
      dataUrl: PNG_DATA_URL,
      reference: { title: "Mood", kind: "image" },
      originalName: "mood.png",
    }, d);

    expect(result).toEqual({ id: "ref-a", queued: false });
    expect(d.saveReferenceImage).toHaveBeenCalledWith("ref-a", PNG_DATA_URL);
    expect(d.createReference).toHaveBeenCalledWith({
      id: "ref-a",
      title: "Mood",
      kind: "image",
      file_data: "/refs/ref-a.png",
      thumbnail_data: "/refs/ref-a_thumb.jpg",
    });
    expect(d.publishSharedIngestJob).not.toHaveBeenCalled();
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

  it("directly saves and links project result imports for local app-data libraries", async () => {
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
    expect(d.createResult).toHaveBeenCalled();
    expect(d.addResultToProject).toHaveBeenCalledWith("project-1", "result-a");
  });
});
