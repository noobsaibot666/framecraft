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
          "font-mono text-[11.5px] tracking-[0.10em] uppercase whitespace-nowrap",
          "transition-all duration-150 ease-out",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red/60",
          {
            // size
            "h-7 px-3": size === "sm",
            "h-8 px-4": size === "md",
            "h-9 px-5": size === "lg",
            // variants
            "bg-red/12 border border-red/55 text-white hover:bg-red/18 hover:border-red/75 rounded-[6px]":
              variant === "primary",
            "border border-white/14 text-readable hover:border-white/28 hover:text-white rounded-[6px]":
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
