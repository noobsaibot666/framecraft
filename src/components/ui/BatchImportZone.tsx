import { useRef, useState } from "react";
import { Upload, X, Check, AlertCircle, Image } from "lucide-react";
import { fileToDataUrl } from "@/lib/imageUtils";
import { importProjectResultImage } from "@/lib/sharedImport";
import { recomputePromptResultSummary } from "@/lib/db";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

export interface BatchImportFile {
  file: File;
  preview?: string;
  status: "pending" | "importing" | "done" | "error";
  error?: string;
}

interface Props {
  projectId: string;
  promptId: string;
  promptProvider: string;
  onComplete: () => void;
  onCancel: () => void;
}

function FileThumb({ item }: { item: BatchImportFile }) {
  const icon = item.status === "done" ? (
    <Check size={10} className="text-cyan" />
  ) : item.status === "error" ? (
    <AlertCircle size={10} className="text-red" />
  ) : item.status === "importing" ? (
    <span className="font-mono text-[8px] text-amber animate-pulse">…</span>
  ) : null;

  return (
    <div className="relative flex flex-col gap-1">
      <div className="relative w-full aspect-square rounded-sm overflow-hidden"
        style={{ background: "rgba(255,255,255,0.04)", border: "var(--border-dim)" }}>
        {item.preview ? (
          <img src={item.preview} alt={item.file.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <Image size={14} className="text-white/20" />
          </div>
        )}
        {icon && (
          <div className={cn(
            "absolute top-1 right-1 w-5 h-5 rounded-sm flex items-center justify-center",
            item.status === "done" ? "bg-cyan/20" : item.status === "error" ? "bg-red/20" : "bg-amber/20"
          )}>
            {icon}
          </div>
        )}
        {item.status === "importing" && (
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.35)" }} />
        )}
      </div>
      <span className="font-mono text-[8px] text-muted truncate">{item.file.name}</span>
      {item.error && (
        <span className="font-mono text-[8px] text-red truncate" title={item.error}>{item.error}</span>
      )}
    </div>
  );
}

export function BatchImportZone({ projectId, promptId, promptProvider, onComplete, onCancel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<BatchImportFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [doneCount, setDoneCount] = useState(0);

  const addFiles = async (incoming: File[]) => {
    const images = incoming.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    const withPreviews = await Promise.all(images.map(async (f) => {
      let preview: string | undefined;
      try { preview = await fileToDataUrl(f); } catch {}
      return { file: f, preview, status: "pending" as const };
    }));
    setFiles((prev) => [...prev, ...withPreviews]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    addFiles(dropped);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    addFiles(selected);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleRemove = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImportAll = async () => {
    if (running || files.length === 0) return;
    setRunning(true);
    let done = 0;

    for (let i = 0; i < files.length; i++) {
      if (files[i].status === "done") { done++; continue; }
      setFiles((prev) => prev.map((f, j) => j === i ? { ...f, status: "importing" } : f));
      try {
        const resultId = crypto.randomUUID().replace(/-/g, "");
        const dataUrl = files[i].preview ?? await fileToDataUrl(files[i].file);
        await importProjectResultImage({
          resultId,
          projectId,
          promptId,
          dataUrl,
          originalName: files[i].file.name,
          result: { provider: promptProvider as never, notes: `Batch import: ${files[i].file.name}` },
        });
        await recomputePromptResultSummary(promptId);
        done++;
        setDoneCount(done);
        setFiles((prev) => prev.map((f, j) => j === i ? { ...f, status: "done" } : f));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Import failed";
        setFiles((prev) => prev.map((f, j) => j === i ? { ...f, status: "error", error: msg } : f));
      }
    }

    setRunning(false);
    if (done > 0) onComplete();
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const hasFiles = files.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-2 py-8 rounded-sm cursor-pointer transition-precise",
          dragging ? "border-cyan/60 bg-cyan/5" : "hover:border-white/25"
        )}
        style={{ border: dragging ? "1px solid" : "1px dashed rgba(255,255,255,0.16)" }}
      >
        <Upload size={16} className={dragging ? "text-cyan" : "text-white/30"} />
        <span className="font-mono text-[12px] text-readable">
          {dragging ? "Drop images here" : "Drop images or click to select"}
        </span>
        <span className="font-mono text-[9px] text-dim/50">PNG, JPG, WEBP · multiple files supported</span>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileInput} />
      </div>

      {/* File grid */}
      {hasFiles && (
        <div className="grid grid-cols-4 gap-2.5">
          {files.map((item, i) => (
            <div key={i} className="relative group">
              <FileThumb item={item} />
              {item.status === "pending" && !running && (
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black/70 text-white/60 hover:text-red flex items-center justify-center opacity-0 group-hover:opacity-100 transition-precise"
                >
                  <X size={8} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Status + actions */}
      <div className="flex items-center gap-2">
        {running && (
          <span className="font-mono text-[10px] text-readable">
            Importing {doneCount} / {files.length}…
          </span>
        )}
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={running}>
          Cancel
        </Button>
        {hasFiles && !running && (
          <Button variant="primary" size="sm" onClick={handleImportAll} disabled={pendingCount === 0}>
            <Upload size={10} /> Import {pendingCount > 0 ? pendingCount : files.length} Image{pendingCount !== 1 ? "s" : ""}
          </Button>
        )}
      </div>
    </div>
  );
}
