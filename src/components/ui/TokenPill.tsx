import { X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TokenPill as TokenPillType } from "@/types";

interface TokenPillProps {
  token: TokenPillType;
  onRemove?: () => void;
  draggable?: boolean;
  selected?: boolean;
  compact?: boolean;
  className?: string;
}

export function TokenPill({
  token,
  onRemove,
  draggable,
  selected,
  compact,
  className,
}: TokenPillProps) {
  const text = token.custom_text ?? token.text;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1",
        "border rounded-pill",
        "transition-all duration-150",
        selected
          ? "border-red/60 bg-red/8 text-white"
          : "border-white/15 bg-white/4 text-soft-white hover:border-white/25",
        compact ? "text-[10.5px] px-2.5 py-1" : "text-[11.5px] px-3 py-1.5",
        className
      )}
    >
      {draggable && (
        <GripVertical
          size={10}
          className="text-readable cursor-grab active:cursor-grabbing shrink-0"
        />
      )}
      <span className="font-mono tracking-wide leading-none">{text}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 text-readable hover:text-red transition-colors shrink-0"
          aria-label={`Remove ${text}`}
        >
          <X size={9} />
        </button>
      )}
    </div>
  );
}

interface TokenCloudItemProps {
  text: string;
  onClick?: () => void;
  added?: boolean;
  className?: string;
}

export function TokenCloudItem({ text, onClick, added, className }: TokenCloudItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center",
        "border rounded-pill px-3.5 py-1.5",
        "font-mono text-[11.5px] tracking-wide",
        "transition-all duration-150",
        "focus-visible:outline-none",
        added
          ? "border-red/40 text-red/70 bg-red/5 cursor-default"
          : "border-white/18 text-readable hover:border-cyan/45 hover:text-white hover:bg-cyan/6",
        className
      )}
    >
      {text}
    </button>
  );
}
