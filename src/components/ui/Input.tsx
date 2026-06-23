import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  mono?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, mono, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="system-label">{label}</label>}
      <input
        ref={ref}
        className={cn(
          "w-full h-8 px-3",
          "bg-dark border border-white/10 rounded-[6px]",
          "text-white placeholder:text-dim",
          "text-[13px] leading-none",
          "transition-colors duration-150",
          "focus:outline-none focus:border-red/50",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          mono ? "font-mono" : "font-sans",
          className
        )}
        {...props}
      />
      {hint && <span className="font-mono text-[10px] text-dim tracking-wide">{hint}</span>}
    </div>
  )
);

Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  mono?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, hint, mono, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="system-label">{label}</label>}
      <textarea
        ref={ref}
        className={cn(
          "w-full px-3 py-2",
          "bg-dark border border-white/10 rounded-[6px]",
          "text-white placeholder:text-dim",
          "text-[13px] leading-relaxed",
          "transition-colors duration-150",
          "focus:outline-none focus:border-red/50",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          "resize-none",
          mono ? "font-mono" : "font-sans",
          className
        )}
        {...props}
      />
      {hint && <span className="font-mono text-[10px] text-dim tracking-wide">{hint}</span>}
    </div>
  )
);

Textarea.displayName = "Textarea";

export { Input, Textarea };
