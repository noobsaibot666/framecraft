import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Search, Star } from "lucide-react";
import { getTokenCategories, getTokensByCategory, createToken, toggleTokenFavorite } from "@/lib/db";
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
  const [activeCategoryName, setActiveCategoryName] = useState<string>("");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [newTokenText, setNewTokenText] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [savingNew, setSavingNew] = useState(false);
  const newInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getTokenCategories()
      .then((cats) => {
        setCategories(cats);
        if (cats.length) {
          setActiveCategoryId(cats[0].id);
          setActiveCategoryName(cats[0].name);
        }
      })
      .finally(() => setLoadingCats(false));
  }, []);

  const loadTokens = useCallback(async (categoryId: string) => {
    setLoadingTokens(true);
    setSearch("");
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

  useEffect(() => {
    if (addingNew) newInputRef.current?.focus();
  }, [addingNew]);

  const handleCategoryChange = (cat: TokenCategory) => {
    setActiveCategoryId(cat.id);
    setActiveCategoryName(cat.name);
    setAddingNew(false);
    setNewTokenText("");
  };

  const handleAddCustomToken = async () => {
    if (!newTokenText.trim() || !activeCategoryId) return;
    setSavingNew(true);
    try {
      const token = await createToken(newTokenText.trim(), activeCategoryId);
      setTokens((prev) => [token, ...prev]);
      onToggle(token);
      setNewTokenText("");
      setAddingNew(false);
    } finally {
      setSavingNew(false);
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent, token: Token) => {
    e.stopPropagation();
    const next = !token.is_favorite;
    setTokens((prev) => prev.map((t) => t.id === token.id ? { ...t, is_favorite: next } : t));
    await toggleTokenFavorite(token.id, next);
  };

  const selectedSet = new Set(selectedTexts);
  const favoriteCount = tokens.filter((t) => t.is_favorite).length;

  const visibleTokens = tokens.filter((t) => {
    if (favoritesOnly && !t.is_favorite) return false;
    if (search.trim() && !t.text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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
            onClick={() => handleCategoryChange(cat)}
            className={cn(
              "shrink-0 font-mono text-[8px] tracking-widest uppercase px-2.5 py-1 rounded-sm transition-precise whitespace-nowrap",
              activeCategoryId === cat.id ? "text-white" : "text-dim hover:text-muted"
            )}
            style={{
              border: activeCategoryId === cat.id ? "var(--border-strong)" : "var(--border-dim)",
              background: activeCategoryId === cat.id ? "rgba(255,255,255,0.06)" : "transparent",
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Search + favorites toggle + add custom */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={9} className="absolute left-2 top-1/2 -translate-y-1/2 text-dim/50 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter tokens…"
            className="w-full h-6 pl-6 pr-2 font-mono text-[9px] text-soft-white placeholder:text-dim/40 bg-transparent rounded-sm focus:outline-none transition-precise"
            style={{ border: "var(--border-dim)" }}
          />
        </div>
        {/* Favorites filter */}
        <button
          type="button"
          onClick={() => setFavoritesOnly((v) => !v)}
          className={cn(
            "h-6 px-2 rounded-sm font-mono text-[8px] tracking-widest uppercase transition-precise flex items-center gap-1",
            favoritesOnly ? "text-white" : "text-dim hover:text-muted"
          )}
          style={{ border: favoritesOnly ? "var(--border-strong)" : "var(--border-dim)" }}
          title="Show favorites only"
        >
          <Star size={8} className={cn(favoritesOnly && "fill-white/50")} />
          {favoriteCount > 0 && !favoritesOnly && <span>{favoriteCount}</span>}
        </button>
        <button
          type="button"
          onClick={() => setAddingNew((v) => !v)}
          className={cn(
            "h-6 px-2 rounded-sm font-mono text-[8px] tracking-widest uppercase transition-precise flex items-center gap-1",
            addingNew ? "text-white" : "text-dim hover:text-muted"
          )}
          style={{ border: addingNew ? "var(--border-strong)" : "var(--border-dim)" }}
          title="Add custom token"
        >
          <Plus size={8} />
          New
        </button>
      </div>

      {/* Custom token input */}
      {addingNew && (
        <div className="flex items-center gap-2">
          <input
            ref={newInputRef}
            value={newTokenText}
            onChange={(e) => setNewTokenText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddCustomToken();
              if (e.key === "Escape") { setAddingNew(false); setNewTokenText(""); }
            }}
            placeholder={`Custom ${activeCategoryName} token…`}
            className="flex-1 h-7 px-2.5 font-mono text-[10px] text-soft-white placeholder:text-dim/40 bg-transparent rounded-sm focus:outline-none transition-precise"
            style={{ border: "var(--border-strong)" }}
          />
          <button
            type="button"
            onClick={handleAddCustomToken}
            disabled={savingNew || !newTokenText.trim()}
            className="h-7 px-3 font-mono text-[9px] tracking-widest uppercase text-white rounded-sm transition-precise disabled:opacity-40"
            style={{ border: "var(--border-strong)", background: "rgba(255,255,255,0.08)" }}
          >
            {savingNew ? "…" : "Add"}
          </button>
        </div>
      )}

      {/* Favorites-only empty state */}
      {favoritesOnly && favoriteCount === 0 && (
        <div className="flex items-center justify-center py-4">
          <span className="font-mono text-[9px] text-dim/40">No favorites yet. Hold star on any token to save it.</span>
        </div>
      )}

      {/* Token pills grid */}
      {loadingTokens ? (
        <div className="flex items-center justify-center py-4">
          <span className="font-mono text-[9px] text-dim/40">Loading…</span>
        </div>
      ) : !favoritesOnly && visibleTokens.length === 0 ? (
        <div className="flex items-center justify-center py-4">
          <span className="font-mono text-[9px] text-dim/40">
            {search ? "No matches." : "No tokens. Run in Tauri to load library."}
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
          {visibleTokens.map((token) => {
            const active = selectedSet.has(token.text);
            const isHighQuality = token.quality_score > 0;
            return (
              <div key={token.id} className="relative group/pill">
                <button
                  type="button"
                  onClick={() => onToggle(token)}
                  className={cn(
                    "inline-flex items-center font-mono text-[9px] tracking-wide px-2 py-1 rounded-sm transition-precise pr-5",
                    active ? "text-white" : "text-dim/70 hover:text-muted"
                  )}
                  style={{
                    border: active
                      ? "var(--border-strong)"
                      : isHighQuality
                      ? "1px solid rgba(255,255,255,0.14)"
                      : "var(--border-dim)",
                    background: active
                      ? "rgba(255,255,255,0.08)"
                      : isHighQuality
                      ? "rgba(255,255,255,0.03)"
                      : "transparent",
                  }}
                  title={token.text}
                >
                  {active && <span className="mr-1 text-white/40 text-[8px]">✓</span>}
                  {token.text}
                </button>
                {/* Favorite star — always visible if favorited, hover-visible otherwise */}
                <button
                  type="button"
                  onClick={(e) => handleToggleFavorite(e, token)}
                  className={cn(
                    "absolute right-1 top-1/2 -translate-y-1/2 transition-precise",
                    token.is_favorite
                      ? "opacity-100 text-white/60"
                      : "opacity-0 group-hover/pill:opacity-100 text-dim/30 hover:text-white/50"
                  )}
                  title={token.is_favorite ? "Remove from favorites" : "Add to favorites"}
                >
                  <Star size={7} className={cn(token.is_favorite && "fill-white/50")} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
