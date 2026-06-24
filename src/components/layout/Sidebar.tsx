import { NavLink } from "react-router-dom";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { num: "01", label: "DASHBOARD",  to: "/" },
  { num: "02", label: "LIBRARY",    to: "/library" },
  { num: "03", label: "CRAFT",      to: "/craft" },
  { num: "04", label: "RECIPES",    to: "/recipes" },
  { num: "05", label: "IMPORT",     to: "/import" },
  { num: "06", label: "SREFS",      to: "/srefs" },
  { num: "07", label: "ANALYZE",    to: "/analyze" },
  { num: "08", label: "BRIEF",      to: "/brief" },
  { num: "09", label: "FRAMES",     to: "/frames" },
  { num: "10", label: "REFS",       to: "/references" },
  { num: "11", label: "PROJECTS",   to: "/projects" },
] as const;

function NavItem({
  num,
  label,
  to,
}: {
  num: string;
  label: string;
  to: string;
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
            ? "text-white"
            : "text-dim hover:text-muted"
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
              isActive ? "bg-red" : "bg-transparent"
            )}
          />
          {/* Number */}
          <span
            className={cn(
              "font-mono text-[10px] tabular-nums shrink-0 transition-colors",
              isActive ? "text-dim" : "text-dim/60"
            )}
          >
            {num}
          </span>
          {/* Label */}
          <span className="font-sans text-[12px] font-medium tracking-[0.04em] uppercase">
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  return (
    <aside
      className="w-50 flex flex-col shrink-0"
      style={{ borderRight: "var(--border-default)" }}
    >
      {/* Navigation */}
      <nav className="flex-1 pt-3 pb-2 flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} />
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
              isActive ? "text-white" : "text-dim hover:text-muted"
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
        <span className="system-label text-[8px] text-dim/50">
          FRAMECRAFT / LOCAL
        </span>
      </div>
    </aside>
  );
}
