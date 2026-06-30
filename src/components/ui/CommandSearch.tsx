import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, Briefcase, Compass, FileText, FolderOpen, Image, Layers, Tag, Zap,
} from "lucide-react";
import { searchAll, NAV_SHORTCUTS, type CommandResult, type CommandResultType } from "@/lib/commandSearch";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<CommandResultType, string> = {
  prompt:    "PROMPT",
  recipe:    "RECIPE",
  token:     "TOKEN",
  project:   "PROJECT",
  reference: "REF",
  campaign:  "CAMPAIGN",
  nav:       "GO",
};

const TYPE_ICON: Record<CommandResultType, React.ReactNode> = {
  prompt:    <FileText size={11} />,
  recipe:    <Layers size={11} />,
  token:     <Tag size={11} />,
  project:   <FolderOpen size={11} />,
  reference: <Image size={11} />,
  campaign:  <Briefcase size={11} />,
  nav:       <Compass size={11} />,
};

const TYPE_COLOR: Record<CommandResultType, string> = {
  prompt:    "text-cyan",
  recipe:    "text-white/60",
  token:     "text-amber/70",
  project:   "text-amber",
  reference: "text-readable",
  campaign:  "text-white/50",
  nav:       "text-dim/70",
};

function ResultRow({ result, active, onClick }: {
  result: CommandResult;
  active: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-precise",
        active ? "bg-white/6" : "hover:bg-white/3"
      )}
    >
      <span className={cn("shrink-0", TYPE_COLOR[result.type])}>
        {TYPE_ICON[result.type]}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-sans text-[14px] text-soft-white truncate">{result.title}</span>
        {result.subtitle && (
          <span className="block font-mono text-[10px] text-readable truncate mt-0.5">{result.subtitle}</span>
        )}
      </span>
      <span className={cn("shrink-0 font-mono text-[8px] tracking-widest", TYPE_COLOR[result.type])}>
        {TYPE_LABEL[result.type]}
      </span>
      {active && <ArrowRight size={9} className="shrink-0 text-white/30" />}
    </button>
  );
}

interface Props {
  onClose: () => void;
}

export function CommandSearch({ onClose }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommandResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showingNavShortcuts = query.trim().length < 2;
  const displayResults = showingNavShortcuts ? NAV_SHORTCUTS : results;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setActiveIndex(0);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const found = await searchAll(query);
        setResults(found);
        setActiveIndex(0);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const navigate_to = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, displayResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && displayResults[activeIndex]) {
      navigate_to(displayResults[activeIndex].path);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.65)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed z-50 left-1/2 -translate-x-1/2 w-full max-w-xl rounded-card overflow-hidden"
        style={{
          top: "18vh",
          border: "var(--border-strong)",
          background: "var(--surface-card)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
        }}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "var(--border-default)" }}>
          <Zap size={13} className="text-readable shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search or jump to… (prompts, recipes, tokens, projects…)"
            className="flex-1 bg-transparent font-mono text-[14px] text-white placeholder:text-dim focus:outline-none"
          />
          {loading && (
            <span className="font-mono text-[9px] text-dim/40 shrink-0">···</span>
          )}
          <kbd className="font-mono text-[9px] text-dim/40 px-1.5 py-0.5 rounded shrink-0"
            style={{ border: "var(--border-dim)" }}>
            ESC
          </kbd>
        </div>

        {/* Navigation shortcuts (when query empty) */}
        {showingNavShortcuts && (
          <>
            <div className="px-4 pt-3 pb-1">
              <span className="font-mono text-[8px] uppercase tracking-widest text-dim/40">QUICK NAVIGATE</span>
            </div>
            <div className="pb-1">
              {NAV_SHORTCUTS.map((r, i) => (
                <ResultRow
                  key={r.id}
                  result={r}
                  active={i === activeIndex}
                  onClick={() => navigate_to(r.path)}
                />
              ))}
            </div>
          </>
        )}

        {/* Search results */}
        {!showingNavShortcuts && results.length > 0 && (
          <div className="max-h-80 overflow-y-auto py-1">
            {results.map((r, i) => (
              <ResultRow
                key={`${r.type}-${r.id}`}
                result={r}
                active={i === activeIndex}
                onClick={() => navigate_to(r.path)}
              />
            ))}
          </div>
        )}

        {/* Empty search state */}
        {!showingNavShortcuts && !loading && results.length === 0 && (
          <div className="px-4 py-6 text-center">
            <span className="font-mono text-[12px] text-muted">No results for "{query}"</span>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2.5 flex items-center gap-3" style={{ borderTop: "var(--border-dim)" }}>
          {(["prompt", "recipe", "token", "project", "reference"] as CommandResultType[]).map((t) => (
            <span key={t} className={cn("flex items-center gap-1 font-mono text-[8px] tracking-widest", TYPE_COLOR[t])}>
              {TYPE_ICON[t]}
            </span>
          ))}
          <span className="flex-1" />
          <span className="font-mono text-[9px] text-dim/40">↑↓ navigate · ↵ open</span>
        </div>
      </div>
    </>
  );
}
