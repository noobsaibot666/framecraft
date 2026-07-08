import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Star, Trash2, ChevronDown, Image, AlertTriangle, ExternalLink, Upload, Trophy } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { getReferenceSummaries, searchReferenceSummaries, getReferenceThumbnailMap, deleteReference } from "@/lib/references";
import { getHighImpactReferences } from "@/lib/referenceImpact";
import { fileToDataUrl, validateMediaFile } from "@/lib/imageUtils";
import { importReferenceImage } from "@/lib/sharedImport";
import { useImageDisplaySrc } from "@/lib/useImageDisplaySrc";
import { getPreferences } from "@/lib/userPreferences";
import { cn } from "@/lib/utils";
import type { Reference, ReferenceKind, ReferenceFilters } from "@/types";

// ─── Kind label map ───────────────────────────────────────────

const KIND_LABELS: Record<ReferenceKind, string> = {
  image: "Image",
  frame: "Frame",
  result: "Result",
  source: "Source",
  mood: "Mood",
  product: "Product",
  style: "Style",
};

const KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All kinds" },
  ...Object.entries(KIND_LABELS).map(([v, l]) => ({ value: v, label: l })),
];

const RATING_OPTIONS = [
  { value: "all", label: "Any rating" },
  { value: "rated", label: "Rated" },
  { value: "unrated", label: "Unrated" },
  { value: "3", label: "3+ stars" },
  { value: "4", label: "4+ stars" },
];

// ─── Sub-components ───────────────────────────────────────────

function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] text-muted uppercase tracking-widest">{label}</span>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="appearance-none pr-7 h-9 pl-3 font-mono text-[10.5px] text-readable bg-transparent focus:outline-none cursor-pointer rounded-sm"
          style={{ border: "var(--border-default)" }}>
          {options.map((o) => <option key={o.value} value={o.value} className="bg-panel text-white">{o.label}</option>)}
        </select>
        <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
      </div>
    </div>
  );
}

function StarRow({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={10} className={cn(i < value ? "text-amber fill-amber/45" : "text-white/16")} />
      ))}
    </div>
  );
}

function Thumbnail({ src, title }: { src?: string; title: string }) {
  const resolved = useImageDisplaySrc(src);
  if (!resolved.src) {
    return (
      <div className="w-full aspect-[4/3] rounded-sm flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.04)" }}>
        <Image size={22} className="text-white/16" />
      </div>
    );
  }
  return (
    <img src={resolved.src} alt={title}
      onError={resolved.onError}
      loading="lazy"
      decoding="async"
      className="w-full aspect-[4/3] object-cover rounded-sm"
      style={{ background: "rgba(255,255,255,0.04)" }} />
  );
}

function ReferenceCard({ ref: r, thumb, wins, onDelete, onClick }: {
  ref: Reference;
  thumb?: string;
  wins: number;
  onDelete: (id: string) => void;
  onClick: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) { setConfirmDelete(true); return; }
    onDelete(r.id);
  };

  return (
    <div
      className="flex flex-col gap-0 rounded-card overflow-hidden group cursor-pointer transition-all duration-150 hover:ring-1 hover:ring-cyan/35"
      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
      onClick={() => onClick(r.id)}
    >
      {/* Thumbnail */}
      <div className="relative">
        <Thumbnail src={thumb} title={r.title} />
        {/* Kind badge */}
        <span className="absolute top-2 left-2 font-mono text-[9px] tracking-widest uppercase px-2 py-1 rounded-sm"
          style={{ background: "rgba(0,0,0,0.68)", color: "rgba(244,244,240,0.9)", backdropFilter: "blur(4px)" }}>
          {KIND_LABELS[r.kind]}
        </span>
        {/* Delete */}
        <button type="button"
          onClick={handleDelete}
          onBlur={() => setConfirmDelete(false)}
          className={cn(
            "absolute top-2 right-2 w-7 h-7 rounded-sm flex items-center justify-center",
            "opacity-0 group-hover:opacity-100 transition-precise",
            confirmDelete ? "text-red bg-red/20" : "text-white/40 hover:text-red"
          )}
          style={{ background: confirmDelete ? undefined : "rgba(0,0,0,0.5)" }}>
          <Trash2 size={11} />
        </button>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="font-sans text-[15px] text-soft-white font-semibold leading-snug flex-1 min-w-0 truncate">
            {r.title}
          </span>
          <ExternalLink size={11} className="text-muted group-hover:text-cyan transition-precise shrink-0 mt-0.5" />
        </div>

        {/* Tags */}
        {r.tags && r.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {r.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="font-mono text-[9px] tracking-widest uppercase px-2 py-1 rounded-sm text-muted"
                style={{ border: "var(--border-dim)" }}>
                {tag}
              </span>
            ))}
            {r.tags.length > 4 && (
              <span className="font-mono text-[9px] text-muted">+{r.tags.length - 4}</span>
            )}
          </div>
        )}

        {/* Best use */}
        {r.best_use && (
          <p className="font-mono text-[12px] text-readable leading-relaxed line-clamp-2">{r.best_use}</p>
        )}

        {/* Risk note */}
        {r.risk_notes && (
          <div className="flex items-start gap-1">
            <AlertTriangle size={10} className="text-red/70 shrink-0 mt-0.5" />
            <p className="font-mono text-[10px] text-red/80 leading-relaxed line-clamp-1">{r.risk_notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1.5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          <StarRow value={r.rating} />
          <div className="flex items-center gap-2">
            {wins > 0 && (
              <span className="flex items-center gap-0.5 font-mono text-[9px] text-amber">
                <Trophy size={8} /> {wins}
              </span>
            )}
            {r.provider && (
              <span className="font-mono text-[9px] text-readable tracking-widest uppercase">{r.provider}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────

export function ReferenceLibrary() {
  const navigate = useNavigate();
  const PAGE_SIZE = getPreferences().libraryPageSize;
  const [refs, setRefs] = useState<Reference[]>([]);
  const [loading, setLoading] = useState(true);
  const [impactMap, setImpactMap] = useState<Map<string, number>>(new Map());
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [dropping, setDropping] = useState(false);
  const [dropImporting, setDropImporting] = useState(false);
  const [dropError, setDropError] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Thumbnail (thumbnail_data, falling back to file_data) for cards actually
  // on screen — fetched in small batches, never for the whole library (see
  // getReferenceThumbnailMap).
  const [thumbMap, setThumbMap] = useState<Record<string, string>>({});
  const dropRef = useRef<HTMLDivElement>(null);

  const buildFilters = (): ReferenceFilters => {
    const f: ReferenceFilters = {};
    if (kindFilter !== "all") f.kind = kindFilter as ReferenceKind;
    if (ratingFilter === "rated") f.minRating = 1;
    if (ratingFilter === "3") f.minRating = 3;
    if (ratingFilter === "4") f.minRating = 4;
    return f;
  };

  const load = async (q: string) => {
    setLoading(true);
    try {
      const filters = buildFilters();
      const results = q.trim()
        ? await searchReferenceSummaries(q.trim(), filters)
        : await getReferenceSummaries(filters);

      const filtered = ratingFilter === "unrated" ? results.filter((r) => r.rating === 0) : results;
      setRefs(filtered);
      setVisibleCount(PAGE_SIZE);

      getHighImpactReferences(500).then((scores) => {
        setImpactMap(new Map(scores.map((s) => [s.id, s.result_win_count + s.project_winner_count])));
      }).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  // Debounced — search used to fire a full unindexed scan on every keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => load(search), search ? 300 : 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, kindFilter, ratingFilter]);

  const visibleRefs = refs.slice(0, visibleCount);
  const hasMoreVisible = visibleCount < refs.length;

  const missingThumbIds = useMemo(
    () => visibleRefs.filter((r) => !thumbMap[r.id]).map((r) => r.id),
    [visibleRefs, thumbMap]
  );
  const missingThumbKey = missingThumbIds.join(",");
  useEffect(() => {
    if (!missingThumbIds.length) return;
    getReferenceThumbnailMap(missingThumbIds).then((map) => {
      if (Object.keys(map).length) setThumbMap((prev) => ({ ...prev, ...map }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingThumbKey]);

  const handleDelete = async (id: string) => {
    await deleteReference(id);
    setRefs((prev) => prev.filter((r) => r.id !== id));
  };

  const handleDropFiles = async (files: FileList) => {
    const mediaFiles = Array.from(files).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (!mediaFiles.length) return;
    setDropImporting(true);
    setDropError("");
    try {
      for (const file of mediaFiles) {
        await validateMediaFile(file);
        const refId = crypto.randomUUID().replace(/-/g, "");
        const dataUrl = await fileToDataUrl(file);
        const title = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
        const result = await importReferenceImage({
          referenceId: refId,
          dataUrl,
          originalName: file.name,
          reference: {
            title,
            kind: "image",
          },
        });
        if (!result.queued) navigate(`/references/${result.id}`);
        else await load(search);
        return; // navigate to first dropped file for confirmation
      }
    } catch (error) {
      setDropError(String(error));
    } finally {
      setDropImporting(false);
    }
  };

  return (
    <PageContainer
      title="References"
      subtitle="VISUAL REFERENCE LIBRARY"
      action={
        <Button variant="primary" size="md" onClick={() => navigate("/references/new")}>
          <Plus size={11} /> Add Reference
        </Button>
      }
    >
      {/* Toolbar */}
      <div className="flex items-center gap-4 mb-7 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, tags, notes…"
          className="h-10 px-3 font-mono text-[13px] text-soft-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none w-72"
          style={{ border: "var(--border-default)" }}
        />

        <FilterSelect label="KIND" value={kindFilter} onChange={setKindFilter} options={KIND_OPTIONS} />
        <FilterSelect label="RATING" value={ratingFilter} onChange={setRatingFilter} options={RATING_OPTIONS} />

        <div className="flex-1" />
        <span className="font-mono text-[12px] text-readable">{refs.length} references</span>
      </div>

      {/* Drop zone */}
      <div
        ref={dropRef}
        onDragOver={(e) => { e.preventDefault(); setDropping(true); }}
        onDragLeave={(e) => { if (!dropRef.current?.contains(e.relatedTarget as Node)) setDropping(false); }}
        onDrop={(e) => { e.preventDefault(); setDropping(false); handleDropFiles(e.dataTransfer.files); }}
        className={cn(
          "flex items-center justify-center gap-3 h-16 rounded-card mb-6 transition-precise cursor-default",
          dropping
            ? "border-cyan/55 bg-cyan/8"
            : "border-white/28 hover:border-cyan/45"
        )}
        style={{ border: "2px dashed", background: dropping ? undefined : "rgba(255,255,255,0.035)" }}
      >
        <Upload size={14} className={cn("shrink-0", dropping ? "text-cyan" : "text-muted")} />
        <span className={cn("font-mono text-[12px] tracking-widest uppercase", dropping ? "text-cyan" : "text-readable")}>
          {dropImporting ? "Importing..." : "Drop images or videos to add as references"}
        </span>
      </div>
      {dropError && <p className="font-mono text-[10px] text-red/80 mb-4">{dropError}</p>}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <span className="font-mono text-[12px] text-muted">Loading...</span>
        </div>
      ) : refs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <span className="font-mono text-[13px] text-readable">
            {search || kindFilter !== "all" || ratingFilter !== "all"
              ? "No references match your filters."
              : "No references yet."}
          </span>
          {!search && kindFilter === "all" && ratingFilter === "all" && (
            <Button variant="ghost" size="sm" onClick={() => navigate("/references/new")}>
              <Plus size={10} /> Add your first reference
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {visibleRefs.map((r) => (
              <ReferenceCard
                key={r.id}
                ref={r}
                thumb={thumbMap[r.id]}
                wins={impactMap.get(r.id) ?? 0}
                onDelete={handleDelete}
                onClick={(id) => navigate(`/references/${id}`)}
              />
            ))}
          </div>
          {hasMoreVisible && (
            <Button variant="ghost" size="sm" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="self-center">
              Load more ({refs.length - visibleCount} remaining)
            </Button>
          )}
        </div>
      )}
    </PageContainer>
  );
}
