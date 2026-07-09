import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Trash2, Star, AlertTriangle, Upload, Link2, ChevronDown, Check, Trophy } from "lucide-react";
import { saveReferenceImage, thumbnailFromDataUrl, isVideoPath } from "@/lib/fileStore";
import { useImageDisplaySrc } from "@/lib/useImageDisplaySrc";
import { fileToDataUrl } from "@/lib/imageUtils";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import {
  getReferenceById,
  createReference,
  updateReference,
  deleteReference,
  getPromptsForReference,
  getResultsForReference,
  type CreateReferenceInput,
} from "@/lib/references";
import { getReferenceImpactScore } from "@/lib/referenceImpact";
import { cn } from "@/lib/utils";
import type { Reference, ReferenceKind, ReferenceRole } from "@/types";

// ─── Constants ────────────────────────────────────────────────

const KIND_OPTIONS: { value: ReferenceKind; label: string }[] = [
  { value: "image",   label: "Image" },
  { value: "frame",   label: "Frame" },
  { value: "result",  label: "Result" },
  { value: "source",  label: "Source" },
  { value: "mood",    label: "Mood" },
  { value: "product", label: "Product" },
  { value: "style",   label: "Style" },
];

const CATEGORY_OPTIONS = [
  "advertising", "editorial", "product", "fashion", "automotive",
  "architecture", "portrait", "cinematic", "abstract", "other",
];

const PROVIDER_OPTIONS = [
  "midjourney", "dalle", "stable_diffusion", "firefly", "ideogram", "flux",
  "nano_banana", "gpt_image", "seedance", "kling", "runway", "higgsfield", "other",
];

const ROLE_LABELS: Record<ReferenceRole, string> = {
  style: "Style",
  composition: "Composition",
  lighting: "Lighting",
  product: "Product",
  character: "Character",
  frame: "Frame",
  "failure-example": "Failure Example",
};

// ─── Sub-components ───────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="system-label text-[12px] text-muted">{children}</label>;
}

function FieldInput({ value, onChange, placeholder, mono = false }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "h-10 px-3 text-[14px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none w-full",
        mono ? "font-mono" : "font-sans"
      )}
      style={{ border: "1px solid rgba(255,255,255,0.16)" }}
    />
  );
}

function FieldTextarea({ value, onChange, placeholder, rows = 3 }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="px-3 py-2.5 font-mono text-[13px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none w-full resize-none"
      style={{ border: "1px solid rgba(255,255,255,0.16)" }}
    />
  );
}

function FieldSelect({ value, onChange, options, empty = "— select —" }: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  empty?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none h-10 pl-3 pr-7 font-mono text-[13px] text-white bg-transparent rounded-sm focus:outline-none w-full cursor-pointer"
        style={{ border: "1px solid rgba(255,255,255,0.16)" }}>
        <option value="" className="bg-panel text-dim/50">{empty}</option>
        {options.map((o) => <option key={o} value={o} className="bg-panel text-white">{o}</option>)}
      </select>
      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
    </div>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <button key={i} type="button" onClick={() => onChange(i + 1 === value ? 0 : i + 1)}
          className="transition-precise p-0.5">
          <Star size={16} className={cn(i < value ? "text-amber fill-amber/45" : "text-white/18 hover:text-amber/70")} />
        </button>
      ))}
    </div>
  );
}

function ImageDropZone({ src, onFile }: {
  src?: string;
  onFile: (dataUrl: string, thumb: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const image = useImageDisplaySrc(src);
  const [dragging, setDragging] = useState(false);

  const processFile = async (file: File) => {
    const full = await fileToDataUrl(file);
    const thumb = await thumbnailFromDataUrl(full, 400);
    onFile(full, thumb);
  };

  const isVideoSrc = isVideoPath(src);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith("image/") || file.type.startsWith("video/"))) processFile(file);
  };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center rounded-card overflow-hidden aspect-video",
        "border-2 border-dashed transition-precise",
        dragging ? "border-cyan/60" : "border-white/28 hover:border-white/45"
      )}
      style={{ background: dragging ? "rgba(56,183,200,0.06)" : "rgba(255,255,255,0.04)" }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      {image.src ? (
        <>
          {isVideoSrc
            ? <video src={image.src} muted playsInline controls className="w-full h-full object-contain" />
            : <img src={image.src} alt="reference" className="w-full h-full object-contain" onError={image.onError} />}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            style={{ background: "rgba(0,0,0,0.6)" }}>
            <span className="font-mono text-[12px] text-white tracking-widest uppercase">Replace {isVideoSrc ? "video" : "image"}</span>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 cursor-pointer">
          <Upload size={24} className="text-muted" />
          <span className="font-mono text-[12px] text-readable tracking-widest uppercase">Drop image or video, or click</span>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*,video/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
    </div>
  );
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");
  const commit = (raw: string) => {
    const parts = raw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    onChange([...new Set([...tags, ...parts])]);
    setInput("");
  };
  return (
    <div className="flex flex-wrap gap-1.5 p-2 rounded-sm min-h-9"
      style={{ border: "1px solid rgba(255,255,255,0.10)", background: "var(--color-dark)" }}>
      {tags.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 font-mono text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded border border-white/10 text-dim">
          {tag}
          <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))} className="text-dim/50 hover:text-red leading-none">×</button>
        </span>
      ))}
      <input value={input} onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); if (input.trim()) commit(input); }
          else if (e.key === "Backspace" && !input && tags.length) onChange(tags.slice(0, -1));
        }}
        onBlur={() => { if (input.trim()) commit(input); }}
        placeholder={tags.length ? "" : "Type tag + Enter…"}
        className="flex-1 min-w-16 bg-transparent font-mono text-[10px] text-soft-white placeholder:text-dim/40 outline-none" />
    </div>
  );
}

function LinkedSection({ title, items }: {
  title: string;
  items: { id: string; label: string; role: ReferenceRole }[];
}) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Link2 size={11} className="text-cyan" />
        <span className="system-label">{title}</span>
        <span className="font-mono text-[10px] text-muted">({items.length})</span>
      </div>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between px-3 py-2.5 rounded-sm"
            style={{ background: "rgba(255,255,255,0.045)", border: "var(--border-default)" }}>
            <span className="font-sans text-[13px] text-readable truncate">{item.label}</span>
            <span className="font-mono text-[9px] text-muted tracking-widest uppercase ml-2 shrink-0">
              {ROLE_LABELS[item.role]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export function ReferenceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<ReferenceKind>("image");
  const [provider, setProvider] = useState("");
  const [category, setCategory] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [rating, setRating] = useState(0);
  const [bestUse, setBestUse] = useState("");
  const [riskNotes, setRiskNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [fileData, setFileData] = useState<string | undefined>();
  const [thumbData, setThumbData] = useState<string | undefined>();
  const [pendingDataUrl, setPendingDataUrl] = useState<string | undefined>();

  const [impactScore, setImpactScore] = useState(0);

  // Linked items
  const [linkedPrompts, setLinkedPrompts] = useState<{ id: string; label: string; role: ReferenceRole }[]>([]);
  const [linkedResults, setLinkedResults] = useState<{ id: string; label: string; role: ReferenceRole }[]>([]);

  useEffect(() => {
    if (isNew || !id) return;
    (async () => {
      setLoading(true);
      const [ref, prompts, results, impact] = await Promise.all([
        getReferenceById(id),
        getPromptsForReference(id),
        getResultsForReference(id),
        getReferenceImpactScore(id),
      ]);
      if (!ref) { navigate("/references"); return; }

      setImpactScore(impact);
      setTitle(ref.title);
      setDescription(ref.description ?? "");
      setKind(ref.kind);
      setProvider(ref.provider ?? "");
      setCategory(ref.category ?? "");
      setSourceUrl(ref.source_url ?? "");
      setTags(ref.tags ?? []);
      setRating(ref.rating);
      setBestUse(ref.best_use ?? "");
      setRiskNotes(ref.risk_notes ?? "");
      setNotes(ref.notes ?? "");
      setFileData(ref.file_data);
      setThumbData(ref.thumbnail_data);
      setPendingDataUrl(undefined);

      setLinkedPrompts(prompts.map((p) => ({ id: p.id, label: p.title, role: p.role })));
      setLinkedResults(results.map((r) => ({ id: r.id, label: `Result ${r.id.slice(0, 6)}`, role: r.role })));
      setLoading(false);
    })();
  }, [id]);

  const buildInput = (): CreateReferenceInput => ({
    title: title.trim(),
    description: description.trim() || undefined,
    kind,
    file_data: fileData,
    thumbnail_data: thumbData,
    provider: (provider || undefined) as Reference["provider"] | undefined,
    category: (category || undefined) as Reference["category"] | undefined,
    source_url: sourceUrl.trim() || undefined,
    tags: tags.length ? tags : undefined,
    rating,
    best_use: bestUse.trim() || undefined,
    risk_notes: riskNotes.trim() || undefined,
    notes: notes.trim() || undefined,
  });

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      let resolvedFile = fileData;
      let resolvedThumb = thumbData;

      if (pendingDataUrl) {
        const refId = isNew ? crypto.randomUUID().replace(/-/g, "") : id!;
        const { filePath, thumbPath } = await saveReferenceImage(refId, pendingDataUrl);
        resolvedFile = filePath;
        resolvedThumb = thumbPath;
        setFileData(filePath);
        setThumbData(thumbPath);
        setPendingDataUrl(undefined);

        if (isNew) {
          const newId = await createReference({
            ...buildInput(),
            id: refId,
            file_data: resolvedFile,
            thumbnail_data: resolvedThumb,
          });
          navigate(`/references/${newId}`, { replace: true });
          return;
        }
      }

      if (isNew) {
        const newId = await createReference(buildInput());
        navigate(`/references/${newId}`, { replace: true });
      } else {
        await updateReference(id!, {
          ...buildInput(),
          file_data: resolvedFile,
          thumbnail_data: resolvedThumb,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await deleteReference(id!);
    navigate("/references");
  };

  if (loading) {
    return (
      <PageContainer title="Reference" subtitle="LOADING…">
        <div className="flex items-center justify-center h-40">
          <span className="font-mono text-[12px] text-muted">Loading...</span>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={isNew ? "New Reference" : (title || "Reference")}
      subtitle={isNew ? "ADD REFERENCE" : "REFERENCE DETAIL"}
      action={
        <div className="flex items-center gap-2">
          {!isNew && (
            <button type="button" onClick={handleDelete}
              onBlur={() => setConfirmDelete(false)}
              className={cn(
                "font-mono text-[10px] tracking-widest uppercase px-3 py-2 rounded-sm transition-precise",
                confirmDelete ? "text-red border-red/50" : "text-muted hover:text-red"
              )}
              style={{ border: confirmDelete ? "1px solid" : "var(--border-dim)" }}>
              <Trash2 size={9} className="inline mr-1" />
              {confirmDelete ? "Confirm" : "Delete"}
            </button>
          )}
          <Button variant="ghost" size="md" onClick={() => navigate("/references")}>
            <ArrowLeft size={11} /> Back
          </Button>
          <Button variant="primary" size="md" onClick={handleSave} disabled={!title.trim() || saving}>
            <Save size={11} /> {saving ? "Saving…" : saved ? "Saved" : "Save"}
          </Button>
        </div>
      }
    >
      {saved && (
        <div className="mb-5 saved-chip">
          <Check size={10} /> Reference saved
        </div>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-8">

        {/* Left column — form */}
        <div className="flex flex-col gap-6">

          {/* Image */}
          <div className="flex flex-col gap-3">
            <FieldLabel>IMAGE</FieldLabel>
            <ImageDropZone
              src={fileData}
              onFile={(full, thumb) => {
                setFileData(full);
                setThumbData(thumb);
                setPendingDataUrl(full);
              }}
            />
          </div>

          {/* Title + Kind */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-4">
            <div className="flex flex-col gap-1.5">
              <FieldLabel>TITLE</FieldLabel>
              <FieldInput value={title} onChange={setTitle} placeholder="Reference name…" />
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>KIND</FieldLabel>
              <div className="relative">
                <select value={kind} onChange={(e) => setKind(e.target.value as ReferenceKind)}
                  className="appearance-none h-10 pl-3 pr-7 font-mono text-[13px] text-white bg-transparent rounded-sm focus:outline-none w-full cursor-pointer"
                  style={{ border: "1px solid rgba(255,255,255,0.16)" }}>
                  {KIND_OPTIONS.map((o) => <option key={o.value} value={o.value} className="bg-panel text-white">{o.label}</option>)}
                </select>
                <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel>DESCRIPTION</FieldLabel>
            <FieldTextarea value={description} onChange={setDescription} placeholder="What is this reference?" rows={2} />
          </div>

          {/* Best use */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel>BEST USE</FieldLabel>
            <FieldTextarea value={bestUse} onChange={setBestUse} placeholder="What does this work best for in production?" rows={2} />
          </div>

          {/* Risk notes */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={9} className="text-red/50" />
              <FieldLabel>RISK NOTES</FieldLabel>
            </div>
            <FieldTextarea value={riskNotes} onChange={setRiskNotes} placeholder="Artifacts, failure modes, or caveats…" rows={2} />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel>NOTES</FieldLabel>
            <FieldTextarea value={notes} onChange={setNotes} placeholder="Additional production notes…" rows={2} />
          </div>

        </div>

        {/* Right column — metadata + links */}
        <div className="flex flex-col gap-6">

          {/* Rating */}
          <CollapsibleCard title="RATING" gap="gap-3">
            <StarRating value={rating} onChange={setRating} />
            {!isNew && impactScore > 0 && (
              <div className="flex items-center gap-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                <Trophy size={11} className="text-amber shrink-0" />
                <span className="font-mono text-[10px] text-amber">
                  {Math.round(impactScore * 100)}% win rate
                </span>
                <span className="font-mono text-[9px] text-muted ml-auto">IMPACT</span>
              </div>
            )}
          </CollapsibleCard>

          {/* Metadata */}
          <CollapsibleCard title="METADATA" gap="gap-5">
            <div className="flex flex-col gap-1.5">
              <FieldLabel>PROVIDER</FieldLabel>
              <FieldSelect value={provider} onChange={setProvider} options={PROVIDER_OPTIONS} empty="— provider —" />
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel>CATEGORY</FieldLabel>
              <FieldSelect value={category} onChange={setCategory} options={CATEGORY_OPTIONS} empty="— category —" />
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel>SOURCE URL</FieldLabel>
              <FieldInput value={sourceUrl} onChange={setSourceUrl} placeholder="https://…" mono />
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel>TAGS</FieldLabel>
              <TagInput tags={tags} onChange={setTags} />
            </div>
          </CollapsibleCard>

          {/* Linked items */}
          {(linkedPrompts.length > 0 || linkedResults.length > 0) && (
            <CollapsibleCard title="LINKED TO" gap="gap-5">
              <LinkedSection title="PROMPTS" items={linkedPrompts} />
              <LinkedSection title="RESULTS" items={linkedResults} />
            </CollapsibleCard>
          )}

        </div>
      </div>
    </PageContainer>
  );
}
