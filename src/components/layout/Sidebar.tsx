import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Archive,
  BookOpen,
  Briefcase,
  Clapperboard,
  FileText,
  Film,
  GitCompare,
  Image,
  Layers,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Tag,
  Upload,
  Wand2,
} from "lucide-react";
import { getQueue } from "@/lib/queue";
import { cn } from "@/lib/utils";
import { prefetchRoute } from "@/lib/routePrefetch";

interface NavItemDef {
  label: string;
  to: string;
  icon: typeof Settings;
}

const NAV_GROUPS: { label: string; items: NavItemDef[] }[] = [
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
    label: "CINEMA STUDIO",
    items: [
      { label: "Cinema Studio", to: "/cinema-studio", icon: Clapperboard },
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
      { label: "Assets", to: "/library", icon: Archive },
      { label: "Tokens", to: "/tokens", icon: Tag },
      { label: "Results", to: "/results", icon: Film },
      { label: "References", to: "/references", icon: Image },
      { label: "SREFs", to: "/srefs", icon: BookOpen },
    ],
  },
  {
    label: "INTELLIGENCE",
    items: [
      { label: "Brief", to: "/brief", icon: FileText },
      { label: "Image", to: "/analyze", icon: Image },
      { label: "Frames", to: "/frames", icon: Layers },
      { label: "Compare", to: "/compare", icon: GitCompare },
    ],
  },
];

const ALL_NAV_ITEMS: NavItemDef[] = NAV_GROUPS.flatMap((g) => g.items);

const SIDEBAR_COLLAPSED_KEY = "fc_sidebar_collapsed";

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

/** One icon in the collapsed-state floating dock — macOS-dock-style: scales up on its own hover. */
function DockIcon({
  label,
  to,
  icon: Icon,
  badge,
  onNavigate,
}: {
  label: string;
  to: string;
  icon: typeof Settings;
  badge?: number;
  onNavigate: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      title={label}
      onClick={onNavigate}
      onMouseEnter={() => prefetchRoute(to)}
      className={({ isActive }) =>
        cn(
          "relative flex items-center justify-center w-10 h-10 rounded-lg shrink-0",
          "transition-all duration-150 ease-out hover:scale-[1.18] hover:-translate-y-0.5",
          isActive
            ? "bg-red/14 text-red"
            : "bg-white/5 text-soft-white/70 hover:bg-cyan/12 hover:text-cyan"
        )
      }
    >
      <Icon size={16} />
      {badge != null && badge > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-red text-white font-mono text-[8px]">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const [pendingCount, setPendingCount] = useState(0);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  });
  const [dockOpen, setDockOpen] = useState(false);
  const closeTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    getQueue()
      .then((items) => setPendingCount(items.filter((item) => item.status === "pending").length))
      .catch(() => setPendingCount(0));
  }, []);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    if (!collapsed) setDockOpen(false);
  }, [collapsed]);

  useEffect(() => () => { if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current); }, []);

  // Debounced open/close so moving the mouse across the small gap between the
  // hover rail and the floating dock doesn't cause it to flicker shut.
  const openDock = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    setDockOpen(true);
  };
  const scheduleCloseDock = () => {
    closeTimerRef.current = window.setTimeout(() => setDockOpen(false), 220);
  };

  if (collapsed) {
    return (
      <>
        {/* Thin always-present hover zone at the screen's left edge — hovering it reveals the dock. */}
        <div
          className="w-2 shrink-0"
          style={{ borderRight: "var(--border-default)" }}
          onMouseEnter={openDock}
          onMouseLeave={scheduleCloseDock}
        />
        <div
          onMouseEnter={openDock}
          onMouseLeave={scheduleCloseDock}
          className={cn(
            "fixed top-12 bottom-0 left-0 z-40 flex flex-col items-center gap-1.5 py-4 px-2",
            "transition-all duration-200 ease-out",
            dockOpen ? "translate-x-0 opacity-100 pointer-events-auto" : "-translate-x-3 opacity-0 pointer-events-none"
          )}
          style={{
            background: "rgba(10,10,10,0.94)",
            borderRight: "var(--border-default)",
            backdropFilter: "blur(8px)",
          }}
        >
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            title="Expand navigation"
            className="flex items-center justify-center w-10 h-10 rounded-lg mb-1 text-soft-white/60 hover:text-cyan hover:bg-cyan/10 transition-precise"
          >
            <PanelLeftOpen size={16} />
          </button>
          <div className="w-6 h-px bg-white/10 mb-1 shrink-0" />
          <div className="flex flex-col gap-1.5 overflow-y-auto">
            {ALL_NAV_ITEMS.map((item) => (
              <DockIcon
                key={item.to}
                {...item}
                badge={item.to === "/queue" ? pendingCount : undefined}
                onNavigate={scheduleCloseDock}
              />
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <aside
      className="w-52 flex flex-col shrink-0"
      style={{ borderRight: "var(--border-default)" }}
    >
      {/* Fold toggle */}
      <div className="flex items-center justify-end px-3 pt-3">
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          title="Collapse navigation"
          className="flex items-center justify-center w-7 h-7 rounded-sm text-soft-white/50 hover:text-cyan hover:bg-cyan/10 transition-precise"
        >
          <PanelLeftClose size={13} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto pb-3 pt-1 flex flex-col gap-4">
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
