import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  hoverable?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, active, hoverable = false, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-card border bg-white/4",
        "transition-all duration-150 ease-out",
        active
          ? "border-red/60 bg-red/4"
          : "border-white/10",
        hoverable && !active &&
          "hover:bg-white/7 hover:border-white/18 cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);

Card.displayName = "Card";

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  count?: number | string;
  action?: React.ReactNode;
}

const CardHeader = ({ label, count, action, className, ...props }: CardHeaderProps) => (
  <div
    className={cn(
      "flex items-center justify-between px-4 py-3",
      "border-b border-white/7",
      className
    )}
    {...props}
  >
    <div className="flex items-center gap-3">
      <span className="system-label">{label}</span>
      {count !== undefined && (
        <span className="font-mono text-[10px] text-dim tabular-nums">
          {String(count).padStart(3, "0")}
        </span>
      )}
    </div>
    {action && <div>{action}</div>}
  </div>
);

const CardBody = ({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-4", className)} {...props}>
    {children}
  </div>
);

export { Card, CardHeader, CardBody };
