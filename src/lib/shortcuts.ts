import { useEffect } from "react";

export interface ShortcutDef {
  keys: string; // e.g. "cmd+k", "cmd+shift+n", "escape"
  description: string;
  handler: (e: KeyboardEvent) => void;
}

const SAFE_UNMODIFIED_KEYS = new Set(["escape"]);

/**
 * "cmd" (and its "mod" alias) means "this platform's primary modifier" —
 * Cmd on macOS, Ctrl on Windows/Linux — not the literal Meta/Windows key.
 * Every shortcut in this app used to hardcode "cmd" -> Meta, so on Windows
 * nothing ever fired: users press Ctrl, never the Windows key, for app
 * shortcuts. Accepts an explicit platform hint for tests; in the real app
 * it reads the live environment (falling back to "mac" only when no
 * navigator exists at all, e.g. SSR/non-browser contexts).
 */
export function isMacPlatform(platformHint?: string): boolean {
  if (platformHint !== undefined) return /mac/i.test(platformHint);
  if (typeof navigator === "undefined") return true;
  const uaDataPlatform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform;
  const source = uaDataPlatform || navigator.platform || navigator.userAgent || "";
  return /mac/i.test(source);
}

const IS_MAC = isMacPlatform();

interface ParsedShortcut {
  meta: boolean;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

export function parseKeys(keys: string, isMac: boolean = IS_MAC): ParsedShortcut {
  const parts = keys.toLowerCase().split("+");
  const isPrimaryModifier = parts.includes("cmd") || parts.includes("mod");
  return {
    meta: parts.includes("meta") || (isPrimaryModifier && isMac),
    ctrl: parts.includes("ctrl") || (isPrimaryModifier && !isMac),
    shift: parts.includes("shift"),
    alt: parts.includes("alt"),
    key: parts[parts.length - 1],
  };
}

function isAllowedShortcut(keys: string): boolean {
  const parsed = parseKeys(keys);
  return parsed.meta || parsed.ctrl || parsed.shift || SAFE_UNMODIFIED_KEYS.has(parsed.key);
}

function matches(e: KeyboardEvent, keys: string): boolean {
  const p = parseKeys(keys);
  const eKey = e.key.toLowerCase();
  return (
    e.metaKey === p.meta &&
    e.ctrlKey === p.ctrl &&
    e.shiftKey === p.shift &&
    e.altKey === p.alt &&
    eKey === p.key
  );
}

export function useShortcut(keys: string, handler: (e: KeyboardEvent) => void, enabled = true) {
  useEffect(() => {
    if (!enabled || !isAllowedShortcut(keys)) return;
    const listener = (e: KeyboardEvent) => {
      if (matches(e, keys)) {
        e.preventDefault();
        handler(e);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [keys, handler, enabled]);
}

// Registry for the settings display — purely declarative, no handlers stored
const _registry: Map<string, string> = new Map();

export function registerShortcutLabel(keys: string, description: string) {
  if (!isAllowedShortcut(keys)) return;
  _registry.set(keys, description);
}

export function getRegisteredShortcuts(): { keys: string; description: string }[] {
  return [..._registry.entries()].map(([keys, description]) => ({ keys, description }));
}

// Format keys for display: mac renders concatenated glyphs ("cmd+shift+p" ->
// "⌘⇧P"), Windows/Linux render textual "+"-joined labels ("Ctrl+Shift+P").
export function formatShortcutKeys(keys: string, isMac: boolean = IS_MAC): string {
  const parts = keys.split("+").map((part) => {
    switch (part.toLowerCase()) {
      case "cmd":
      case "mod":
        return isMac ? "⌘" : "Ctrl";
      case "meta":
        return isMac ? "⌘" : "Win";
      case "ctrl":
        return isMac ? "⌃" : "Ctrl";
      case "shift":
        return isMac ? "⇧" : "Shift";
      case "alt":
        return isMac ? "⌥" : "Alt";
      case "escape":
        return "Esc";
      case "enter":
        return "↵";
      case "backspace":
        return "⌫";
      default:
        return part.toUpperCase();
    }
  });
  return isMac ? parts.join("") : parts.join("+");
}
