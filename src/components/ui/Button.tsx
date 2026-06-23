import { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger" | "muted";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "ghost", size = "md", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2",
          "font-mono text-[11px] tracking-[0.10em] uppercase",
          "transition-all duration-150 ease-out",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red/60",
          {
            // size
            "h-7 px-3": size === "sm",
            "h-8 px-4": size === "md",
            "h-9 px-5": size === "lg",
            // variants
            "bg-white/5 border border-white/15 text-white hover:bg-white/10 hover:border-white/25 rounded-[6px]":
              variant === "primary",
            "border border-white/10 text-muted hover:border-white/20 hover:text-white rounded-[6px]":
              variant === "ghost",
            "border border-red/50 text-red hover:bg-red/10 hover:border-red/70 rounded-[6px]":
              variant === "danger",
            "text-dim hover:text-muted rounded-[6px]": variant === "muted",
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export { Button };
