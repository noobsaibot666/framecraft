import { beforeEach, describe, expect, it } from "vitest";
import {
  addToQueue,
  clearDone,
  getQueue,
  getQueueItem,
  removeFromQueue,
  reorderQueue,
  resetQueueForTests,
  updateQueueStatus,
} from "./queue";

describe("generation queue", () => {
  beforeEach(() => {
    resetQueueForTests();
  });

  it("adds prompts idempotently and returns queue sorted by order", async () => {
    const first = await addToQueue("prompt-a");
    const duplicate = await addToQueue("prompt-a");
    const second = await addToQueue("prompt-b");

    expect(duplicate).toBe(first);
    expect(second).not.toBe(first);
    expect((await getQueue()).map((item) => item.prompt_id)).toEqual(["prompt-a", "prompt-b"]);
  });

  it("filters queue items by project id", async () => {
    await addToQueue("prompt-a", "project-1");
    await addToQueue("prompt-b", "project-2");

    expect((await getQueue("project-1")).map((item) => item.prompt_id)).toEqual(["prompt-a"]);
  });

  it("keeps the first project assignment when a duplicate prompt is added", async () => {
    const id = await addToQueue("prompt-a", "project-1");

    expect(await addToQueue("prompt-a", "project-2")).toBe(id);
    expect(await getQueueItem(id)).toMatchObject({ project_id: "project-1" });
  });

  it("reads one item and updates status", async () => {
    const id = await addToQueue("prompt-a");
    await updateQueueStatus(id, "sent");

    expect(await getQueueItem(id)).toMatchObject({
      id,
      prompt_id: "prompt-a",
      status: "sent",
    });
  });

  it("returns null for a missing queue item", async () => {
    expect(await getQueueItem("missing")).toBeNull();
  });

  it("allows failed status without clearing the item", async () => {
    const id = await addToQueue("prompt-a");

    await updateQueueStatus(id, "failed");

    expect(await getQueueItem(id)).toMatchObject({ status: "failed" });
  });

  it("removes one item and clears done plus skipped", async () => {
    const pending = await addToQueue("prompt-a");
    const done = await addToQueue("prompt-b");
    const skipped = await addToQueue("prompt-c");
    const removed = await addToQueue("prompt-d");

    await updateQueueStatus(done, "done");
    await updateQueueStatus(skipped, "skipped");
    await removeFromQueue(removed);
    await clearDone();

    expect((await getQueue()).map((item) => item.id)).toEqual([pending]);
  });

  it("clearDone keeps pending and sent items but removes failed", async () => {
    const pending = await addToQueue("prompt-a");
    const sent = await addToQueue("prompt-b");
    const failed = await addToQueue("prompt-c");
    await updateQueueStatus(sent, "sent");
    await updateQueueStatus(failed, "failed");

    await clearDone();

    expect((await getQueue()).map((item) => item.id)).toEqual([pending, sent]);
  });

  it("ignores remove requests for missing items", async () => {
    const id = await addToQueue("prompt-a");

    await removeFromQueue("missing");

    expect((await getQueue()).map((item) => item.id)).toEqual([id]);
  });

  it("reorders queue items by id list", async () => {
    const first = await addToQueue("prompt-a");
    const second = await addToQueue("prompt-b");
    const third = await addToQueue("prompt-c");

    await reorderQueue([third, first, second]);

    expect((await getQueue()).map((item) => item.id)).toEqual([third, first, second]);
  });

  it("resetQueueForTests clears all queued items", async () => {
    await addToQueue("prompt-a");

    resetQueueForTests();

    expect(await getQueue()).toEqual([]);
  });
});
