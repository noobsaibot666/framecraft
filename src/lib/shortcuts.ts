import { useEffect } from "react";

export interface ShortcutDef {
  keys: string; // e.g. "cmd+k", "cmd+shift+n", "escape"
  description: string;
  handler: (e: KeyboardEvent) => void;
}

const SAFE_UNMODIFIED_KEYS = new Set(["escape"]);

function isAllowedShortcut(keys: string): boolean {
  const parsed = parseKeys(keys);
  return parsed.meta || parsed.ctrl || parsed.shift || SAFE_UNMODIFIED_KEYS.has(parsed.key);
}

function parseKeys(keys: string): { meta: boolean; ctrl: boolean; shift: boolean; alt: boolean; key: string } {
  const parts = keys.toLowerCase().split("+");
  return {
    meta: parts.includes("cmd") || parts.includes("meta"),
    ctrl: parts.includes("ctrl"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt"),
    key: parts[parts.length - 1],
  };
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

// Format keys for display: "cmd+k" → "⌘K", "cmd+shift+n" → "⌘⇧N"
export function formatShortcutKeys(keys: string): string {
  return keys
    .split("+")
    .map((part) => {
      switch (part.toLowerCase()) {
        case "cmd":
        case "meta":
          return "⌘";
        case "ctrl":
          return "⌃";
        case "shift":
          return "⇧";
        case "alt":
          return "⌥";
        case "escape":
          return "Esc";
        case "enter":
          return "↵";
        case "backspace":
          return "⌫";
        default:
          return part.toUpperCase();
      }
    })
    .join("");
}
