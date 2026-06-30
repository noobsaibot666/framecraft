import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Check, Star, AlertTriangle, ChevronDown, ChevronUp, Lightbulb } from "lucide-react";
import { getRecommendations, type RecommendationSet, type RecommendationContext } from "@/lib/recommendations";
import { useImageDisplaySrc } from "@/lib/useImageDisplaySrc";
import { cn } from "@/lib/utils";

// ─── Section wrapper ──────────────────────────────────────────

function Section({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-8 items-center justify-between w-full group"
      >
        <span className="system-label">{title}</span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-readable">{count}</span>
          {open
            ? <ChevronUp size={10} className="text-readable group-hover:text-cyan transition-precise" />
            : <ChevronDown size={10} className="text-readable group-hover:text-cyan transition-precise" />
          }
        </div>
      </button>
      {open && <div className="flex flex-col gap-1.5">{children}</div>}
    </div>
  );
}

// ─── Token chip ───────────────────────────────────────────────

function TokenChip({
  text,
  reason,
  onCopy,
  copied,
}: {
  text: string;
  reason: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      title={reason}
      className={cn(
        "flex min-h-9 items-center gap-2 px-3 py-2 rounded-sm text-left transition-precise",
        "hover:bg-cyan/6 group"
      )}
      style={{ border: "var(--border-dim)" }}
    >
      <span className="font-mono text-[11px] text-soft-white flex-1 truncate">{text}</span>
      {copied
        ? <Check size={10} className="text-cyan shrink-0" />
        : <Copy size={10} className="text-readable group-hover:text-cyan shrink-0 transition-precise" />
      }
    </button>
  );
}

// ─── Prompt row ───────────────────────────────────────────────

function PromptRow({
  id,
  title,
  reason,
  rating,
  isWinner,
}: {
  id: string;
  title: string;
  reason: string;
  rating: number;
  isWinner: boolean;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(`/library/${id}`)}
      className="flex min-h-10 items-start gap-2.5 px-3 py-2 rounded-sm text-left hover:bg-cyan/6 transition-precise group"
      style={{ border: "var(--border-dim)" }}
    >
      <div className="flex-1 min-w-0">
        <span className="font-sans text-[11.5px] text-soft-white block truncate">{title}</span>
        <span className="font-mono text-[10px] text-readable">{reason}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        {isWinner && <Star size={10} className="text-amber fill-amber/35" />}
        {rating > 0 && (
          <span className="font-mono text-[10px] text-readable">{rating}/5</span>
        )}
      </div>
    </button>
  );
}

// ─── SREF/Profile row ─────────────────────────────────────────

function CodeRow({
  code,
  title,
  reason,
  rating,
  prefix,
}: {
  code: string;
  title?: string;
  reason: string;
  rating: number;
  prefix: string;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(`${prefix} ${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex min-h-10 items-center gap-2.5 px-3 py-2 rounded-sm"
      style={{ border: "var(--border-dim)" }}>
      <div className="flex-1 min-w-0">
        <span className="font-mono text-[10.5px] text-soft-white truncate block">{code}</span>
        {title && <span className="font-mono text-[10px] text-readable truncate block">{title}</span>}
        <span className="font-mono text-[10px] text-readable">{reason}</span>
      </div>
      {rating > 0 && (
        <span className="font-mono text-[10px] text-readable shrink-0">{rating}/5</span>
      )}
      <button type="button" onClick={handleCopy}
        className="shrink-0 text-readable hover:text-cyan transition-precise">
        {copied ? <Check size={10} /> : <Copy size={10} />}
      </button>
    </div>
  );
}

// ─── Reference row ────────────────────────────────────────────

function ReferenceRow({
  id,
  title,
  kind,
  thumbnail,
  reason,
}: {
  id: string;
  title: string;
  kind: string;
  thumbnail?: string;
  reason: string;
}) {
  const navigate = useNavigate();
  const thumb = useImageDisplaySrc(thumbnail);
  return (
    <button type="button" onClick={() => navigate(`/references/${id}`)}
      className="flex min-h-10 items-center gap-2.5 px-3 py-2 rounded-sm text-left hover:bg-cyan/6 transition-precise"
      style={{ border: "var(--border-dim)" }}>
      {thumb.src ? (
        <img src={thumb.src} alt="" className="w-7 h-7 object-cover rounded-sm shrink-0" onError={thumb.onError} />
      ) : (
        <div className="w-7 h-7 rounded-sm shrink-0" style={{ background: "rgba(255,255,255,0.05)" }} />
      )}
      <div className="flex-1 min-w-0">
        <span className="font-sans text-[11.5px] text-soft-white truncate block">{title}</span>
        <span className="font-mono text-[10px] text-readable">{kind} · {reason}</span>
      </div>
    </button>
  );
}

// ─── Avoidance row ────────────────────────────────────────────

function AvoidanceRow({
  label,
  reason,
  severity,
}: {
  label: string;
  reason: string;
  severity: string;
}) {
  return (
    <div className="flex min-h-10 items-start gap-2.5 px-3 py-2 rounded-sm"
      style={{ border: "var(--border-dim)" }}>
      <AlertTriangle size={11} className={cn(
        "shrink-0 mt-0.5",
        severity === "critical" || severity === "high" ? "text-red/50" : "text-white/25"
      )} />
      <div className="flex-1 min-w-0">
        <span className="font-mono text-[10.5px] text-soft-white block">{label}</span>
        <span className="font-mono text-[10px] text-readable">{reason}</span>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────

interface Props {
  context: RecommendationContext;
  onTokenCopy?: (text: string) => void;
}

export function RecommendationPanel({ context, onTokenCopy }: Props) {
  const [recs, setRecs] = useState<RecommendationSet | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!context.provider && !context.category) {
      setRecs(null);
      return;
    }
    setLoading(true);
    try {
      setRecs(await getRecommendations(context));
    } finally {
      setLoading(false);
    }
  }, [context.provider, context.category, context.excludePromptId, context.projectId, context.promptText]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [load]);

  const handleCopyToken = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(text);
    setTimeout(() => setCopiedToken(null), 1500);
    onTokenCopy?.(text);
  };

  const total = recs
    ? recs.tokens.length + recs.prompts.length + recs.recipes.length +
      recs.srefs.length + recs.profiles.length + recs.references.length + recs.avoidance.length
    : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Lightbulb size={12} className="text-cyan" />
        <span className="system-label">RECOMMENDATIONS</span>
        {loading && <span className="font-mono text-[10px] text-readable">Loading...</span>}
      </div>

      {!recs || total === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-1">
          <span className="font-mono text-[11px] text-readable">
            {loading
              ? "Scanning library…"
              : !context.provider
                ? "Select a provider to see recommendations."
                : "No recommendations yet — build up your library."}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-4">

          {/* Proven Tokens */}
          <Section title="PROVEN TOKENS" count={recs.tokens.length}>
            <div className="flex flex-col gap-1">
              {recs.tokens.map((r) => (
                <TokenChip
                  key={r.token.id}
                  text={r.token.text}
                  reason={r.reason}
                  onCopy={() => handleCopyToken(r.token.text)}
                  copied={copiedToken === r.token.text}
                />
              ))}
            </div>
          </Section>

          {/* Related Prompts */}
          <Section title="RELATED PROMPTS" count={recs.prompts.length} defaultOpen={false}>
            {recs.prompts.map((r) => (
              <PromptRow
                key={r.prompt.id}
                id={r.prompt.id}
                title={r.prompt.title}
                reason={r.reason}
                rating={r.prompt.rating}
                isWinner={r.prompt.is_winner}
              />
            ))}
          </Section>

          {/* Recipes */}
          <Section title="RECIPES" count={recs.recipes.length} defaultOpen={false}>
            {recs.recipes.map((r) => (
              <PromptRow
                key={r.recipe.id}
                id={r.recipe.id}
                title={r.recipe.title}
                reason={r.reason}
                rating={r.recipe.rating}
                isWinner={false}
              />
            ))}
          </Section>

          {/* SREFs */}
          <Section title="STYLE REFS" count={recs.srefs.length} defaultOpen={false}>
            {recs.srefs.map((r) => (
              <CodeRow
                key={r.sref.id}
                code={r.sref.code}
                title={r.sref.title}
                reason={r.reason}
                rating={r.sref.rating}
                prefix="--sref"
              />
            ))}
          </Section>

          {/* Profiles */}
          <Section title="PROFILES" count={recs.profiles.length} defaultOpen={false}>
            {recs.profiles.map((r) => (
              <CodeRow
                key={r.profile.id}
                code={r.profile.code}
                title={r.profile.title}
                reason={r.reason}
                rating={r.profile.rating}
                prefix="--p"
              />
            ))}
          </Section>

          {/* References */}
          <Section title="REFERENCES" count={recs.references.length} defaultOpen={false}>
            {recs.references.map((r) => (
              <ReferenceRow
                key={r.reference.id}
                id={r.reference.id}
                title={r.reference.title}
                kind={r.reference.kind}
                thumbnail={r.reference.thumbnail_data}
                reason={r.reason}
              />
            ))}
          </Section>

          {/* Avoidance */}
          <Section title="WATCH OUT FOR" count={recs.avoidance.length} defaultOpen={false}>
            {recs.avoidance.map((r, i) => (
              <AvoidanceRow key={i} label={r.label} reason={r.reason} severity={r.severity} />
            ))}
          </Section>

        </div>
      )}
    </div>
  );
}
