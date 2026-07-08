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
    <div className={cn("flex flex-col min-h-full w-full", className)} {...props}>
      {(title || action) && (
        <div className="w-full shrink-0" style={{ borderBottom: "var(--border-default)" }}>
          <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-6 px-10 py-7">
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              {title && (
                <h1 className="font-sans text-[17px] font-semibold text-white tracking-[0.03em] uppercase truncate" title={title}>
                  {title}
                </h1>
              )}
              {subtitle && (
                <span className="system-label text-[12px] text-readable">{subtitle}</span>
              )}
            </div>
            {action && <div className="shrink-0 ml-6">{action}</div>}
          </div>
        </div>
      )}
      <div className="w-full flex-1">
        <div className="max-w-screen-2xl mx-auto px-10 py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
