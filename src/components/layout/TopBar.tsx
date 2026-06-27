import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { StatusDot } from "@/components/ui/StatusDot";
import { AppMenu } from "./AppMenu";

function LiveClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    function update() {
      const now = new Date();
      const h = now.getHours().toString().padStart(2, "0");
      const m = now.getMinutes().toString().padStart(2, "0");
      setTime(`${h}:${m}`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-ndot text-[14px] text-muted tracking-widest tabular-nums">
      {time}
    </span>
  );
}

export function TopBar({ onSearchOpen }: { onSearchOpen?: () => void }) {
  return (
    <header
      className="h-12 flex items-center justify-between px-5 shrink-0"
      style={{ borderBottom: "var(--border-default)" }}
    >
      {/* Left: Product name */}
      <div className="flex items-center gap-3">
        <span className="font-ndot57 text-[18px] text-white tracking-widest">
          FRAMECRAFT
        </span>
        <span className="system-label text-[10px] px-2 py-1 border border-white/18 rounded-[4px]">
          V1
        </span>
      </div>

      {/* Center: Search trigger */}
      <button
        type="button"
        onClick={onSearchOpen}
        className="flex items-center gap-2 h-8 px-3 rounded-sm text-muted hover:text-white transition-precise"
        style={{ border: "var(--border-dim)" }}
      >
        <Search size={11} />
        <span className="font-mono text-[10px] text-dim/60">Search…</span>
        <kbd className="font-mono text-[9px] text-dim/40 px-1.5 py-0.5 rounded ml-2"
          style={{ border: "var(--border-dim)" }}>
          ⌘K
        </kbd>
      </button>

      {/* Right: Status + Clock */}
      <div className="flex items-center gap-4">
        <AppMenu />
        <div className="w-px h-3 bg-white/10" />
        <div className="flex items-center gap-2">
          <StatusDot active />
          <span className="system-label text-[10px] text-readable">SYSTEM READY</span>
        </div>
        <div className="w-px h-3 bg-white/10" />
        <LiveClock />
      </div>
    </header>
  );
}
