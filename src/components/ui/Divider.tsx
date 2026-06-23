import { cn } from "@/lib/utils";

interface DividerProps {
  label?: string;
  className?: string;
  vertical?: boolean;
}

export function Divider({ label, className, vertical }: DividerProps) {
  if (vertical) {
    return (
      <div className={cn("w-px bg-white/8 self-stretch", className)} />
    );
  }

  if (label) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="flex-1 h-px bg-white/8" />
        <span className="system-label text-[9px]">{label}</span>
        <div className="flex-1 h-px bg-white/8" />
      </div>
    );
  }

  return <div className={cn("h-px bg-white/8", className)} />;
}
