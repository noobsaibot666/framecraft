import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Collapsible right-column card ─────────────────────────────
// Shared fold/unfold chrome for right-column sidebar cards (params, metadata,
// recommendations, etc.) so any page's sidebar can be scanned or tucked away
// section by section — originally introduced in CraftPrompt, extracted here
// so other detail pages can reuse the same pattern.

export function CollapsibleCard({
  title,
  icon,
  headerExtra,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  gap = "gap-4",
  style,
  titleClassName,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  headerExtra?: React.ReactNode;
  defaultOpen?: boolean;
  /** Controlled open state — when provided, the card no longer manages its own state internally. Omit for the original uncontrolled behavior. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  gap?: string;
  style?: React.CSSProperties;
  titleClassName?: string;
  children: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const toggle = () => {
    const next = !open;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };
  return (
    <div className={cn("flex flex-col p-5 rounded-card", gap)} style={style ?? { border: "var(--border-default)", background: "var(--surface-card)" }}>
      {/* role="button" div, not a real <button> — headerExtra often carries its
          own interactive buttons (e.g. "Add", AIImproveButton), and nesting
          <button> inside <button> is invalid HTML / breaks hydration. */}
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
        className="flex items-center justify-between w-full group text-left cursor-pointer"
      >
        <span className={cn("flex items-center gap-2 system-label", titleClassName ?? "text-soft-white")}>
          {icon}
          {title}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {headerExtra}
          {open
            ? <ChevronUp size={11} className="text-readable group-hover:text-cyan transition-precise" />
            : <ChevronDown size={11} className="text-readable group-hover:text-cyan transition-precise" />}
        </div>
      </div>
      {open && children}
    </div>
  );
}
