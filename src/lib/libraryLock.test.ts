import { describe, expect, it, vi } from "vitest";
import {
  acquireLibraryLock,
  evaluateLibraryLock,
  releaseLibraryLock,
  type LibraryLockFileSystem,
  type LibraryLockInfo,
} from "./libraryLock";

function lock(updatedAt: string, sessionId = "other"): LibraryLockInfo {
  return {
    session_id: sessionId,
    machine: "workstation",
    user: "alan",
    updated_at: updatedAt,
    app_version: "0.1.0",
  };
}

function createFs(existing?: LibraryLockInfo): LibraryLockFileSystem & {
  text: Record<string, string>;
  removed: string[];
} {
  const text: Record<string, string> = {};
  if (existing) text["/lib/locks/active.lock"] = JSON.stringify(existing);
  return {
    text,
    removed: [],
    exists: vi.fn(async (path: string) => path in text),
    readTextFile: vi.fn(async (path: string) => text[path] ?? ""),
    writeTextFile: vi.fn(async (path: string, contents: string) => {
      text[path] = contents;
    }),
    remove: vi.fn(async (path: string) => {
      delete text[path];
    }),
  };
}

describe("libraryLock", () => {
  it("evaluates missing and owned locks as writable", () => {
    expect(evaluateLibraryLock(null, "session-a", Date.parse("2026-06-25T10:00:00.000Z"))).toEqual({
      status: "available",
    });
    expect(
      evaluateLibraryLock(lock("2026-06-25T09:59:00.000Z", "session-a"), "session-a", Date.parse("2026-06-25T10:00:00.000Z"))
    ).toEqual({ status: "owned", lock: lock("2026-06-25T09:59:00.000Z", "session-a") });
  });

  it("detects a fresh lock from another session", () => {
    const existing = lock("2026-06-25T09:59:00.000Z");

    expect(evaluateLibraryLock(existing, "session-a", Date.parse("2026-06-25T10:00:00.000Z"))).toEqual({
      status: "conflict",
      lock: existing,
    });
  });

  it("allows the same user and machine to recover a fresh lock after restart", () => {
    const existing = lock("2026-06-25T09:59:00.000Z", "previous-session");
    const current = {
      ...lock("2026-06-25T10:00:00.000Z", "session-a"),
      machine: existing.machine,
      user: existing.user,
    };

    expect(evaluateLibraryLock(existing, current.session_id, Date.parse("2026-06-25T10:00:00.000Z"), current)).toEqual({
      status: "owned",
      lock: existing,
    });
  });

  it("detects stale locks", () => {
    const existing = lock("2026-06-25T09:40:00.000Z");

    expect(evaluateLibraryLock(existing, "session-a", Date.parse("2026-06-25T10:00:00.000Z"))).toEqual({
      status: "stale",
      lock: existing,
    });
  });

  it("requires explicit takeover for a stale lock", async () => {
    const fs = createFs({
      ...lock("2026-06-25T09:40:00.000Z"),
      machine: "other-workstation",
    });
    const current = lock("2026-06-25T10:00:00.000Z", "session-a");

    await expect(
      acquireLibraryLock("/lib", fs, current, Date.parse("2026-06-25T10:00:00.000Z"))
    ).rejects.toThrow("Stale library lock");

    await acquireLibraryLock("/lib", fs, current, Date.parse("2026-06-25T10:00:00.000Z"), true);

    expect(JSON.parse(fs.text["/lib/locks/active.lock"])).toEqual(current);
  });

  it("does not remove another session lock", async () => {
    const fs = createFs(lock("2026-06-25T10:00:00.000Z", "other"));

    await releaseLibraryLock("/lib", fs, "session-a");

    expect(fs.text["/lib/locks/active.lock"]).toBeTruthy();
  });
});
