import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Star, Trash2, ChevronDown, Image, AlertTriangle, ExternalLink, Upload } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { getReferences, searchReferences, deleteReference, createReference } from "@/lib/references";
import { saveReferenceImage } from "@/lib/fileStore";
import { fileToDataUrl } from "@/lib/imageUtils";
import { useImageDisplaySrc } from "@/lib/useImageDisplaySrc";
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
      <span className="font-mono text-[9px] text-dim/50 uppercase tracking-widest">{label}</span>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="appearance-none pr-5 h-7 pl-2 font-mono text-[10px] text-dim bg-transparent focus:outline-none cursor-pointer">
          {options.map((o) => <option key={o.value} value={o.value} className="bg-panel text-white">{o.label}</option>)}
        </select>
        <ChevronDown size={8} className="absolute right-0.5 top-1/2 -translate-y-1/2 text-dim/40 pointer-events-none" />
      </div>
    </div>
  );
}

function StarRow({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={8} className={cn(i < value ? "text-white/60 fill-white/40" : "text-white/10")} />
      ))}
    </div>
  );
}

function Thumbnail({ src, title }: { src?: string; title: string }) {
  const resolved = useImageDisplaySrc(src);
  if (!resolved.src) {
    return (
      <div className="w-full aspect-video rounded-sm flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.04)" }}>
        <Image size={18} className="text-white/10" />
      </div>
    );
  }
  return (
    <img src={resolved.src} alt={title}
      onError={resolved.onError}
      className="w-full aspect-video object-cover rounded-sm"
      style={{ background: "rgba(255,255,255,0.04)" }} />
  );
}

function ReferenceCard({ ref: r, onDelete, onClick }: {
  ref: Reference;
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
      className="flex flex-col gap-0 rounded-card overflow-hidden group cursor-pointer transition-all duration-150 hover:ring-1 hover:ring-white/10"
      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
      onClick={() => onClick(r.id)}
    >
      {/* Thumbnail */}
      <div className="relative">
        <Thumbnail src={r.thumbnail_data ?? r.file_data} title={r.title} />
        {/* Kind badge */}
        <span className="absolute top-1.5 left-1.5 font-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm"
          style={{ background: "rgba(0,0,0,0.65)", color: "rgba(255,255,255,0.55)", backdropFilter: "blur(4px)" }}>
          {KIND_LABELS[r.kind]}
        </span>
        {/* Delete */}
        <button type="button"
          onClick={handleDelete}
          onBlur={() => setConfirmDelete(false)}
          className={cn(
            "absolute top-1.5 right-1.5 w-6 h-6 rounded-sm flex items-center justify-center",
            "opacity-0 group-hover:opacity-100 transition-precise",
            confirmDelete ? "text-red bg-red/20" : "text-white/40 hover:text-red"
          )}
          style={{ background: confirmDelete ? undefined : "rgba(0,0,0,0.5)" }}>
          <Trash2 size={9} />
        </button>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="font-sans text-[11px] text-soft-white font-medium leading-snug flex-1 min-w-0 truncate">
            {r.title}
          </span>
          <ExternalLink size={9} className="text-dim/20 group-hover:text-dim/50 transition-precise shrink-0 mt-0.5" />
        </div>

        {/* Tags */}
        {r.tags && r.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {r.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="font-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm text-dim/60"
                style={{ border: "var(--border-dim)" }}>
                {tag}
              </span>
            ))}
            {r.tags.length > 4 && (
              <span className="font-mono text-[8px] text-dim/40">+{r.tags.length - 4}</span>
            )}
          </div>
        )}

        {/* Best use */}
        {r.best_use && (
          <p className="font-mono text-[9px] text-dim/60 leading-relaxed line-clamp-2">{r.best_use}</p>
        )}

        {/* Risk note */}
        {r.risk_notes && (
          <div className="flex items-start gap-1">
            <AlertTriangle size={8} className="text-red/40 shrink-0 mt-0.5" />
            <p className="font-mono text-[8px] text-red/50 leading-relaxed line-clamp-1">{r.risk_notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1.5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <StarRow value={r.rating} />
          {r.provider && (
            <span className="font-mono text-[8px] text-dim/40 tracking-widest uppercase">{r.provider}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────

export function ReferenceLibrary() {
  const navigate = useNavigate();
  const [refs, setRefs] = useState<Reference[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [dropping, setDropping] = useState(false);
  const [dropImporting, setDropImporting] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const buildFilters = (): ReferenceFilters => {
    const f: ReferenceFilters = {};
    if (kindFilter !== "all") f.kind = kindFilter as ReferenceKind;
    if (ratingFilter === "rated") f.minRating = 1;
    if (ratingFilter === "3") f.minRating = 3;
    if (ratingFilter === "4") f.minRating = 4;
    return f;
  };

  const load = async () => {
    setLoading(true);
    try {
      const filters = buildFilters();
      const results = search.trim()
        ? await searchReferences(search.trim(), filters)
        : await getReferences(filters);

      if (ratingFilter === "unrated") {
        setRefs(results.filter((r) => r.rating === 0));
      } else {
        setRefs(results);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search, kindFilter, ratingFilter]);

  const handleDelete = async (id: string) => {
    await deleteReference(id);
    setRefs((prev) => prev.filter((r) => r.id !== id));
  };

  const handleDropFiles = async (files: FileList) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!imageFiles.length) return;
    setDropImporting(true);
    try {
      for (const file of imageFiles) {
        const refId = crypto.randomUUID().replace(/-/g, "");
        const dataUrl = await fileToDataUrl(file);
        const { filePath, thumbPath } = await saveReferenceImage(refId, dataUrl);
        const title = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
        const newId = await createReference({
          id: refId,
          title,
          kind: "image",
          file_data: filePath,
          thumbnail_data: thumbPath,
        });
        navigate(`/references/${newId}`);
        return; // navigate to first dropped file for confirmation
      }
    } finally {
      setDropImporting(false);
    }
  };

  return (
    <PageContainer
      title="References"
      subtitle="VISUAL REFERENCE LIBRARY"
      action={
        <Button variant="ghost" size="sm" onClick={() => navigate("/references/new")}>
          <Plus size={11} /> Add Reference
        </Button>
      }
    >
      {/* Toolbar */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, tags, notes…"
          className="h-7 px-3 font-mono text-[10px] text-soft-white placeholder:text-dim/40 bg-transparent rounded-sm focus:outline-none w-52"
          style={{ border: "var(--border-dim)" }}
        />

        <FilterSelect label="KIND" value={kindFilter} onChange={setKindFilter} options={KIND_OPTIONS} />
        <FilterSelect label="RATING" value={ratingFilter} onChange={setRatingFilter} options={RATING_OPTIONS} />

        <div className="flex-1" />
        <span className="font-mono text-[9px] text-dim/40">{refs.length} references</span>
      </div>

      {/* Drop zone */}
      <div
        ref={dropRef}
        onDragOver={(e) => { e.preventDefault(); setDropping(true); }}
        onDragLeave={(e) => { if (!dropRef.current?.contains(e.relatedTarget as Node)) setDropping(false); }}
        onDrop={(e) => { e.preventDefault(); setDropping(false); handleDropFiles(e.dataTransfer.files); }}
        className={cn(
          "flex items-center justify-center gap-3 h-12 rounded-card mb-4 transition-precise cursor-default",
          dropping
            ? "border-white/30 bg-white/5"
            : "border-white/8 hover:border-white/15"
        )}
        style={{ border: "2px dashed" }}
      >
        <Upload size={11} className={cn("shrink-0", dropping ? "text-white/60" : "text-dim/30")} />
        <span className={cn("font-mono text-[9px] tracking-widest uppercase", dropping ? "text-white/60" : "text-dim/30")}>
          {dropImporting ? "Importing…" : "Drop images to add as references"}
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <span className="font-mono text-[10px] text-dim/40">Loading…</span>
        </div>
      ) : refs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <span className="font-mono text-[11px] text-dim/40">
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
        <div className="grid grid-cols-3 gap-3">
          {refs.map((r) => (
            <ReferenceCard
              key={r.id}
              ref={r}
              onDelete={handleDelete}
              onClick={(id) => navigate(`/references/${id}`)}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
