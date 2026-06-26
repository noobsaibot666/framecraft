import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Trash2, Star, AlertTriangle, Upload, Link2, ChevronDown, Check } from "lucide-react";
import { saveReferenceImage } from "@/lib/fileStore";
import { useImageDisplaySrc } from "@/lib/useImageDisplaySrc";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import {
  getReferenceById,
  createReference,
  updateReference,
  deleteReference,
  getPromptsForReference,
  getResultsForReference,
  type CreateReferenceInput,
} from "@/lib/references";
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
  return <label className="system-label text-[11px] text-muted">{children}</label>;
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
        "h-10 px-3 text-[13px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none w-full",
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
      className="px-3 py-2.5 font-mono text-[12px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none w-full resize-none"
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
        className="appearance-none h-10 pl-3 pr-7 font-mono text-[12px] text-white bg-transparent rounded-sm focus:outline-none w-full cursor-pointer"
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

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const full = e.target?.result as string;
      // Generate thumbnail via canvas
      const img = new Image();
      img.onload = () => {
        const MAX = 400;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        onFile(full, canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = full;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) processFile(file);
  };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center rounded-card overflow-hidden bg-black/25",
        "border-2 border-dashed transition-colors",
        src ? "aspect-video" : "aspect-video"
      )}
      style={{ borderColor: "rgba(255,255,255,0.18)" }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      {image.src ? (
        <>
          <img src={image.src} alt="reference" className="w-full h-full object-contain" onError={image.onError} />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            style={{ background: "rgba(0,0,0,0.6)" }}>
            <span className="font-mono text-[11px] text-white tracking-widest uppercase">Replace image</span>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 cursor-pointer">
          <Upload size={24} className="text-muted" />
          <span className="font-mono text-[11px] text-readable tracking-widest uppercase">Drop image or click</span>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
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
            <span className="font-sans text-[12px] text-readable truncate">{item.label}</span>
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
  const [tags, setTags] = useState("");
  const [rating, setRating] = useState(0);
  const [bestUse, setBestUse] = useState("");
  const [riskNotes, setRiskNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [fileData, setFileData] = useState<string | undefined>();
  const [thumbData, setThumbData] = useState<string | undefined>();
  const [pendingDataUrl, setPendingDataUrl] = useState<string | undefined>();

  // Linked items
  const [linkedPrompts, setLinkedPrompts] = useState<{ id: string; label: string; role: ReferenceRole }[]>([]);
  const [linkedResults, setLinkedResults] = useState<{ id: string; label: string; role: ReferenceRole }[]>([]);

  useEffect(() => {
    if (isNew || !id) return;
    (async () => {
      setLoading(true);
      const [ref, prompts, results] = await Promise.all([
        getReferenceById(id),
        getPromptsForReference(id),
        getResultsForReference(id),
      ]);
      if (!ref) { navigate("/references"); return; }

      setTitle(ref.title);
      setDescription(ref.description ?? "");
      setKind(ref.kind);
      setProvider(ref.provider ?? "");
      setCategory(ref.category ?? "");
      setSourceUrl(ref.source_url ?? "");
      setTags((ref.tags ?? []).join(", "));
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
    tags: tags.trim() ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
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
          <span className="font-mono text-[11px] text-muted">Loading...</span>
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
                  className="appearance-none h-10 pl-3 pr-7 font-mono text-[12px] text-white bg-transparent rounded-sm focus:outline-none w-full cursor-pointer"
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
          <div className="flex flex-col gap-3 p-5 rounded-card" style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
            <FieldLabel>RATING</FieldLabel>
            <StarRating value={rating} onChange={setRating} />
          </div>

          {/* Metadata */}
          <div className="flex flex-col gap-5 p-5 rounded-card" style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
            <span className="system-label text-soft-white">METADATA</span>

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
              <FieldInput value={tags} onChange={setTags} placeholder="tag1, tag2, tag3" mono />
              <span className="font-mono text-[10px] text-muted">Comma-separated</span>
            </div>
          </div>

          {/* Linked items */}
          {(linkedPrompts.length > 0 || linkedResults.length > 0) && (
            <div className="flex flex-col gap-5 p-5 rounded-card" style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
              <span className="system-label text-soft-white">LINKED TO</span>
              <LinkedSection title="PROMPTS" items={linkedPrompts} />
              <LinkedSection title="RESULTS" items={linkedResults} />
            </div>
          )}

        </div>
      </div>
    </PageContainer>
  );
}
