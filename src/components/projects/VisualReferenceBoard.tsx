import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, ScanEye, X } from "lucide-react";
import {
  addVisualReference,
  analyzeVisualReference,
  buildVisualReferenceContext,
  getVisualReferences,
  MAX_VISUAL_REFERENCE_NOTE,
  MAX_VISUAL_REFERENCES,
  removeVisualReference,
  updateVisualReferenceNote,
  type VisualReference,
} from "@/lib/visualReferences";
import { useImageDisplaySrc } from "@/lib/useImageDisplaySrc";

interface VisualReferenceBoardProps {
  projectId: string;
  /** Fires whenever the reference set changes, so a sibling (Direction Studio) can use the built context. */
  onContextChange?: (context: string) => void;
}

function VisualRefThumb({ src }: { src?: string }) {
  const image = useImageDisplaySrc(src ?? "");
  if (!image.src) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)" }}>
        <span className="font-mono text-[8px] text-dim/40">REF</span>
      </div>
    );
  }
  return <img src={image.src} onError={image.onError} className="w-full h-full object-cover" />;
}

function VisualReferenceCard({
  refItem,
  onNoteSaved,
  onRemove,
  onAnalyzed,
}: {
  refItem: VisualReference;
  onNoteSaved: (id: string, note: string) => void;
  onRemove: (id: string) => void;
  onAnalyzed: (id: string, analysis: string) => void;
}) {
  const [note, setNote] = useState(refItem.note);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysisError("");
    try {
      const analysis = await analyzeVisualReference(refItem);
      onAnalyzed(refItem.id, analysis);
    } catch (caught) {
      setAnalysisError(caught instanceof Error ? caught.message : "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="flex gap-2.5 p-2 rounded-sm" style={{ border: "var(--border-dim)", background: "rgba(255,255,255,0.02)" }}>
      <div className="w-14 h-14 rounded-sm overflow-hidden shrink-0" style={{ border: "var(--border-dim)" }}>
        <VisualRefThumb src={refItem.thumbnail_data} />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-1">
          <span className="font-mono text-[10px] text-soft-white/80 truncate">{refItem.title}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing || !refItem.thumbnail_data}
              className="text-dim/50 hover:text-cyan disabled:opacity-40 transition-precise"
              title={refItem.analysis ? "Re-run AI image analysis" : "Analyze this image with AI"}
            >
              <ScanEye size={11} className={analyzing ? "animate-pulse text-cyan" : undefined} />
            </button>
            <button
              type="button"
              onClick={() => onRemove(refItem.id)}
              className="text-dim/50 hover:text-red transition-precise"
              title="Remove visual reference"
            >
              <X size={11} />
            </button>
          </div>
        </div>
        <input
          value={note}
          maxLength={MAX_VISUAL_REFERENCE_NOTE}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => { if (note !== refItem.note) onNoteSaved(refItem.id, note); }}
          placeholder="Reference for… (clothing, mood, lighting)"
          className="w-full h-7 px-2 rounded-sm bg-black/25 font-mono text-[10px] text-soft-white placeholder:text-dim focus:outline-none"
          style={{ border: "var(--border-dim)" }}
        />
        {analysisError && (
          <span className="font-mono text-[8.5px] text-red/80 leading-relaxed">{analysisError}</span>
        )}
        {refItem.analysis && (
          <p className="font-mono text-[8.5px] text-cyan/60 leading-relaxed">{refItem.analysis}</p>
        )}
      </div>
    </div>
  );
}

/** Visual Reference board (Direction Studio input) — lives in the page's action rail so it reads
 * as project-setup data, not part of the generation output. Self-contained; reports its built
 * context string upward so Direction Studio can feed it into generation without owning the state. */
export function VisualReferenceBoard({ projectId, onContextChange }: VisualReferenceBoardProps) {
  const [visualRefs, setVisualRefs] = useState<VisualReference[]>([]);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    try {
      setVisualRefs(await getVisualReferences(projectId));
    } catch {
      setVisualRefs([]);
    }
  }, [projectId]);

  useEffect(() => { reload(); }, [reload]);

  const context = useMemo(() => buildVisualReferenceContext(visualRefs), [visualRefs]);
  useEffect(() => { onContextChange?.(context); }, [context, onContextChange]);

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadingRef(true);
    setError("");
    try {
      const slots = MAX_VISUAL_REFERENCES - visualRefs.length;
      for (const file of Array.from(files).slice(0, slots)) {
        await addVisualReference(projectId, file);
      }
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setUploadingRef(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleNoteSaved = async (id: string, note: string) => {
    try {
      await updateVisualReferenceNote(id, note);
      setVisualRefs((current) => current.map((ref) => ref.id === id ? { ...ref, note } : ref));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const handleRemoveRef = async (id: string) => {
    try {
      await removeVisualReference(projectId, id);
      setVisualRefs((current) => current.filter((ref) => ref.id !== id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 rounded-card" style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
      <div className="flex items-center justify-between">
        <span className="system-label text-soft-white">VISUAL REFERENCE</span>
        <span className="font-mono text-[9px] text-muted">{visualRefs.length}/{MAX_VISUAL_REFERENCES}</span>
      </div>
      <p className="font-mono text-[10px] leading-relaxed text-readable">
        Guides Direction Studio — up to {MAX_VISUAL_REFERENCES} images for aesthetics, mood, or product.
      </p>

      {error && <p className="font-mono text-[9px] text-red/80 leading-relaxed">{error}</p>}

      {visualRefs.map((refItem) => (
        <VisualReferenceCard
          key={refItem.id}
          refItem={refItem}
          onNoteSaved={handleNoteSaved}
          onRemove={handleRemoveRef}
          onAnalyzed={(id, analysis) =>
            setVisualRefs((current) => current.map((r) => (r.id === id ? { ...r, analysis } : r)))}
        />
      ))}

      {visualRefs.length < MAX_VISUAL_REFERENCES && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => handleUploadFiles(event.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              handleUploadFiles(event.dataTransfer.files);
            }}
            disabled={uploadingRef}
            className={`flex items-center justify-center gap-2 min-h-11 rounded-sm border border-dashed font-mono text-[10px] tracking-widest uppercase transition-precise disabled:opacity-50 ${
              dragging ? "border-cyan/70 bg-cyan/8 text-cyan" : "border-cyan/45 text-readable hover:text-cyan hover:bg-cyan/6"
            }`}
          >
            <ImagePlus size={12} />
            {uploadingRef ? "Uploading…" : dragging ? "Drop to add" : "Drop or click to add reference image"}
          </button>
        </>
      )}
    </div>
  );
}
