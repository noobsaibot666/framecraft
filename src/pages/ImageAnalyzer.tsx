import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "react-router-dom";
import { Scan, Copy, Check, AlertTriangle, Upload, ArrowRight, Tag, Settings } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { usePromptStore } from "@/stores/usePromptStore";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────

interface AnalysisResult {
  title: string;
  suggested_prompt: string;
  style_notes: string;
  elements: string[];
  tags: string[];
  aspect_ratio: string;
  quality_tier: string;
  provider: string;
}

// ─── Claude API ───────────────────────────────────────────────

const ANALYSIS_PROMPT = `You are an expert AI prompt engineer for advertising-grade image production using Midjourney.
Analyze this image and return ONLY a valid JSON object (no markdown, no explanation) with exactly these fields:
{
  "title": "concise 4-8 word descriptive title for this prompt",
  "suggested_prompt": "complete Midjourney prompt to recreate this image — include subject, composition, lighting, color palette, visual style, mood, and any relevant camera or lens descriptors",
  "style_notes": "2-3 sentences on the visual style, lighting approach, and production quality",
  "elements": ["key visual element 1", "element 2"],
  "tags": ["portrait", "advertising", "editorial"],
  "aspect_ratio": "16:9",
  "quality_tier": "commercial",
  "provider": "midjourney"
}
quality_tier must be one of: commercial, editorial, concept, reference.
Return only the JSON object — no markdown fences, no preamble.`;

async function analyzeImage(
  base64: string,
  mimeType: string,
  apiKey: string
): Promise<AnalysisResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType, data: base64 },
            },
            { type: "text", text: ANALYSIS_PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `API error ${res.status}`);
  }

  const data = await res.json() as { content: { type: string; text: string }[] };
  const text = data.content.find((c) => c.type === "text")?.text ?? "";
  // Strip any accidental markdown fences
  const clean = text.replace(/^```[a-z]*\n?/m, "").replace(/\n?```$/m, "").trim();
  return JSON.parse(clean) as AnalysisResult;
}

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
      className="flex items-center gap-1.5 font-mono text-[8px] tracking-widest uppercase text-dim hover:text-white transition-precise px-2 py-1 rounded-sm"
      style={{ border: "var(--border-dim)" }}>
      {copied ? <Check size={8} className="text-white/60" /> : <Copy size={8} />}
      {copied ? "Copied!" : label}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────

export function ImageAnalyzer() {
  const navigate = useNavigate();
  const { create } = usePromptStore();

  const apiKey = localStorage.getItem("fc_anthropic_key") ?? "";

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setResult(null);
    setError("");
    setImported(false);
  }, []);

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
      const analysis = await analyzeImage(base64, mimeType, apiKey);
      setResult(analysis);
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
      await create({
        title: result.title,
        prompt_text: result.suggested_prompt,
        provider: (result.provider as "midjourney") ?? "midjourney",
        tags: result.tags,
        notes: result.style_notes,
        aspect_ratio: result.aspect_ratio ?? undefined,
      });
      setImported(true);
    } finally {
      setImporting(false);
    }
  };

  return (
    <PageContainer title="Image Analyzer" subtitle="AI-POWERED PROMPT RECONSTRUCTION">
      <div className="flex gap-6 h-full">

        {/* Left: drop zone + image */}
        <div className="flex flex-col gap-4 w-64 shrink-0">
          <div {...getRootProps()}
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-card cursor-pointer transition-precise",
              imageUrl ? "h-64" : "h-48",
              isDragActive ? "border-white/30 bg-white/5" : "hover:border-white/20 hover:bg-white/2"
            )}
            style={{ border: isDragActive ? "1px solid rgba(255,255,255,0.30)" : "var(--border-default)" }}>
            <input {...getInputProps()} />
            {imageUrl ? (
              <img src={imageUrl} alt="Selected" className="w-full h-full object-cover rounded-card" />
            ) : (
              <>
                <Upload size={20} className="text-dim/40" />
                <div className="flex flex-col items-center gap-1">
                  <span className="font-mono text-[10px] text-dim/50">Drop image here</span>
                  <span className="font-mono text-[9px] text-dim/30">or click to browse</span>
                  <span className="font-mono text-[8px] text-dim/25 mt-1">JPG · PNG · WEBP · GIF</span>
                </div>
              </>
            )}
          </div>

          {imageFile && (
            <div className="flex flex-col gap-1 px-1">
              <span className="font-mono text-[9px] text-dim/50 truncate">{imageFile.name}</span>
              <span className="font-mono text-[8px] text-dim/30">{(imageFile.size / 1024).toFixed(0)} KB</span>
            </div>
          )}

          {!apiKey && (
            <div className="flex items-start gap-2 p-3 rounded-sm"
              style={{ border: "1px solid rgba(215,25,33,0.25)", background: "rgba(215,25,33,0.04)" }}>
              <AlertTriangle size={10} className="text-red/60 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[9px] text-red/70">No API key configured.</span>
                <button type="button" onClick={() => navigate("/settings")}
                  className="flex items-center gap-1 font-mono text-[8px] text-dim hover:text-white transition-precise">
                  <Settings size={8} /> Open Settings
                </button>
              </div>
            </div>
          )}

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
            <button type="button" onClick={() => { setImageFile(null); setImageUrl(""); setResult(null); setError(""); setImported(false); }}
              className="font-mono text-[9px] text-dim/40 hover:text-dim transition-precise text-center">
              Clear
            </button>
          )}
        </div>

        {/* Right: results */}
        <div className="flex-1 min-w-0">
          {!result && !analyzing && !error && (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Scan size={24} className="text-dim/20" />
              <span className="font-mono text-[10px] text-dim/40">Drop an image and click Analyze to reconstruct its prompt.</span>
            </div>
          )}

          {analyzing && (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-5 h-5 border border-white/20 border-t-white/60 rounded-full animate-spin" />
              <span className="font-mono text-[10px] text-dim/50">Sending to Claude vision…</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-4 rounded-card"
              style={{ border: "1px solid rgba(215,25,33,0.25)", background: "rgba(215,25,33,0.04)" }}>
              <AlertTriangle size={12} className="text-red/60 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] text-red/70 font-medium">Analysis failed</span>
                <span className="font-mono text-[10px] text-muted">{error}</span>
              </div>
            </div>
          )}

          {result && (
            <div className="flex flex-col gap-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="font-sans text-[15px] font-semibold text-white">{result.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm text-dim/60"
                      style={{ border: "var(--border-dim)" }}>{result.quality_tier}</span>
                    {result.aspect_ratio && (
                      <span className="font-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm text-dim/60"
                        style={{ border: "var(--border-dim)" }}>{result.aspect_ratio}</span>
                    )}
                    <span className="font-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm text-dim/60"
                      style={{ border: "var(--border-dim)" }}>{result.provider}</span>
                  </div>
                </div>
                {imported ? (
                  <span className="flex items-center gap-1.5 font-mono text-[9px] text-white/50">
                    <Check size={10} /> Saved to library
                  </span>
                ) : (
                  <Button variant="primary" size="sm" onClick={handleImport} disabled={importing}>
                    {importing ? "Saving…" : "Import to Library"}
                    <ArrowRight size={10} />
                  </Button>
                )}
              </div>

              {/* Suggested prompt */}
              <div className="flex flex-col gap-2 p-4 rounded-card"
                style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
                <div className="flex items-center justify-between">
                  <span className="system-label">RECONSTRUCTED PROMPT</span>
                  <CopyButton text={result.suggested_prompt} label="Copy prompt" />
                </div>
                <p className="font-mono text-[11px] text-soft-white leading-relaxed">
                  {result.suggested_prompt}
                </p>
              </div>

              {/* Style notes */}
              <div className="flex flex-col gap-2 p-4 rounded-card"
                style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
                <span className="system-label">STYLE ANALYSIS</span>
                <p className="font-mono text-[11px] text-muted leading-relaxed">
                  {result.style_notes}
                </p>
              </div>

              {/* Elements + Tags */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2 p-4 rounded-card"
                  style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
                  <span className="system-label">DETECTED ELEMENTS</span>
                  <div className="flex flex-col gap-1">
                    {result.elements.map((el) => (
                      <span key={el} className="font-mono text-[10px] text-soft-white/70 leading-snug">· {el}</span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 p-4 rounded-card"
                  style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
                  <div className="flex items-center gap-1.5">
                    <Tag size={9} className="text-dim" />
                    <span className="system-label">SUGGESTED TAGS</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.tags.map((tag) => (
                      <span key={tag}
                        className="font-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm text-dim/60"
                        style={{ border: "var(--border-dim)" }}>
                        {tag}
                      </span>
                    ))}
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
