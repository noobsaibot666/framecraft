import { cn } from "@/lib/utils";

interface DotMatrixProps {
  value: string | number;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  muted?: boolean;
}

const SIZE_CLASSES = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl",
  xl: "text-6xl",
};

export function DotMatrix({ value, size = "md", muted, className }: DotMatrixProps) {
  return (
    <span
      className={cn(
        "font-ndot tabular-nums",
        SIZE_CLASSES[size],
        muted ? "text-dim" : "text-white",
        className
      )}
    >
      {value}
    </span>
  );
}
