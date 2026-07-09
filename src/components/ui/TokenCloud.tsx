import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, Search, Star, Flame, Trash2, AlertTriangle } from "lucide-react";
import { getTokenCategories, getTokensByCategory, createToken, toggleTokenFavorite, deleteToken } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { createTokenCategoryCache, filterTokensForProvider } from "@/lib/tokenCloudCache";
import { getRecurringTokens, type RecurringToken } from "@/lib/tokenPatterns";
import { createLatestRequestGuard } from "@/lib/latestRequest";
import { toast } from "@/lib/toast";
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
  character: "Who someone is: identity, role, and defining traits.",
  acting: "Performance quality and emotional delivery, not physical pose.",
  facial_expressions: "Precise facial cues that read intent and emotion.",
  body_language: "Posture and stance that communicate mood without motion.",
  body_movement: "How the body moves through the frame over time.",
  intentions: "The underlying goal or motivation driving the subject's action.",
  product_placement: "Where and how the product is positioned within the scene.",
  product_interaction: "Human contact with the product — touch, handling, and exchange.",
  products_in_environment: "How the product inhabits and relates to its surrounding world.",
  product_psychology: "The desire or emotional trigger the product is designed to evoke.",
  product_semiotics: "The symbolic meaning and cultural signals the product carries.",
  direction: "The overarching creative instruction guiding how the shot should feel.",
  directors_vision: "The singular creative point of view shaping every choice in the frame.",
  craft: "Technical mastery and intentional artistry in how the image is executed.",
  framing_intention: "Why the frame is composed this way — the purpose behind the crop.",
  contrast_relationship: "How opposing visual elements play off each other for impact.",
  chromatic_contrast: "Color relationships that create visual tension or harmony.",
  storytelling: "Narrative structure and story beats that imply a before and after.",
  casting_style: "How talent is selected and assembled for the shot.",
  wardrobe: "The garments and outfit worn in the shot.",
  designer_influence: "The design-house aesthetic or craft tradition the styling nods to.",
  accessories: "Jewelry, bags, eyewear, and other worn or carried details.",
  weather: "Atmospheric conditions in the scene.",
  time_of_day: "When the scene is set, independent of lighting quality.",
};

// Hold a token pill for this long to delete it — long enough to rule out an
// accidental hold, no second button needed next to the favorite star.
const DELETE_HOLD_MS = 3000;

interface TokenCloudProps {
  selectedTexts: string[];
  /** categoryName is the internal category name (e.g. "camera") so pickers can route the token into its matching prompt field. */
  onToggle: (token: Token, categoryName?: string) => void;
  providerFilter?: string;
  suppressedText?: string;
}

export function TokenCloud({ selectedTexts, onToggle, providerFilter, suppressedText }: TokenCloudProps) {
  // maxEntries raised from the original 24 so cycling through all ~33
  // categories (15 original + 18 added for the character/product/direction/
  // storytelling groups) doesn't evict and re-fetch already-visited tabs.
  const tokenCacheRef = useRef(createTokenCategoryCache(getTokensByCategory, { maxEntries: 36 }));
  const loadGuardRef = useRef(createLatestRequestGuard());
  const recurringGuardRef = useRef(createLatestRequestGuard());
  // Long-press-to-delete — holding a pill for DELETE_HOLD_MS opens a confirm
  // modal for that exact token; releasing early is a normal toggle click.
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const [pressingTokenId, setPressingTokenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Token | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [categories, setCategories] = useState<TokenCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeCategoryName, setActiveCategoryName] = useState<string>("");
  // rawTokens holds all tokens for the active category (unfiltered).
  // Provider filtering is applied synchronously via useMemo so switching
  // provider never triggers a loading spinner.
  const [rawTokens, setRawTokens] = useState<Token[]>([]);
  const [recurringTokens, setRecurringTokens] = useState<RecurringToken[]>([]);
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
      .catch(() => toast.error("Could not load token categories"))
      .finally(() => setLoadingCats(false));
  }, []);

  // Only fetches from DB/cache when the category changes — not when providerFilter changes.
  const loadTokens = useCallback(async (categoryId: string) => {
    const request = loadGuardRef.current.begin();
    setLoadingTokens(true);
    try {
      const raw = await tokenCacheRef.current.get(categoryId);
      if (loadGuardRef.current.isCurrent(request)) setRawTokens(raw);
    } catch {
      if (loadGuardRef.current.isCurrent(request)) toast.error("Could not load tokens");
    } finally {
      if (loadGuardRef.current.isCurrent(request)) setLoadingTokens(false);
    }
  }, []);

  useEffect(() => {
    if (activeCategoryId) void loadTokens(activeCategoryId);
  }, [activeCategoryId, loadTokens]);

  // Recurring tokens are scoped strictly to the active category — never a
  // library-wide list — so switching tabs never leaks another category's
  // suggestions into view.
  useEffect(() => {
    if (!activeCategoryId) { setRecurringTokens([]); return; }
    const request = recurringGuardRef.current.begin();
    getRecurringTokens(activeCategoryId)
      .then((rows) => { if (recurringGuardRef.current.isCurrent(request)) setRecurringTokens(rows); })
      .catch(() => { if (recurringGuardRef.current.isCurrent(request)) setRecurringTokens([]); });
  }, [activeCategoryId]);

  useEffect(() => () => {
    loadGuardRef.current.invalidate();
    recurringGuardRef.current.invalidate();
    if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current);
  }, []);

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
      onToggle(token, activeCategoryName);
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
    try {
      await toggleTokenFavorite(token.id, next);
    } catch {
      setRawTokens((prev) => prev.map((t) => t.id === token.id ? { ...t, is_favorite: token.is_favorite } : t));
      await tokenCacheRef.current.mutate(token.category_id, (prev) =>
        prev.map((current) => current.id === token.id ? { ...current, is_favorite: token.is_favorite } : current)
      );
      toast.error("Could not update favorite");
    }
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setPressingTokenId(null);
  };

  const handlePillMouseDown = (token: Token) => {
    longPressFiredRef.current = false;
    setPressingTokenId(token.id);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      longPressTimerRef.current = null;
      setPressingTokenId(null);
      setDeleteTarget(token);
    }, DELETE_HOLD_MS);
  };

  const handlePillClick = (token: Token) => {
    // A completed long-press already opened the confirm modal — suppress
    // the toggle-add-to-sequence click that follows mouseup.
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    onToggle(token, activeCategoryName);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteToken(deleteTarget.id);
      setRawTokens((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      await tokenCacheRef.current.mutate(deleteTarget.category_id, (prev) =>
        prev.filter((t) => t.id !== deleteTarget.id)
      );
      setRecurringTokens((prev) => prev.filter((r) => r.token_id !== deleteTarget.id));
      toast.success(`Deleted "${deleteTarget.text}"`);
      setDeleteTarget(null);
    } catch {
      toast.error("Could not delete token");
    } finally {
      setDeleting(false);
    }
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
          <span className="block text-center font-mono text-[10px] leading-snug text-cyan/80">
            {CATEGORY_HINTS[activeCategoryName] ?? "Reusable prompt tokens for this category."}
          </span>
        )}
      </div>

      {/* Recurring in this category — high frequency across the library, incl.
          imported prompts that never went through result scoring, so it's a
          separate signal from the quality_score dot shown on token pills. */}
      {recurringTokens.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-amber/60">
            <Flame size={9} /> Recurring in {activeCategoryName.replace(/_/g, " ")}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {recurringTokens.map((r) => {
              const token = tokens.find((t) => t.id === r.token_id);
              if (!token) return null;
              const active = selectedSet.has(token.text);
              return (
                <button
                  key={r.token_id}
                  type="button"
                  onClick={() => onToggle(token, activeCategoryName)}
                  disabled={active}
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-1 rounded-sm font-mono text-[10px] transition-precise",
                    active ? "text-white/40" : "text-amber hover:text-white"
                  )}
                  style={{ border: "1px solid rgba(246,173,85,0.28)", background: "rgba(246,173,85,0.05)" }}
                  title={`Used in ${r.recurrence_count} of your prompts`}
                >
                  {!active && <Plus size={8} />} {r.text}
                  <span className="text-white/30">×{r.recurrence_count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Star + add custom on the left, compact search on the right — one aligned line (V2 §8) */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Favorites filter */}
        <button
          type="button"
          onClick={() => setFavoritesOnly((v) => !v)}
          className={cn(
            "h-9 px-3 rounded-sm font-mono text-[10px] tracking-widest uppercase transition-precise flex items-center gap-1.5",
            favoritesOnly ? "text-amber" : "text-readable hover:text-cyan"
          )}
          style={{ border: favoritesOnly ? "1px solid rgba(246,173,85,0.45)" : "var(--border-dim)" }}
          title="Show favorites only"
        >
          <Star size={10} className={cn(favoritesOnly && "fill-amber/40 text-amber")} />
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
        <div className="relative ml-auto w-44">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-readable pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter…"
            className="w-full h-8 pl-7 pr-2.5 font-mono text-[11px] text-soft-white placeholder:text-readable/60 bg-transparent rounded-sm focus:outline-none transition-precise"
            style={{ border: "var(--border-default)" }}
          />
        </div>
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
            className="flex-1 h-8 px-2.5 font-mono text-[12px] text-soft-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none transition-precise"
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
        <div className="flex flex-wrap gap-1.5 max-h-96 overflow-y-auto">
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
                  onClick={() => handlePillClick(token)}
                  onMouseDown={() => handlePillMouseDown(token)}
                  onMouseUp={clearLongPress}
                  onMouseLeave={clearLongPress}
                  className={cn(
                    "relative inline-flex items-center font-mono text-[11px] tracking-wide px-2 py-1 rounded-sm transition-precise pr-5 overflow-hidden",
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
                  title={isSuppressed ? `${token.text} is reduced by project constraints or avoidance text.` : `${qualityTitle} — hold to delete`}
                >
                  {/* Fills over DELETE_HOLD_MS while pressed; releasing early
                      (below) resets it instantly via clearLongPress. */}
                  {pressingTokenId === token.id && (
                    <span
                      className="absolute inset-0 bg-red/25 origin-left"
                      style={{ animation: `token-hold-fill ${DELETE_HOLD_MS}ms linear forwards` }}
                    />
                  )}
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
                      ? "opacity-100 text-amber"
                      : "opacity-0 group-hover/pill:opacity-100 text-readable hover:text-amber"
                  )}
                  title={token.is_favorite ? "Remove from favorites" : "Add to favorites"}
                >
                  <Star size={7} className={cn(token.is_favorite && "fill-amber/50")} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete-token confirm — reachable only via a 3s hold on a pill above.
          Deletes exactly this one token; never the category. */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5">
          <button type="button" className="absolute inset-0 cursor-default" onClick={() => setDeleteTarget(null)} aria-label="Close" />
          <div
            className="relative z-10 w-full max-w-[380px] flex flex-col gap-4 p-6 rounded-card"
            style={{ border: "1px solid rgba(215,25,33,0.3)", background: "#121212" }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-red/70" />
              <span className="system-label text-white">Delete Token</span>
            </div>
            <p className="font-mono text-[12px] text-readable leading-relaxed">
              Permanently delete "<span className="text-soft-white">{deleteTarget.text}</span>" from the library? This can't be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleConfirmDelete} disabled={deleting}>
                <Trash2 size={11} /> {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
