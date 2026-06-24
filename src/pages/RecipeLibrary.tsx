import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Plus, Star, Trash2, ChevronRight, Layers } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { usePromptStore } from "@/stores/usePromptStore";
import { cn } from "@/lib/utils";
import type { Prompt } from "@/types";

// ─── Recipe Card ──────────────────────────────────────────────

function RecipeCard({ recipe, onCopy, onDelete, onOpen }: {
  recipe: Prompt;
  onCopy: (r: Prompt) => void;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(recipe.prompt_text ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    onCopy(recipe);
  };
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(recipe.id);
  };

  const tags = recipe.tags ?? [];
  const providerLabel = recipe.provider ?? "midjourney";

  return (
    <div
      onClick={() => onOpen(recipe.id)}
      className="flex flex-col gap-3 p-4 rounded-card cursor-pointer group transition-precise hover:border-white/20"
      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Layers size={9} className="text-dim/50 shrink-0" />
            <span className="font-sans text-[13px] text-white font-medium truncate">{recipe.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[8px] tracking-widest uppercase text-dim/50">{providerLabel}</span>
            {recipe.category && (
              <span className="font-mono text-[8px] tracking-widest uppercase text-dim/40">· {recipe.category}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {recipe.rating > 0 && (
            <div className="flex items-center gap-0.5">
              {Array.from({ length: recipe.rating }).map((_, i) => (
                <Star key={i} size={8} className="text-white/40 fill-white/30" />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Prompt text preview */}
      {recipe.prompt_text && (
        <p className="font-mono text-[9px] text-dim/60 leading-relaxed line-clamp-3">
          {recipe.prompt_text}
        </p>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 4).map((tag) => (
            <span key={tag}
              className="font-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm text-dim/50"
              style={{ border: "var(--border-dim)" }}>
              {tag}
            </span>
          ))}
          {tags.length > 4 && (
            <span className="font-mono text-[8px] text-dim/30">+{tags.length - 4}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t opacity-0 group-hover:opacity-100 transition-precise"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <button type="button" onClick={handleCopy}
          className="flex items-center gap-1.5 font-mono text-[9px] tracking-widest uppercase text-dim hover:text-white px-2 py-1 rounded-sm transition-precise"
          style={{ border: "var(--border-dim)" }}>
          <Copy size={8} />{copied ? "Copied!" : "Copy prompt"}
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(recipe.id); }}
            className="flex items-center gap-1 font-mono text-[9px] text-dim hover:text-white transition-precise">
            Use <ChevronRight size={9} />
          </button>
          <button type="button" onClick={handleDelete}
            className="text-dim/30 hover:text-red/60 transition-precise">
            <Trash2 size={10} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

type SortOption = "recent" | "rating" | "alpha";

export function RecipeLibrary() {
  const navigate = useNavigate();
  const { prompts, fetchPrompts, remove } = usePromptStore();
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [sort, setSort] = useState<SortOption>("recent");

  useEffect(() => { fetchPrompts(); }, [fetchPrompts]);

  const recipes = prompts.filter((p) => p.is_recipe);

  const filtered = recipes
    .filter((r) => {
      if (search && !r.title.toLowerCase().includes(search.toLowerCase()) && !(r.prompt_text ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      if (providerFilter && r.provider !== providerFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "rating") return b.rating - a.rating;
      if (sort === "alpha") return a.title.localeCompare(b.title);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const providers = [...new Set(recipes.map((r) => r.provider).filter(Boolean))];

  const handleCopy = (recipe: Prompt) => {
    // Launched from recipe — navigate to craft with this prompt pre-loaded
    navigate(`/craft/${recipe.id}`);
  };

  const handleDelete = async (id: string) => {
    await remove(id);
  };

  const handleOpen = (id: string) => {
    navigate(`/library/${id}`);
  };

  return (
    <PageContainer
      title="Recipes"
      subtitle="REUSABLE PROMPT STRUCTURES"
      action={
        <Button variant="ghost" size="sm" onClick={() => navigate("/craft")}>
          <Plus size={11} /> New Recipe
        </Button>
      }
    >
      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search recipes…"
          className="h-7 px-3 font-mono text-[10px] text-soft-white placeholder:text-dim/40 bg-transparent rounded-sm focus:outline-none w-44"
          style={{ border: "var(--border-dim)" }} />

        {providers.length > 1 && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setProviderFilter("")}
              className={cn("font-mono text-[8px] tracking-widest uppercase px-2 py-1 rounded-sm transition-precise",
                !providerFilter ? "text-white" : "text-dim hover:text-muted")}
              style={{ border: !providerFilter ? "var(--border-strong)" : "var(--border-dim)" }}>
              All
            </button>
            {providers.map((p) => (
              <button key={p} type="button" onClick={() => setProviderFilter(p === providerFilter ? "" : p!)}
                className={cn("font-mono text-[8px] tracking-widest uppercase px-2 py-1 rounded-sm transition-precise",
                  providerFilter === p ? "text-white" : "text-dim hover:text-muted")}
                style={{ border: providerFilter === p ? "var(--border-strong)" : "var(--border-dim)" }}>
                {p}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1" />

        {/* Sort */}
        <div className="flex items-center gap-1">
          {(["recent", "rating", "alpha"] as SortOption[]).map((s) => (
            <button key={s} type="button" onClick={() => setSort(s)}
              className={cn("font-mono text-[8px] tracking-widest uppercase px-2 py-1 rounded-sm transition-precise",
                sort === s ? "text-white" : "text-dim hover:text-muted")}
              style={{ border: sort === s ? "var(--border-strong)" : "var(--border-dim)" }}>
              {s}
            </button>
          ))}
        </div>

        <span className="font-mono text-[9px] text-dim/40">
          {filtered.length === recipes.length ? recipes.length : `${filtered.length}/${recipes.length}`}
        </span>
      </div>

      {/* Content */}
      {recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 h-48">
          <Layers size={24} className="text-dim/20" />
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono text-[11px] text-dim/50">No recipes yet.</span>
            <span className="font-mono text-[9px] text-dim/30">Save any prompt as a Recipe to build your reusable library.</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/craft")}>
            <Plus size={10} /> Build your first recipe
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <span className="font-mono text-[10px] text-dim/40">No recipes match your filters.</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onCopy={handleCopy}
              onDelete={handleDelete}
              onOpen={handleOpen}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
