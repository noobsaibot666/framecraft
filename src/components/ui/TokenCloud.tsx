import { useState, useEffect, useCallback } from "react";
import { getTokenCategories, getTokensByCategory } from "@/lib/db";
import { cn } from "@/lib/utils";
import type { TokenCategory, Token } from "@/types";

interface TokenCloudProps {
  selectedTexts: string[];
  onToggle: (token: Token) => void;
  providerFilter?: string;
}

export function TokenCloud({ selectedTexts, onToggle, providerFilter }: TokenCloudProps) {
  const [categories, setCategories] = useState<TokenCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingTokens, setLoadingTokens] = useState(false);

  useEffect(() => {
    getTokenCategories()
      .then((cats) => {
        setCategories(cats);
        if (cats.length) setActiveCategoryId(cats[0].id);
      })
      .finally(() => setLoadingCats(false));
  }, []);

  const loadTokens = useCallback(async (categoryId: string) => {
    setLoadingTokens(true);
    try {
      const raw = await getTokensByCategory(categoryId);
      const filtered = providerFilter
        ? raw.filter((t) => !t.provider || t.provider === providerFilter)
        : raw;
      setTokens(filtered);
    } finally {
      setLoadingTokens(false);
    }
  }, [providerFilter]);

  useEffect(() => {
    if (activeCategoryId) loadTokens(activeCategoryId);
  }, [activeCategoryId, loadTokens]);

  const selectedSet = new Set(selectedTexts);

  if (loadingCats) {
    return (
      <div className="flex items-center justify-center py-6">
        <span className="font-ndot text-[20px] text-dim/30 dot-blink">·</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategoryId(cat.id)}
            className={cn(
              "shrink-0 font-mono text-[8px] tracking-widest uppercase px-2.5 py-1 rounded-sm transition-precise whitespace-nowrap",
              activeCategoryId === cat.id
                ? "text-white"
                : "text-dim hover:text-muted"
            )}
            style={{
              border: activeCategoryId === cat.id
                ? "var(--border-strong)"
                : "var(--border-dim)",
              background: activeCategoryId === cat.id
                ? "rgba(255,255,255,0.06)"
                : "transparent",
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Token pills */}
      {loadingTokens ? (
        <div className="flex items-center justify-center py-4">
          <span className="font-mono text-[9px] text-dim/40">Loading…</span>
        </div>
      ) : tokens.length === 0 ? (
        <div className="flex items-center justify-center py-4">
          <span className="font-mono text-[9px] text-dim/40">
            No tokens. Run in Tauri to load library.
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
          {tokens.map((token) => {
            const active = selectedSet.has(token.text);
            return (
              <button
                key={token.id}
                type="button"
                onClick={() => onToggle(token)}
                className={cn(
                  "inline-flex items-center font-mono text-[9px] tracking-wide px-2 py-1 rounded-sm transition-precise",
                  active
                    ? "text-white"
                    : "text-dim/70 hover:text-muted"
                )}
                style={{
                  border: active ? "var(--border-strong)" : "var(--border-dim)",
                  background: active ? "rgba(255,255,255,0.08)" : "transparent",
                }}
                title={token.text}
              >
                {active && <span className="mr-1 text-white/40 text-[8px]">✓</span>}
                {token.text}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
