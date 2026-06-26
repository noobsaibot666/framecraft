import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { Provider, Severity } from "@/types";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "provider" | "category" | "status" | "risk" | "tag";
  active?: boolean;
  severity?: Severity;
}

const SEVERITY_COLORS: Record<Severity, string> = {
  low: "border-white/20 text-dim",
  medium: "border-white/25 text-muted",
  high: "border-red/40 text-red/80",
  critical: "border-red/70 text-red bg-red/10",
};

function Badge({ className, variant = "default", active, severity, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center",
        "font-mono text-[9px] tracking-[0.12em] uppercase",
        "border rounded-[4px] px-1.5 py-0.5",
        "transition-colors duration-150",
        {
          "border-white/15 text-dim": variant === "default" && !active,
          "border-red/60 text-red bg-red/8": active,
          "border-white/12 text-muted/80": variant === "provider",
          "border-white/10 text-dim": variant === "category" || variant === "tag",
        },
        severity && SEVERITY_COLORS[severity],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

const PROVIDER_LABELS: Record<Provider, string> = {
  midjourney: "MJ",
  dalle: "DALL·E",
  stable_diffusion: "SD",
  firefly: "FF",
  ideogram: "IDG",
  flux: "FLUX",
  nano_banana: "NANO",
  gpt_image: "GPT",
  seedance: "SEED",
  kling: "KLING",
  runway: "RUN",
  higgsfield: "HIGGS",
  other: "OTHER",
};

function ProviderBadge({ provider, className }: { provider: Provider; className?: string }) {
  return (
    <Badge variant="provider" className={cn("tracking-wider", className)}>
      {PROVIDER_LABELS[provider]}
    </Badge>
  );
}

function RiskBadge({ score, className }: { score: number; className?: string }) {
  const severity: Severity =
    score >= 8 ? "critical" : score >= 6 ? "high" : score >= 4 ? "medium" : "low";
  return (
    <Badge severity={severity} className={className}>
      RISK {score}/10
    </Badge>
  );
}

export { Badge, ProviderBadge, RiskBadge };
