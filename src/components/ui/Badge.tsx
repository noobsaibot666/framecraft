import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { Provider, Severity } from "@/types";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "provider" | "category" | "status" | "risk" | "tag";
  active?: boolean;
  severity?: Severity;
}

const SEVERITY_COLORS: Record<Severity, string> = {
  low: "border-white/24 text-readable",
  medium: "border-white/25 text-muted",
  high: "border-red/40 text-red/80",
  critical: "border-red/70 text-red bg-red/10",
};

function Badge({ className, variant = "default", active, severity, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center",
        "font-mono text-[10px] tracking-[0.12em] uppercase",
        "border rounded-[4px] px-2 py-1",
        "transition-colors duration-150",
        {
          "border-white/20 text-readable": variant === "default" && !active,
          "border-red/60 text-red bg-red/8": active,
          "border-white/16 text-readable": variant === "category" || variant === "tag",
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
  midjourney:        "MJ",
  dalle:             "DALL·E",
  stable_diffusion:  "SD",
  firefly:           "FF",
  ideogram:          "IDG",
  flux:              "FLUX",
  nano_banana:       "NANO",
  gpt_image:         "GPT",
  seedance:          "SEED",
  kling:             "KLING",
  runway:            "RUN",
  higgsfield:        "HIGGS",
  other:             "OTHER",
};

// Subtle per-provider color identity (border + text as inline style values)
export const PROVIDER_COLORS: Record<Provider, { border: string; text: string; bg: string }> = {
  midjourney:       { border: "rgba(99,179,237,0.35)",  text: "#63b3ed", bg: "rgba(99,179,237,0.06)"  },
  nano_banana:      { border: "rgba(246,173,85,0.35)",  text: "#f6ad55", bg: "rgba(246,173,85,0.06)"  },
  gpt_image:        { border: "rgba(104,211,145,0.35)", text: "#68d391", bg: "rgba(104,211,145,0.06)" },
  seedance:         { border: "rgba(183,148,244,0.35)", text: "#b794f4", bg: "rgba(183,148,244,0.06)" },
  kling:            { border: "rgba(252,129,74,0.35)",  text: "#fc814a", bg: "rgba(252,129,74,0.06)"  },
  runway:           { border: "rgba(246,135,179,0.35)", text: "#f687b3", bg: "rgba(246,135,179,0.06)" },
  higgsfield:       { border: "rgba(129,230,217,0.35)", text: "#81e6d9", bg: "rgba(129,230,217,0.06)" },
  dalle:            { border: "rgba(104,211,145,0.28)", text: "#68d391", bg: "rgba(104,211,145,0.05)" },
  stable_diffusion: { border: "rgba(99,179,237,0.28)",  text: "#63b3ed", bg: "rgba(99,179,237,0.05)"  },
  firefly:          { border: "rgba(252,129,74,0.28)",  text: "#fc814a", bg: "rgba(252,129,74,0.05)"  },
  ideogram:         { border: "rgba(246,173,85,0.28)",  text: "#f6ad55", bg: "rgba(246,173,85,0.05)"  },
  flux:             { border: "rgba(183,148,244,0.28)", text: "#b794f4", bg: "rgba(183,148,244,0.05)" },
  other:            { border: "rgba(255,255,255,0.14)", text: "#a0aec0", bg: "transparent"            },
};

function ProviderBadge({ provider, className }: { provider: Provider; className?: string }) {
  const colors = PROVIDER_COLORS[provider] ?? PROVIDER_COLORS.other;
  return (
    <span
      className={cn(
        "inline-flex items-center font-mono text-[10px] tracking-[0.14em] uppercase rounded-[4px] px-2 py-1 transition-colors duration-150",
        className
      )}
      style={{ border: `1px solid ${colors.border}`, color: colors.text, background: colors.bg }}
    >
      {PROVIDER_LABELS[provider]}
    </span>
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
