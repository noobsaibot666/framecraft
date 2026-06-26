import { useEffect, useState } from "react";
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

export function TopBar() {
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
        <span className="system-label text-[9px] px-1.5 py-0.5 border border-white/10 rounded-[4px]">
          V1
        </span>
      </div>

      {/* Right: Status + Clock */}
      <div className="flex items-center gap-4">
        <AppMenu />
        <div className="w-px h-3 bg-white/10" />
        <div className="flex items-center gap-2">
          <StatusDot active />
          <span className="system-label text-[9px]">SYSTEM READY</span>
        </div>
        <div className="w-px h-3 bg-white/10" />
        <LiveClock />
      </div>
    </header>
  );
}
