import { cn } from "@/lib/utils";

interface StatusDotProps {
  active?: boolean;
  size?: "sm" | "md";
  /** Active-state color. Defaults to "red" to preserve existing call sites' behavior. */
  color?: "red" | "blue";
  className?: string;
}

export function StatusDot({ active, size = "md", color = "red", className }: StatusDotProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-full",
        {
          "w-1.5 h-1.5": size === "sm",
          "w-2 h-2": size === "md",
          "bg-red": active && color === "red",
          "bg-blue": active && color === "blue",
          "bg-dim": !active,
        },
        className
      )}
    />
  );
}
