import { describe, expect, it } from "vitest";
import {
  getRegisteredShortcuts,
  registerShortcutLabel,
} from "./shortcuts";

describe("shortcut registration", () => {
  it("rejects unmodified printable shortcuts", () => {
    const key = `bare-${Date.now()}`;

    registerShortcutLabel(key, "Unsafe shortcut");

    expect(getRegisteredShortcuts()).not.toContainEqual({
      keys: key,
      description: "Unsafe shortcut",
    });
  });
});
