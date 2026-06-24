import { describe, expect, it, vi } from "vitest";
import type { QueueItem } from "./queue";
import {
  findQueueItemForFile,
  importQueueResult,
  matchQueueFiles,
  normalizeImportName,
} from "./queueImport";

const queueItem = (overrides: Partial<QueueItem> = {}): QueueItem => ({
  id: "queue-1",
  prompt_id: "promptabc123",
  project_id: undefined,
  status: "pending",
  sort_order: 0,
  provider: "midjourney",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  prompt_title: "Chrome Breakfast Chair",
  prompt_text: "A chrome chair in a breakfast scene",
  ...overrides,
});

describe("queue result import", () => {
  it("normalizes filenames and prompt titles for matching", () => {
    expect(normalizeImportName("Chrome_Breakfast-Chair 01.PNG")).toBe("chrome breakfast chair 01");
  });

  it("matches files by prompt id or normalized prompt title", () => {
    const items = [
      queueItem(),
      queueItem({ id: "queue-2", prompt_id: "promptxyz987", prompt_title: "Copper Studio Vase" }),
    ];

    expect(findQueueItemForFile("result_promptabc123.png", items)?.id).toBe("queue-1");
    expect(findQueueItemForFile("copper-studio-vase-final.webp", items)?.id).toBe("queue-2");
  });

  it("does not match completed or skipped queue items", () => {
    const items = [queueItem({ status: "done" }), queueItem({ id: "queue-2", status: "skipped" })];

    expect(findQueueItemForFile("chrome-breakfast-chair.png", items)).toBeUndefined();
  });

  it("pairs import files with queue items and reports unmatched files", () => {
    const items = [queueItem(), queueItem({ id: "queue-2", prompt_id: "p2", prompt_title: "Copper Studio Vase" })];
    const matches = matchQueueFiles(items, [
      { name: "chrome-breakfast-chair.png" },
      { name: "unknown.png" },
      { name: "copper-studio-vase.jpg" },
    ]);

    expect(matches.matched.map((match) => match.item.id)).toEqual(["queue-1", "queue-2"]);
    expect(matches.unmatched.map((file) => file.name)).toEqual(["unknown.png"]);
  });

  it("saves the image, creates a result, links the project, then marks the queue item done", async () => {
    const calls: string[] = [];
    const deps = {
      generateId: () => "result-1",
      saveResultImage: vi.fn(async () => {
        calls.push("save");
        return { filePath: "/results/result-1.png", thumbPath: "/results/result-1_thumb.jpg" };
      }),
      createResult: vi.fn(async () => {
        calls.push("create");
        return "result-1";
      }),
      addResultToProject: vi.fn(async () => {
        calls.push("link");
      }),
      updateQueueStatus: vi.fn(async (_id: string, status: QueueItem["status"]) => {
        calls.push(`status:${status}`);
      }),
    };

    const resultId = await importQueueResult(
      queueItem({ project_id: "project-1" }),
      "data:image/png;base64,abc",
      deps
    );

    expect(resultId).toBe("result-1");
    expect(deps.createResult).toHaveBeenCalledWith({
      id: "result-1",
      prompt_id: "promptabc123",
      file_path: "/results/result-1.png",
      thumbnail_path: "/results/result-1_thumb.jpg",
      provider: "midjourney",
      notes: "Imported from generation queue",
    });
    expect(deps.addResultToProject).toHaveBeenCalledWith("project-1", "result-1");
    expect(calls).toEqual(["save", "create", "link", "status:done"]);
  });

  it("marks the queue item failed when an import write fails", async () => {
    const deps = {
      generateId: () => "result-1",
      saveResultImage: vi.fn(async () => {
        throw new Error("disk full");
      }),
      createResult: vi.fn(),
      addResultToProject: vi.fn(),
      updateQueueStatus: vi.fn(),
    };

    await expect(importQueueResult(queueItem(), "data:image/png;base64,abc", deps)).rejects.toThrow("disk full");
    expect(deps.createResult).not.toHaveBeenCalled();
    expect(deps.updateQueueStatus).toHaveBeenCalledWith("queue-1", "failed");
  });
});
