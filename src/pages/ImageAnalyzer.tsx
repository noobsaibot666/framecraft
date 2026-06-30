import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "react-router-dom";
import { Scan, Copy, Check, AlertTriangle, Upload, ArrowRight, Tag, Settings, ShieldAlert, Shuffle, Bookmark } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { usePromptStore } from "@/stores/usePromptStore";
import { AI_MODELS, getApiKey } from "@/lib/aiConfig";
import type { AIModel } from "@/lib/aiConfig";
import { analyzeImage } from "@/lib/analyzeImage";
import type { AnalysisResult } from "@/lib/analyzeImage";
import { buildImagePromptAsset } from "@/lib/analysisAssets";
import { createReference } from "@/lib/references";
import { cn } from "@/lib/utils";

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, data] = result.split(",");
      const mime = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
      resolve({ base64: data, mimeType: mime });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Copy Button ──────────────────────────────────────────────

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" onClick={handleCopy}
      className="flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-readable hover:text-cyan transition-precise px-3 py-2 rounded-sm"
      style={{ border: "var(--border-dim)" }}>
      {copied ? <Check size={10} className="text-cyan" /> : <Copy size={10} />}
      {copied ? "Copied!" : label}
    </button>
  );
}

function EditableTags({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState("");
  const add = () => {
    const next = input.trim().toLowerCase();
    if (!next) return;
    onChange([...new Set([...tags, next])]);
    setInput("");
  };
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {tags.map((tag) => (
        <span key={tag}
          className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase px-2 py-1 rounded-sm text-readable"
          style={{ border: "var(--border-dim)" }}>
          {tag}
          <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))} className="text-dim/50 hover:text-red">x</button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder="add tag"
        className="h-8 w-32 px-3 bg-transparent font-mono text-[10px] text-soft-white placeholder:text-readable/60 rounded-sm focus:outline-none"
        style={{ border: "var(--border-dim)" }}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

export function ImageAnalyzer() {
  const navigate = useNavigate();
  const { create } = usePromptStore();

  const [selectedModel, setSelectedModel] = useState<AIModel>(AI_MODELS[0]);
  const apiKey = getApiKey(selectedModel.provider);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [editableTags, setEditableTags] = useState<string[]>([]);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [importingVariation, setImportingVariation] = useState(false);
  const [importedVariation, setImportedVariation] = useState(false);
  const [savedAsRef, setSavedAsRef] = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setImageFile(file);
    setImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setResult(null);
    setError("");
    setImported(false);
    setImportedVariation(false);
    setSavedAsRef(false);
    setEditableTags([]);
  }, []);

  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  const clearImage = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageFile(null);
    setImageUrl("");
    setResult(null);
    setError("");
    setImported(false);
    setImportedVariation(false);
    setSavedAsRef(false);
    setEditableTags([]);
  };

  const handleSaveAsRef = async () => {
    if (!imageUrl || !result) return;
    const resp = await fetch(imageUrl);
    const blob = await resp.blob();
    const reader = new FileReader();
    reader.onload = async (e) => {
      const full = e.target?.result as string;
      const img = new Image();
      img.onload = async () => {
        const MAX = 400;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        await createReference({
          title: result.title,
          kind: "image",
          file_data: full,
          thumbnail_data: canvas.toDataURL("image/jpeg", 0.75),
          tags: editableTags,
          best_use: result.style_notes,
          notes: result.suggested_prompt.slice(0, 200),
        });
        setSavedAsRef(true);
      };
      img.src = full;
    };
    reader.readAsDataURL(blob);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp", ".gif"] },
    maxFiles: 1,
    multiple: false,
  });

  const handleAnalyze = async () => {
    if (!imageFile || !apiKey) return;
    setAnalyzing(true);
    setError("");
    setResult(null);
    try {
      const { base64, mimeType } = await fileToBase64(imageFile);
      const analysis = await analyzeImage(base64, mimeType, selectedModel);
      setResult(analysis);
      setEditableTags(analysis.tags);
      setHistory((prev) => [analysis, ...prev.filter((item) => item.title !== analysis.title)].slice(0, 6));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed. Check your API key in Settings.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleImport = async () => {
    if (!result) return;
    setImporting(true);
    try {
      await create(buildImagePromptAsset(result, editableTags));
      setImported(true);
    } finally {
      setImporting(false);
    }
  };

  const handleImportVariation = async () => {
    if (!result?.variation_prompt) return;
    setImportingVariation(true);
    try {
      await create(buildImagePromptAsset(result, editableTags, result.variation_prompt, `${result.title} - variation`));
      setImportedVariation(true);
    } finally {
      setImportingVariation(false);
    }
  };

  return (
    <PageContainer title="Image Analyzer" subtitle="AI-POWERED PROMPT RECONSTRUCTION">
      <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-8 h-full">

        {/* Left: drop zone + image */}
        <div className="flex flex-col gap-5 min-w-0">
          <div {...getRootProps()}
            className={cn(
              "flex flex-col items-center justify-center gap-4 rounded-card cursor-pointer transition-precise",
              imageUrl ? "h-80" : "h-60",
              isDragActive ? "border-cyan/50 bg-cyan/8" : "hover:border-cyan/40 hover:bg-white/3"
            )}
            style={{ border: isDragActive ? "1px solid rgba(255,255,255,0.30)" : "var(--border-default)" }}>
            <input {...getInputProps()} />
            {imageUrl ? (
              <img src={imageUrl} alt="Selected" className="w-full h-full object-cover rounded-card" />
            ) : (
              <>
                <Upload size={24} className="text-cyan" />
                <div className="flex flex-col items-center gap-1.5">
                  <span className="font-mono text-[13px] text-soft-white">Drop image here</span>
                  <span className="font-mono text-[12px] text-readable">or click to browse</span>
                  <span className="font-mono text-[10px] text-readable/70 mt-1">JPG · PNG · WEBP · GIF</span>
                </div>
              </>
            )}
          </div>

          {imageFile && (
            <div className="flex flex-col gap-1 px-1">
              <span className="font-mono text-[12px] text-soft-white truncate">{imageFile.name}</span>
              <span className="font-mono text-[10px] text-readable">{(imageFile.size / 1024).toFixed(0)} KB</span>
            </div>
          )}

          {!apiKey && (
            <div className="flex items-start gap-2 p-3 rounded-sm"
              style={{ border: "1px solid rgba(215,25,33,0.25)", background: "rgba(215,25,33,0.04)" }}>
              <AlertTriangle size={12} className="text-red/80 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[12px] text-red/80">No API key configured.</span>
                <button type="button" onClick={() => navigate("/settings")}
                  className="flex items-center gap-1.5 font-mono text-[10px] text-cyan hover:text-white transition-precise">
                  <Settings size={10} /> Open Settings
                </button>
              </div>
            </div>
          )}

          {/* Model picker */}
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] tracking-widest uppercase text-readable">MODEL</span>
            <div className="flex flex-col gap-2">
              {[{ id: "anthropic" as const, label: "ANTHROPIC" }, { id: "openai" as const, label: "OPENAI" }].map(({ id, label }) => {
                const models = AI_MODELS.filter((m) => m.provider === id);
                return (
                  <div key={id} className="flex flex-col gap-1">
                    <span className="font-mono text-[9px] tracking-widest uppercase text-readable/70">{label}</span>
                    {models.map((m) => (
                      <button key={m.id} type="button"
                        onClick={() => setSelectedModel(m)}
                        className={cn(
                          "flex items-center justify-between px-3 py-2.5 rounded-sm text-left transition-precise",
                          selectedModel.id === m.id ? "accent-selected" : "text-readable hover:text-cyan"
                        )}
                        style={{ border: selectedModel.id === m.id ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(255,255,255,0.05)" }}>
                        <span className="font-mono text-[12px]">{m.label}</span>
                        <span className="font-mono text-[9px] tracking-widest uppercase text-readable/70">{m.tier}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={handleAnalyze}
            disabled={!imageFile || !apiKey || analyzing}
            className="w-full justify-center"
          >
            <Scan size={11} />
            {analyzing ? "Analyzing…" : "Analyze Image"}
          </Button>

          {imageUrl && (
            <button type="button" onClick={clearImage}
              className="font-mono text-[12px] text-readable hover:text-cyan transition-precise text-center">
              Clear
            </button>
          )}
        </div>

        {/* Right: results */}
        <div className="min-w-0">
          {history.length > 0 && (
            <div className="mb-4 flex flex-col gap-2 p-3 rounded-card"
              style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
              <div className="flex items-center justify-between">
                <span className="system-label">ANALYSIS HISTORY</span>
              <span className="font-mono text-[10px] text-readable">{history.length}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {history.map((item) => (
                  <button key={item.title} type="button" onClick={() => { setResult(item); setEditableTags(item.tags); }}
                    className="font-mono text-[10px] tracking-widest uppercase px-3 py-2 rounded-sm text-readable hover:text-cyan transition-precise"
                    style={{ border: "var(--border-dim)" }}>
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!result && !analyzing && !error && (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Scan size={28} className="text-cyan" />
              <span className="font-mono text-[13px] text-readable">Drop an image and click Analyze to reconstruct its prompt.</span>
            </div>
          )}

          {analyzing && (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-5 h-5 border border-white/20 border-t-white/60 rounded-full animate-spin" />
              <span className="font-mono text-[13px] text-readable">Sending to vision model...</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-4 rounded-card"
              style={{ border: "1px solid rgba(215,25,33,0.25)", background: "rgba(215,25,33,0.04)" }}>
              <AlertTriangle size={12} className="text-red/60 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[13px] text-red/80 font-medium">Analysis failed</span>
                <span className="font-mono text-[13px] text-readable">{error}</span>
              </div>
            </div>
          )}

          {result && (
            <div className="flex flex-col gap-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="font-sans text-[18px] font-semibold text-white">{result.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-1 rounded-sm text-readable"
                      style={{ border: "var(--border-dim)" }}>{result.quality_tier}</span>
                    {result.aspect_ratio && (
                      <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-1 rounded-sm text-readable"
                        style={{ border: "var(--border-dim)" }}>{result.aspect_ratio}</span>
                    )}
                    <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-1 rounded-sm text-readable"
                      style={{ border: "var(--border-dim)" }}>{result.provider}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {imported ? (
                    <span className="saved-chip">
                      <Check size={10} /> Saved to library
                    </span>
                  ) : (
                    <Button variant="primary" size="sm" onClick={handleImport} disabled={importing}>
                      {importing ? "Saving…" : "Import to Library"}
                      <ArrowRight size={10} />
                    </Button>
                  )}
                  {savedAsRef ? (
                    <span className="saved-chip">
                      <Check size={8} /> Ref saved
                    </span>
                  ) : (
                    <button type="button" onClick={handleSaveAsRef}
                      className="flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-readable hover:text-cyan transition-precise px-3 py-2 rounded-sm"
                      style={{ border: "var(--border-dim)" }}>
                      <Bookmark size={8} /> Save as Ref
                    </button>
                  )}
                </div>
              </div>

              {/* Suggested prompt */}
              <div className="flex flex-col gap-2 p-4 rounded-card"
                style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
                <div className="flex items-center justify-between">
                  <span className="system-label">RECONSTRUCTED PROMPT</span>
                  <CopyButton text={result.suggested_prompt} label="Copy prompt" />
                </div>
                <p className="font-mono text-[14px] text-soft-white leading-relaxed line-clamp-5">
                  {result.suggested_prompt}
                </p>
              </div>

              {/* Variation prompt */}
              {result.variation_prompt && (
                <div className="flex flex-col gap-2 p-4 rounded-card"
                  style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Shuffle size={11} className="text-amber" />
                      <span className="system-label">VARIATION PROMPT</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CopyButton text={result.variation_prompt} label="Copy" />
                      {importedVariation ? (
                        <span className="flex items-center gap-1 font-mono text-[8px] text-white/40">
                          <Check size={8} /> Saved
                        </span>
                      ) : (
                        <button type="button" onClick={handleImportVariation} disabled={importingVariation}
                          className="flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-readable hover:text-cyan disabled:opacity-40 transition-precise px-3 py-2 rounded-sm"
                          style={{ border: "var(--border-dim)" }}>
                          <ArrowRight size={8} /> {importingVariation ? "Saving…" : "Import"}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="font-mono text-[14px] text-soft-white leading-relaxed line-clamp-4">
                    {result.variation_prompt}
                  </p>
                </div>
              )}

              {/* Style notes */}
              <div className="flex flex-col gap-2 p-4 rounded-card"
                style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
                <span className="system-label">STYLE ANALYSIS</span>
                <p className="font-mono text-[14px] text-readable leading-relaxed line-clamp-4">
                  {result.style_notes}
                </p>
              </div>

              {/* AI-look risks + avoidance */}
              {(result.ai_look_risks?.length > 0 || result.avoidance_suggestions?.length > 0) && (
                <div className="flex flex-col gap-3 p-4 rounded-card"
                  style={{ border: "1px solid rgba(215,25,33,0.20)", background: "rgba(215,25,33,0.03)" }}>
                  {result.ai_look_risks?.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1.5">
                        <ShieldAlert size={9} className="text-red/60" />
                        <span className="system-label text-red/60">AI-LOOK RISKS DETECTED</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {result.ai_look_risks.map((risk) => (
                          <span key={risk} className="font-mono text-[13px] text-red/75 leading-snug">· {risk}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.avoidance_suggestions?.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="system-label">AVOIDANCE TOKENS</span>
                        <CopyButton text={result.avoidance_suggestions.join(", ")} label="Copy all" />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {result.avoidance_suggestions.map((s) => (
                          <span key={s}
                            className="font-mono text-[10px] tracking-widest uppercase px-2 py-1 rounded-sm text-red/75"
                            style={{ border: "1px solid rgba(215,25,33,0.20)" }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Elements + Tags */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2 p-4 rounded-card"
                  style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
                  <span className="system-label">DETECTED ELEMENTS</span>
                  <div className="flex flex-col gap-1">
                    {result.elements.map((el) => (
                      <span key={el} className="font-mono text-[13px] text-soft-white leading-snug">· {el}</span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 p-4 rounded-card"
                  style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
                  <div className="flex items-center gap-1.5">
                    <Tag size={11} className="text-cyan" />
                    <span className="system-label">SUGGESTED TAGS</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <EditableTags tags={editableTags} onChange={setEditableTags} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
