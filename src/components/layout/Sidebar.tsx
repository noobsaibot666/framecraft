import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Archive,
  BookOpen,
  Briefcase,
  FileText,
  Film,
  GitCompare,
  Image,
  Layers,
  ListChecks,
  Settings,
  Tag,
  Upload,
  Wand2,
} from "lucide-react";
import { getQueue } from "@/lib/queue";
import { cn } from "@/lib/utils";
import { prefetchRoute } from "@/lib/routePrefetch";

const NAV_GROUPS = [
  {
    label: "START",
    items: [
      { label: "Dashboard", to: "/", icon: Layers },
    ],
  },
  {
    label: "PROJECTS",
    items: [
      { label: "Campaigns", to: "/campaigns", icon: Briefcase },
      { label: "Projects", to: "/projects", icon: Archive },
      { label: "Queue", to: "/queue", icon: ListChecks },
    ],
  },
  {
    label: "CREATE",
    items: [
      { label: "Prompt", to: "/craft", icon: Wand2 },
      { label: "Recipes", to: "/recipes", icon: BookOpen },
      { label: "Import", to: "/import", icon: Upload },
    ],
  },
  {
    label: "LIBRARY",
    items: [
      { label: "Library", to: "/library", icon: Archive },
      { label: "Tokens", to: "/tokens", icon: Tag },
      { label: "Results", to: "/results", icon: Film },
      { label: "References", to: "/references", icon: Image },
      { label: "SREFs", to: "/srefs", icon: BookOpen },
    ],
  },
  {
    label: "INTELLIGENCE",
    items: [
      { label: "Image", to: "/analyze", icon: Image },
      { label: "Brief", to: "/brief", icon: FileText },
      { label: "Frames", to: "/frames", icon: Layers },
      { label: "Compare", to: "/compare", icon: GitCompare },
    ],
  },
] as const;

function NavItem({
  label,
  to,
  icon: Icon,
  badge,
}: {
  label: string;
  to: string;
  icon: typeof Settings;
  badge?: number;
}) {
  return (
    <NavLink
      to={to}
      onMouseEnter={() => prefetchRoute(to)}
      onFocus={() => prefetchRoute(to)}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "relative flex min-h-10 items-center gap-3 px-4 py-2.5",
          "group transition-all duration-150",
          isActive
            ? "bg-red/10 text-white"
            : "text-soft-white/75 hover:bg-cyan/6 hover:text-cyan"
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
          <Icon
            size={14}
            className={cn(
              "shrink-0 transition-colors",
              isActive ? "text-red" : "text-soft-white/55 group-hover:text-cyan"
            )}
          />
          <span className="font-sans text-[14px] font-semibold tracking-[0.04em] uppercase">
            {label}
          </span>
          {badge != null && badge > 0 && (
            <span className="ml-auto rounded-sm border border-red/40 bg-red/14 px-2 py-1 font-mono text-[10px] text-white">
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
      className="w-52 flex flex-col shrink-0"
      style={{ borderRight: "var(--border-default)" }}
    >
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto pb-3 pt-4 flex flex-col gap-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <span className="px-4 pb-1 pt-2 font-mono text-[10.5px] tracking-widest text-soft-white/60 uppercase">
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

      {/* Bottom identifier */}
      <div className="px-4 pb-3 pt-1">
        <span className="system-label text-[10px] text-soft-white/65">
          FRAMECRAFT / LOCAL
        </span>
      </div>
    </aside>
  );
}
