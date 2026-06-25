import { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "accent" | "ghost" | "danger" | "muted";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "ghost", size = "md", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2",
          "font-mono text-[11.5px] tracking-[0.10em] uppercase whitespace-nowrap",
          "transition-all duration-150 ease-out",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red/60",
          {
            // size
            "h-8 px-3.5": size === "sm",
            "h-9 px-4": size === "md",
            "h-10 px-5": size === "lg",
            // variants
            "bg-red/14 border border-red/60 text-white hover:bg-red/22 hover:border-red/80 rounded-[6px]":
              variant === "primary",
            "bg-amber/12 border border-amber/60 text-white hover:bg-amber/18 hover:border-amber/80 rounded-[6px]":
              variant === "accent",
            "border border-white/18 text-readable hover:border-cyan/55 hover:text-white rounded-[6px]":
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
