import { cn } from "@/lib/utils";

interface RatingDisplayProps {
  value: number;
  max?: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md";
  className?: string;
}

export function RatingDisplay({
  value,
  max = 5,
  onChange,
  size = "md",
  className,
}: RatingDisplayProps) {
  const dots = Array.from({ length: max }, (_, i) => i + 1);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {dots.map((dot) => (
        <button
          key={dot}
          onClick={() => onChange?.(dot)}
          className={cn(
            "rounded-full transition-all duration-100",
            {
              "w-1.5 h-1.5": size === "sm",
              "w-2 h-2": size === "md",
            },
            dot <= value ? "bg-white" : "bg-white/20",
            onChange && "hover:bg-white/60 cursor-pointer",
            !onChange && "cursor-default"
          )}
          disabled={!onChange}
          aria-label={`Rate ${dot} of ${max}`}
        />
      ))}
    </div>
  );
}
