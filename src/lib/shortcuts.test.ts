import { describe, expect, it } from "vitest";
import {
  formatShortcutKeys,
  getRegisteredShortcuts,
  isMacPlatform,
  parseKeys,
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

describe("isMacPlatform", () => {
  it("detects mac and non-mac platform strings", () => {
    expect(isMacPlatform("MacIntel")).toBe(true);
    expect(isMacPlatform("Win32")).toBe(false);
    expect(isMacPlatform("Linux x86_64")).toBe(false);
  });
});

describe("parseKeys", () => {
  it("resolves 'cmd' to the Meta key on mac", () => {
    expect(parseKeys("cmd+shift+p", true)).toMatchObject({ meta: true, ctrl: false, shift: true, key: "p" });
  });

  it("resolves 'cmd' to the Ctrl key on Windows/Linux — not the Meta/Windows key", () => {
    expect(parseKeys("cmd+shift+p", false)).toMatchObject({ meta: false, ctrl: true, shift: true, key: "p" });
  });

  it("'mod' is an alias for 'cmd'", () => {
    expect(parseKeys("mod+d", true)).toMatchObject({ meta: true, ctrl: false });
    expect(parseKeys("mod+d", false)).toMatchObject({ meta: false, ctrl: true });
  });

  it("literal 'ctrl'/'meta' still mean the physical key regardless of platform", () => {
    expect(parseKeys("ctrl+r", true)).toMatchObject({ meta: false, ctrl: true });
    expect(parseKeys("meta+r", false)).toMatchObject({ meta: true, ctrl: false });
  });
});

describe("formatShortcutKeys", () => {
  it("renders concatenated glyphs on mac", () => {
    expect(formatShortcutKeys("cmd+shift+p", true)).toBe("⌘⇧P");
  });

  it("renders textual '+'-joined labels on Windows/Linux", () => {
    expect(formatShortcutKeys("cmd+shift+p", false)).toBe("Ctrl+Shift+P");
  });
});
