import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { PageTransition } from "./PageTransition";
import { CommandSearch } from "@/components/ui/CommandSearch";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useShortcut, registerShortcutLabel, getRegisteredShortcuts, formatShortcutKeys } from "@/lib/shortcuts";

registerShortcutLabel("cmd+k", "Open command search");
registerShortcutLabel("cmd+?", "Show keyboard shortcuts");

export function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Warm the DB connection at startup so the first data page loads instantly.
  useEffect(() => {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      import("@/lib/dbConnection").then(({ getFramecraftDb }) => {
        getFramecraftDb().catch(() => {});
      });
    }
  }, []);

  const openSearch = useCallback(() => setSearchOpen((open) => !open), []);
  useShortcut("cmd+k", openSearch);
  useShortcut("cmd+/", () => setShortcutsOpen((v) => !v));

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-black">
      <TopBar onSearchOpen={() => setSearchOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
          <PageTransition />
        </main>
      </div>
      {searchOpen && <CommandSearch onClose={() => setSearchOpen(false)} />}
      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
      <ToastContainer />
    </div>
  );
}

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcuts = getRegisteredShortcuts();
  useShortcut("escape", onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="flex flex-col gap-5 w-full max-w-md rounded-card p-6"
        style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="system-label text-soft-white">KEYBOARD SHORTCUTS</span>
          <button type="button" onClick={onClose} className="text-dim/40 hover:text-white transition-precise">
            <X size={14} />
          </button>
        </div>
        <div className="flex flex-col gap-1.5 max-h-96 overflow-y-auto">
          {shortcuts.map((s) => (
            <div key={s.keys} className="flex items-center justify-between gap-4 px-3 py-2.5 rounded-sm"
              style={{ border: "var(--border-dim)" }}>
              <span className="font-mono text-[11px] text-readable">{s.description}</span>
              <kbd className="font-mono text-[10px] text-amber px-2 py-1 rounded-sm shrink-0"
                style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
                {formatShortcutKeys(s.keys)}
              </kbd>
            </div>
          ))}
        </div>
        <span className="font-mono text-[9px] text-dim/40">Press Esc or ⌘/ to close</span>
      </div>
    </div>
  );
}
