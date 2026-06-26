import { cn } from "@/lib/utils";

interface StatusDotProps {
  active?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function StatusDot({ active, size = "md", className }: StatusDotProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-full",
        {
          "w-1.5 h-1.5": size === "sm",
          "w-2 h-2": size === "md",
          "bg-red": active,
          "bg-dim": !active,
        },
        className
      )}
    />
  );
}
