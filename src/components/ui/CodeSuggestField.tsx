import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { recommendSREFs, recommendProfiles, type RecommendationContext } from "@/lib/recommendations";
import { createLatestRequestGuard } from "@/lib/latestRequest";
import { cn } from "@/lib/utils";

// ─── SREF / --profile intelligence field ───────────────────────
// Drop-in replacement for a plain code input (SREF CODE, PROFILE --profile):
// focusing it queries the same recommendation intelligence that powers the
// Craft Prompt "Proven Tokens" panel (recommendSREFs/recommendProfiles in
// recommendations.ts) for codes used in similar — especially winning —
// prompts, so a good starting code is one click away instead of requiring
// the user to already know what to type or browse the full library.

interface CodeSuggestion {
  code: string;
  reason: string;
  rating: number;
}

interface CodeSuggestFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  kind: "sref" | "profile";
  context: RecommendationContext;
}

export function CodeSuggestField({ label, value, onChange, placeholder, kind, context }: CodeSuggestFieldProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<CodeSuggestion[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadGuardRef = useRef(createLatestRequestGuard());

  const handleFocus = async () => {
    setOpen(true);
    const request = loadGuardRef.current.begin();
    setLoading(true);
    try {
      const results = kind === "sref"
        ? (await recommendSREFs(context, 6)).map((r) => ({ code: r.sref.code, reason: r.reason, rating: r.sref.rating }))
        : (await recommendProfiles(context, 6)).map((r) => ({ code: r.profile.code, reason: r.reason, rating: r.profile.rating }));
      if (loadGuardRef.current.isCurrent(request)) setSuggestions(results);
    } catch {
      if (loadGuardRef.current.isCurrent(request)) setSuggestions([]);
    } finally {
      if (loadGuardRef.current.isCurrent(request)) setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => () => loadGuardRef.current.invalidate(), []);

  return (
    <div className="relative flex flex-col gap-1.5" ref={containerRef}>
      {label && <label className="system-label text-[12px] text-muted">{label}</label>}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        placeholder={placeholder}
        className="w-full h-10 px-3 font-mono text-[13px] text-soft-white placeholder:text-dim bg-dark rounded-sm focus:outline-none focus:border-cyan/55 transition-precise"
        style={{ border: "1px solid rgba(255,255,255,0.16)" }}
      />
      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 z-20 flex flex-col gap-0.5 p-1.5 rounded-sm max-h-56 overflow-y-auto"
          style={{ border: "var(--border-strong)", background: "#161616" }}
        >
          <span className="flex items-center gap-1.5 px-1.5 py-1 font-mono text-[8px] uppercase tracking-widest text-cyan/60">
            <Sparkles size={8} /> Suggested from similar prompts
          </span>
          {loading ? (
            <span className="px-2 py-2 font-mono text-[10px] text-muted">Loading suggestions…</span>
          ) : suggestions.length === 0 ? (
            <span className="px-2 py-2 font-mono text-[10px] text-muted leading-relaxed">
              No suggestions yet — {kind === "sref" ? "rate some style refs or reuse codes across" : "reuse profile codes across"} a few prompts to build this up.
            </span>
          ) : (
            suggestions.map((s) => (
              <button
                key={s.code}
                type="button"
                onClick={() => { onChange(s.code); setOpen(false); }}
                className={cn(
                  "flex items-center justify-between gap-2 px-2 py-1.5 rounded-sm text-left transition-precise",
                  s.code === value ? "bg-cyan/10 text-white" : "hover:bg-white/6 text-soft-white"
                )}
              >
                <span className="font-mono text-[11px] shrink-0">{s.code}</span>
                <span className="font-mono text-[9px] text-cyan/70 truncate">{s.reason}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
