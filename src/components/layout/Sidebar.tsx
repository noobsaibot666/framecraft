import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Settings } from "lucide-react";
import { getQueue } from "@/lib/queue";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    label: "WORK",
    items: [
      { num: "01", label: "DASHBOARD", to: "/" },
      { num: "02", label: "PROJECTS", to: "/projects" },
      { num: "03", label: "QUEUE", to: "/queue" },
    ],
  },
  {
    label: "CREATE",
    items: [
      { num: "04", label: "CRAFT", to: "/craft" },
      { num: "05", label: "LIBRARY", to: "/library" },
      { num: "06", label: "RECIPES", to: "/recipes" },
      { num: "07", label: "IMPORT", to: "/import" },
    ],
  },
  {
    label: "ANALYZE",
    items: [
      { num: "08", label: "IMAGE", to: "/analyze" },
      { num: "09", label: "BRIEF", to: "/brief" },
      { num: "10", label: "FRAMES", to: "/frames" },
      { num: "11", label: "COMPARE", to: "/compare" },
    ],
  },
  {
    label: "ASSETS",
    items: [
      { num: "12", label: "REFERENCES", to: "/references" },
      { num: "13", label: "SREFS", to: "/srefs" },
    ],
  },
] as const;

function NavItem({
  num,
  label,
  to,
  badge,
}: {
  num: string;
  label: string;
  to: string;
  badge?: number;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "relative flex items-center gap-3 px-4 py-2.5",
          "group transition-all duration-150",
          isActive
            ? "text-white bg-red/8"
            : "text-readable hover:text-red"
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Active left border */}
          <span
            className={cn(
              "absolute left-0 top-1/2 -translate-y-1/2",
              "w-px h-4 transition-all duration-150",
              isActive ? "bg-red h-7" : "bg-transparent"
            )}
          />
          {/* Number */}
          <span
            className={cn(
              "font-mono text-[10px] tabular-nums shrink-0 transition-colors",
              isActive ? "text-red" : "text-dim group-hover:text-red/80"
            )}
          >
            {num}
          </span>
          {/* Label */}
          <span className="font-sans text-[12px] font-medium tracking-[0.04em] uppercase">
            {label}
          </span>
          {badge != null && badge > 0 && (
            <span className="ml-auto font-mono text-[9px] text-white/70 px-1.5 py-0.5 rounded-sm border border-white/15">
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    getQueue()
      .then((items) => setPendingCount(items.filter((item) => item.status === "pending").length))
      .catch(() => setPendingCount(0));
  }, []);

  return (
    <aside
      className="w-50 flex flex-col shrink-0"
      style={{ borderRight: "var(--border-default)" }}
    >
      {/* Navigation */}
      <nav className="flex-1 pt-3 pb-2 flex flex-col gap-2 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <span className="px-4 pt-2 pb-1 font-mono text-[9px] tracking-widest uppercase text-muted/75">
              {group.label}
            </span>
            {group.items.map((item) => (
              <NavItem key={item.to} {...item} badge={item.to === "/queue" ? pendingCount : undefined} />
            ))}
          </div>
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-4 h-px bg-white/7" />

      {/* Settings */}
      <div className="py-2">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              "relative flex items-center gap-3 px-4 py-2.5",
              "transition-all duration-150",
              isActive ? "text-white" : "text-readable hover:text-red"
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  "absolute left-0 top-1/2 -translate-y-1/2",
                  "w-px h-4 transition-all duration-150",
                  isActive ? "bg-red" : "bg-transparent"
                )}
              />
              <Settings size={12} className="shrink-0" />
              <span className="font-sans text-[12px] font-medium tracking-[0.04em] uppercase">
                Settings
              </span>
            </>
          )}
        </NavLink>
      </div>

      {/* Bottom identifier */}
      <div className="px-4 pb-3 pt-1">
        <span className="system-label text-[8.5px] text-muted/70">
          FRAMECRAFT / LOCAL
        </span>
      </div>
    </aside>
  );
}
