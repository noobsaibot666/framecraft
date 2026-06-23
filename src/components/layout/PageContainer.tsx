import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function PageContainer({
  title,
  subtitle,
  action,
  className,
  children,
  ...props
}: PageContainerProps) {
  return (
    <div className={cn("flex flex-col min-w-0 min-h-full", className)} {...props}>
      {(title || action) && (
        <div
          className="flex items-center justify-between px-8 py-5 shrink-0"
          style={{ borderBottom: "var(--border-default)" }}
        >
          <div className="flex flex-col gap-1">
            {title && (
              <h1 className="font-sans text-[13px] font-semibold text-white tracking-[0.04em] uppercase">
                {title}
              </h1>
            )}
            {subtitle && (
              <span className="system-label text-[9px]">{subtitle}</span>
            )}
          </div>
          {action && <div className="shrink-0 ml-6">{action}</div>}
        </div>
      )}
      <div className="p-8">
        {children}
      </div>
    </div>
  );
}
