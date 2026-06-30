import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, Search, Star } from "lucide-react";
import { getTokenCategories, getTokensByCategory, createToken, toggleTokenFavorite } from "@/lib/db";
import { createTokenCategoryCache, filterTokensForProvider } from "@/lib/tokenCloudCache";
import { cn } from "@/lib/utils";
import type { TokenCategory, Token } from "@/types";

const CATEGORY_HINTS: Record<string, string> = {
  subject: "Who or what the output is about.",
  action: "Movement, pose, interaction, or behavior.",
  environment: "Place, set, surface, or world context.",
  camera: "Framing, viewpoint, shot type, and capture movement.",
  lens: "Optics, focal length, depth of field, and lens artifacts.",
  composition: "Layout, balance, crop, and spatial structure.",
  lighting: "Source, quality, direction, and time of light.",
  mood: "Emotional tone and visual atmosphere.",
  material: "Surface, texture, construction, and tactile detail.",
  color: "Palette, contrast, and color direction.",
  realism: "Reality anchors and anti-AI visual details.",
  brand_tone: "Commercial voice, audience feel, and positioning.",
  motion: "Video/frame movement and dynamic image cues.",
  avoidance: "Negative cues that reduce common AI artifacts.",
  parameters: "Provider flags and technical output controls.",
};

interface TokenCloudProps {
  selectedTexts: string[];
  onToggle: (token: Token) => void;
  providerFilter?: string;
  suppressedText?: string;
}

export function TokenCloud({ selectedTexts, onToggle, providerFilter, suppressedText }: TokenCloudProps) {
  const tokenCacheRef = useRef(createTokenCategoryCache(getTokensByCategory));
  const [categories, setCategories] = useState<TokenCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeCategoryName, setActiveCategoryName] = useState<string>("");
  // rawTokens holds all tokens for the active category (unfiltered).
  // Provider filtering is applied synchronously via useMemo so switching
  // provider never triggers a loading spinner.
  const [rawTokens, setRawTokens] = useState<Token[]>([]);
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

  // Only fetches from DB/cache when the category changes — not when providerFilter changes.
  const loadTokens = useCallback(async (categoryId: string) => {
    setLoadingTokens(true);
    try {
      const raw = await tokenCacheRef.current.get(categoryId);
      setRawTokens(raw);
    } finally {
      setLoadingTokens(false);
    }
  }, []);

  useEffect(() => {
    if (activeCategoryId) void loadTokens(activeCategoryId);
  }, [activeCategoryId, loadTokens]);

  // Provider filter applied synchronously — no DB call, no loading flash.
  const tokens = useMemo(() => filterTokensForProvider(rawTokens, providerFilter), [rawTokens, providerFilter]);

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
      await tokenCacheRef.current.mutate(activeCategoryId, (prev) => [token, ...prev]);
      const next = await tokenCacheRef.current.get(activeCategoryId);
      setRawTokens(next);
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
    setRawTokens((prev) => prev.map((t) => t.id === token.id ? { ...t, is_favorite: next } : t));
    await tokenCacheRef.current.mutate(token.category_id, (prev) =>
      prev.map((current) => current.id === token.id ? { ...current, is_favorite: next } : current)
    );
    await toggleTokenFavorite(token.id, next);
  };

  const selectedSet = new Set(selectedTexts);
  const favoriteCount = tokens.filter((t) => t.is_favorite).length;
  const suppressedLower = suppressedText?.toLowerCase() ?? "";

  const visibleTokens = tokens.filter((t) => {
    if (favoritesOnly && !t.is_favorite) return false;
    if (search.trim() && !t.text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loadingCats) {
    return (
      <div className="flex items-center justify-center py-6">
        <span className="font-ndot text-[20px] text-readable">·</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Category tabs */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5 pb-0.5">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryChange(cat)}
              className={cn(
                "font-mono text-[10.5px] tracking-widest uppercase px-3 py-1.5 rounded-sm transition-precise whitespace-nowrap",
                activeCategoryId === cat.id ? "text-white" : "text-readable hover:text-cyan"
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
        {activeCategoryName && (
          <span className="font-mono text-[10px] leading-snug text-readable">
            {CATEGORY_HINTS[activeCategoryName] ?? "Reusable prompt tokens for this category."}
          </span>
        )}
      </div>

      {/* Search + favorites toggle + add custom */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-readable pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter tokens…"
            className="w-full h-9 pl-7 pr-2.5 font-mono text-[11px] text-soft-white placeholder:text-readable/60 bg-transparent rounded-sm focus:outline-none transition-precise"
            style={{ border: "var(--border-default)" }}
          />
        </div>
        {/* Favorites filter */}
        <button
          type="button"
          onClick={() => setFavoritesOnly((v) => !v)}
          className={cn(
            "h-9 px-3 rounded-sm font-mono text-[10px] tracking-widest uppercase transition-precise flex items-center gap-1.5",
            favoritesOnly ? "text-white" : "text-readable hover:text-cyan"
          )}
          style={{ border: favoritesOnly ? "var(--border-strong)" : "var(--border-dim)" }}
          title="Show favorites only"
        >
          <Star size={10} className={cn(favoritesOnly && "fill-white/50")} />
          {favoriteCount > 0 && !favoritesOnly && <span>{favoriteCount}</span>}
        </button>
        <button
          type="button"
          onClick={() => setAddingNew((v) => !v)}
          className={cn(
            "h-9 px-3 rounded-sm font-mono text-[10px] tracking-widest uppercase transition-precise flex items-center gap-1.5",
            addingNew ? "text-white" : "text-readable hover:text-cyan"
          )}
          style={{ border: addingNew ? "var(--border-strong)" : "var(--border-dim)" }}
          title="Add custom token"
        >
          <Plus size={10} />
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
            className="flex-1 h-8 px-2.5 font-mono text-[11px] text-soft-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none transition-precise"
            style={{ border: "var(--border-strong)" }}
          />
          <button
            type="button"
            onClick={handleAddCustomToken}
            disabled={savingNew || !newTokenText.trim()}
            className="h-8 px-3 font-mono text-[10px] tracking-widest uppercase text-white rounded-sm transition-precise disabled:opacity-40"
            style={{ border: "var(--border-strong)", background: "rgba(255,255,255,0.08)" }}
          >
            {savingNew ? "…" : "Add"}
          </button>
        </div>
      )}

      {/* Favorites-only empty state */}
      {favoritesOnly && favoriteCount === 0 && (
        <div className="flex items-center justify-center py-4">
          <span className="font-mono text-[10px] text-muted">No favorites yet. Hold star on any token to save it.</span>
        </div>
      )}

      {/* Token pills grid */}
      {loadingTokens ? (
        <div className="flex items-center justify-center py-4">
          <span className="font-mono text-[10px] text-muted">Loading...</span>
        </div>
      ) : !favoritesOnly && visibleTokens.length === 0 ? (
        <div className="flex items-center justify-center py-4">
          <span className="font-mono text-[10px] text-muted">
            {search ? "No matches." : "No tokens. Run in Tauri to load library."}
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
          {visibleTokens.map((token) => {
            const active = selectedSet.has(token.text);
            const isHighQuality = token.quality_score > 0.3;
            const isNegativeQuality = token.quality_score < -0.05;
            const isSuppressed = Boolean(suppressedLower && suppressedLower.includes(token.text.toLowerCase()));
            const qualityTitle = isHighQuality
              ? `Proven token — quality score ${token.quality_score.toFixed(2)}`
              : isNegativeQuality
              ? `Low-performing token — quality score ${token.quality_score.toFixed(2)}`
              : token.text;
            return (
              <div key={token.id} className="relative group/pill">
                <button
                  type="button"
                  onClick={() => onToggle(token)}
                  className={cn(
                    "inline-flex items-center font-mono text-[10px] tracking-wide px-2 py-1 rounded-sm transition-precise pr-5",
                    active ? "text-white" : isSuppressed ? "text-muted/45 hover:text-muted/70" : "text-readable hover:text-cyan"
                  )}
                  style={{
                    border: active
                      ? "var(--border-strong)"
                      : isSuppressed
                      ? "1px solid rgba(255,255,255,0.06)"
                      : isHighQuality
                      ? "1px solid rgba(255,255,255,0.18)"
                      : "var(--border-dim)",
                    background: active
                      ? "rgba(255,255,255,0.08)"
                      : isSuppressed
                      ? "rgba(255,255,255,0.015)"
                      : isHighQuality
                      ? "rgba(255,255,255,0.04)"
                      : "transparent",
                  }}
                  title={isSuppressed ? `${token.text} is reduced by project constraints or avoidance text.` : qualityTitle}
                >
                  {active && <span className="mr-1 text-cyan text-[10px]">✓</span>}
                  {isSuppressed && !active && <span className="mr-1 text-readable text-[10px]">-</span>}
                  {!active && !isSuppressed && isHighQuality && (
                    <span className="inline-block w-1 h-1 rounded-full bg-white/50 mr-1.5 shrink-0" />
                  )}
                  {!active && !isSuppressed && isNegativeQuality && (
                    <span className="inline-block w-1 h-1 rounded-full bg-red/50 mr-1.5 shrink-0" />
                  )}
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
                      : "opacity-0 group-hover/pill:opacity-100 text-readable hover:text-cyan"
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
