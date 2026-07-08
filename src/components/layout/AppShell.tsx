import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { PageTransition } from "./PageTransition";
import { CommandSearch } from "@/components/ui/CommandSearch";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useShortcut, registerShortcutLabel, getRegisteredShortcuts, formatShortcutKeys } from "@/lib/shortcuts";
import { getFramecraftDb } from "@/lib/dbConnection";
import { scheduleLikelyRoutePrefetch } from "@/lib/routePrefetch";

registerShortcutLabel("cmd+k", "Open command search");
registerShortcutLabel("cmd+/", "Show keyboard shortcuts");
// cmd+shift+<letter>, not cmd+ctrl+<letter>: the old combo required holding
// Ctrl *and* the Windows key together on Windows, which Win+Ctrl+D/Left/Right
// etc. reserve system-wide for virtual-desktop switching — those keydowns
// never reached the browser at all. cmd+shift avoids that, and avoids
// colliding with bare Ctrl+P/F/N (print/find/new) browser accelerators.
registerShortcutLabel("cmd+shift+d", "Go to Dashboard");
registerShortcutLabel("cmd+shift+p", "Go to Prompt Craft");
registerShortcutLabel("cmd+shift+l", "Go to Library");
registerShortcutLabel("cmd+shift+i", "Go to Import");
registerShortcutLabel("cmd+shift+t", "Go to Tokens");
registerShortcutLabel("cmd+shift+c", "Go to Campaigns");
registerShortcutLabel("cmd+shift+n", "New Prompt");
// Plain cmd+, (no Shift) — Shift+comma types "<", not ",", so
// "cmd+shift+," could never match a real keypress. cmd+, is also the
// universal cross-app "Preferences" convention and isn't a reserved
// browser/OS accelerator, so it doesn't need the extra Shift anyway.
registerShortcutLabel("cmd+,", "Go to Settings");

export function AppShell() {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Warm the DB connection at startup so the first data page loads instantly.
  useEffect(() => {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      getFramecraftDb().catch(() => {});
    }
  }, []);

  useEffect(() => scheduleLikelyRoutePrefetch(), []);

  const openSearch = useCallback(() => setSearchOpen((open) => !open), []);
  useShortcut("cmd+k", openSearch);
  useShortcut("cmd+/", () => setShortcutsOpen((v) => !v));

  // Global page-navigation shortcuts (available everywhere, AppShell wraps every route).
  useShortcut("cmd+shift+d", () => navigate("/"));
  useShortcut("cmd+shift+p", () => navigate("/craft"));
  useShortcut("cmd+shift+l", () => navigate("/library"));
  useShortcut("cmd+shift+i", () => navigate("/import"));
  useShortcut("cmd+shift+t", () => navigate("/tokens"));
  useShortcut("cmd+shift+c", () => navigate("/campaigns"));
  useShortcut("cmd+shift+n", () => navigate("/craft"));
  useShortcut("cmd+,", () => navigate("/settings"));

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black">
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
        style={{ border: "var(--border-default)", background: "var(--color-panel)" }}
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
              <span className="font-mono text-[12px] text-readable">{s.description}</span>
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
