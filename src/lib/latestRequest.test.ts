import { describe, expect, it } from "vitest";
import { createLatestRequestGuard } from "./latestRequest";

describe("createLatestRequestGuard", () => {
  it("invalidates older request tokens when a newer request begins", () => {
    const guard = createLatestRequestGuard();
    const first = guard.begin();
    const second = guard.begin();
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
  });

  it("invalidates the active token for dependency changes and unmount", () => {
    const guard = createLatestRequestGuard();
    const token = guard.begin();
    guard.invalidate();
    expect(guard.isCurrent(token)).toBe(false);
  });
});
