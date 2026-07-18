import { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "accent" | "ghost" | "danger" | "muted";
  size?: "xs" | "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "ghost", size = "md", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center",
          "font-mono uppercase whitespace-nowrap",
          "transition-all duration-150 ease-out",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red/60",
          {
            // size
            "h-7 px-2.5 gap-1.5 text-[10.5px] tracking-[0.08em]": size === "xs",
            "h-9 px-4 gap-2 text-[13px] tracking-widest": size === "sm",
            "h-10 px-4.5 gap-2 text-[13px] tracking-widest": size === "md",
            "h-11 px-5 gap-2 text-[13px] tracking-widest": size === "lg",
            // variants
            "bg-red/14 border border-red/60 text-white hover:bg-red/22 hover:border-red/80 rounded-[6px]":
              variant === "primary",
            "bg-amber/12 border border-amber/60 text-white hover:bg-amber/18 hover:border-amber/80 rounded-[6px]":
              variant === "accent",
            "border border-white/24 text-readable hover:border-cyan/65 hover:text-white hover:bg-cyan/8 rounded-[6px]":
              variant === "ghost",
            "border border-red/50 text-red hover:bg-red/10 hover:border-red/70 rounded-[6px]":
              variant === "danger",
            "text-readable hover:text-white hover:bg-white/6 rounded-[6px]": variant === "muted",
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
