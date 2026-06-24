import { useState, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "react-router-dom";
import { Film, Scan, Copy, Check, AlertTriangle, ArrowRight, Tag, Settings } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { usePromptStore } from "@/stores/usePromptStore";
import { AI_MODELS, getApiKey } from "@/lib/aiConfig";
import type { AIModel } from "@/lib/aiConfig";
import { analyzeImage } from "@/lib/analyzeImage";
import type { AnalysisResult } from "@/lib/analyzeImage";
import { cn } from "@/lib/utils";

// ─── Frame extraction (canvas API — no external deps) ─────────

interface ExtractedFrame {
  dataUrl: string;   // full-res for API
  thumbUrl: string;  // smaller thumbnail for UI
  timestamp: number; // seconds
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function extractFrames(
  file: File,
  count: number,
  onProgress: (current: number, total: number) => void
): Promise<ExtractedFrame[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = URL.createObjectURL(file);

    video.addEventListener("error", () =>
      reject(new Error("Failed to load video. Check the file format."))
    );

    video.addEventListener("loadedmetadata", async () => {
      const duration = video.duration;
      if (!isFinite(duration) || duration < 0.5) {
        reject(new Error("Video too short or duration unreadable."));
        return;
      }

      // Full-res canvas (capped at 1280px for API efficiency)
      const fullCanvas = document.createElement("canvas");
      const scale = video.videoWidth > 1280 ? 1280 / video.videoWidth : 1;
      fullCanvas.width  = Math.round(video.videoWidth  * scale);
      fullCanvas.height = Math.round(video.videoHeight * scale);
      const fullCtx = fullCanvas.getContext("2d")!;

      // Thumb canvas (160px wide for grid)
      const thumbCanvas = document.createElement("canvas");
      const thumbScale = video.videoWidth > 160 ? 160 / video.videoWidth : 1;
      thumbCanvas.width  = Math.round(video.videoWidth  * thumbScale);
      thumbCanvas.height = Math.round(video.videoHeight * thumbScale);
      const thumbCtx = thumbCanvas.getContext("2d")!;

      const frames: ExtractedFrame[] = [];

      for (let i = 0; i < count; i++) {
        // Spread frames across duration, skip first 0.5s (often black)
        const timestamp = count === 1
          ? duration / 2
          : 0.5 + ((duration - 0.5) / (count - 1)) * i;

        await new Promise<void>((res) => {
          video.currentTime = Math.min(timestamp, duration - 0.1);
          video.addEventListener("seeked", () => res(), { once: true });
        });

        fullCtx.drawImage(video, 0, 0, fullCanvas.width, fullCanvas.height);
        thumbCtx.drawImage(video, 0, 0, thumbCanvas.width, thumbCanvas.height);

        frames.push({
          dataUrl:  fullCanvas.toDataURL("image/jpeg", 0.85),
          thumbUrl: thumbCanvas.toDataURL("image/jpeg", 0.70),
          timestamp,
        });

        onProgress(i + 1, count);
      }

      URL.revokeObjectURL(video.src);
      resolve(frames);
    });

    video.load();
  });
}

// ─── Sub-components ───────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="flex items-center gap-1 font-mono text-[8px] tracking-widest uppercase text-dim hover:text-white transition-precise px-2 py-1 rounded-sm"
      style={{ border: "var(--border-dim)" }}>
      {copied ? <Check size={8} className="text-white/60" /> : <Copy size={8} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

interface FrameResult {
  frameIdx: number;
  result: AnalysisResult;
  error?: string;
}

function ResultCard({ frame, result, onImport, imported }: {
  frame: ExtractedFrame;
  result: AnalysisResult;
  onImport: () => void;
  imported: boolean;
}) {
  return (
    <div className="flex gap-4 p-4 rounded-card"
      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
      {/* Frame thumb */}
      <img src={frame.thumbUrl} alt={formatTime(frame.timestamp)}
        className="w-20 h-14 object-cover rounded-sm shrink-0"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }} />

      <div className="flex flex-col gap-2 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-sans text-[12px] font-semibold text-white truncate">{result.title}</span>
            <span className="font-mono text-[8px] text-dim/40">@ {formatTime(frame.timestamp)}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {result.aspect_ratio && (
              <span className="font-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm text-dim/50"
                style={{ border: "var(--border-dim)" }}>{result.aspect_ratio}</span>
            )}
            <CopyButton text={result.suggested_prompt} />
            {imported ? (
              <span className="flex items-center gap-1 font-mono text-[8px] text-white/40"><Check size={8} /> Saved</span>
            ) : (
              <button type="button" onClick={onImport}
                className="flex items-center gap-1 font-mono text-[8px] tracking-widest uppercase text-dim hover:text-white transition-precise px-2 py-1 rounded-sm"
                style={{ border: "var(--border-dim)" }}>
                <ArrowRight size={8} /> Import
              </button>
            )}
          </div>
        </div>

        <p className="font-mono text-[10px] text-soft-white/70 leading-relaxed line-clamp-2">
          {result.suggested_prompt}
        </p>

        <p className="font-mono text-[9px] text-dim/50 leading-relaxed line-clamp-2">
          {result.style_notes}
        </p>

        {result.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 items-center">
            <Tag size={8} className="text-dim/30" />
            {result.tags.map((tag) => (
              <span key={tag} className="font-mono text-[7px] tracking-widest uppercase px-1 py-0.5 rounded-sm text-dim/40"
                style={{ border: "var(--border-dim)" }}>{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

const FRAME_COUNTS = [6, 12, 18] as const;

export function VideoFrames() {
  const navigate = useNavigate();
  const { create } = usePromptStore();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [selectedModel, setSelectedModel] = useState<AIModel>(AI_MODELS[0]);
  const apiKey = getApiKey(selectedModel.provider);

  // Video state
  const [videoFile, setVideoFile]     = useState<File | null>(null);
  const [videoObjUrl, setVideoObjUrl] = useState("");

  // Extraction state
  const [frameCount, setFrameCount]     = useState<6 | 12 | 18>(12);
  const [extracting, setExtracting]     = useState(false);
  const [extractProgress, setExtractProgress] = useState({ current: 0, total: 0 });
  const [frames, setFrames]             = useState<ExtractedFrame[]>([]);

  // Selection + analysis state
  const [selected, setSelected]         = useState<Set<number>>(new Set());
  const [analyzing, setAnalyzing]       = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ current: 0, total: 0 });
  const [results, setResults]           = useState<FrameResult[]>([]);
  const [importedIds, setImportedIds]   = useState<Set<number>>(new Set());

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    if (videoObjUrl) URL.revokeObjectURL(videoObjUrl);
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoObjUrl(url);
    setFrames([]);
    setSelected(new Set());
    setResults([]);
    setImportedIds(new Set());
  }, [videoObjUrl]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/*": [".mp4", ".mov", ".webm", ".avi", ".mkv"] },
    maxFiles: 1,
    multiple: false,
  });

  const handleExtract = async () => {
    if (!videoFile) return;
    setExtracting(true);
    setFrames([]);
    setSelected(new Set());
    setResults([]);
    try {
      const extracted = await extractFrames(videoFile, frameCount, (current, total) =>
        setExtractProgress({ current, total })
      );
      setFrames(extracted);
    } catch (e) {
      console.error(e);
    } finally {
      setExtracting(false);
      setExtractProgress({ current: 0, total: 0 });
    }
  };

  const toggleSelect = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const handleAnalyze = async () => {
    if (!selected.size || !apiKey) return;
    const indices = [...selected].sort((a, b) => a - b);
    setAnalyzing(true);
    setResults([]);
    setImportedIds(new Set());
    setAnalyzeProgress({ current: 0, total: indices.length });
    const out: FrameResult[] = [];
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      const frame = frames[idx];
      const base64 = frame.dataUrl.split(",")[1];
      try {
        const result = await analyzeImage(base64, "image/jpeg", selectedModel);
        out.push({ frameIdx: idx, result });
      } catch (e) {
        out.push({ frameIdx: idx, result: {} as AnalysisResult, error: e instanceof Error ? e.message : "Failed" });
      }
      setAnalyzeProgress({ current: i + 1, total: indices.length });
      setResults([...out]);
    }
    setAnalyzing(false);
  };

  const handleImport = async (result: AnalysisResult, frameIdx: number) => {
    await create({
      title: result.title,
      prompt_text: result.suggested_prompt,
      provider: "midjourney",
      tags: result.tags,
      aspect_ratio: result.aspect_ratio || undefined,
      notes: result.style_notes,
    });
    setImportedIds((prev) => new Set(prev).add(frameIdx));
  };

  return (
    <PageContainer title="Video Frames" subtitle="FRAME EXTRACTION + AI PROMPT RECONSTRUCTION">
      <div className="flex gap-6 h-full">

        {/* Left: controls */}
        <div className="flex flex-col gap-4 w-64 shrink-0">

          {/* Drop zone */}
          <div {...getRootProps()}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-card cursor-pointer transition-precise",
              videoFile ? "h-36" : "h-28",
              isDragActive ? "border-white/30 bg-white/5" : "hover:border-white/20"
            )}
            style={{ border: isDragActive ? "1px solid rgba(255,255,255,0.30)" : "var(--border-default)" }}>
            <input {...getInputProps()} />
            {videoFile ? (
              <video ref={videoRef} src={videoObjUrl} muted playsInline
                className="w-full h-full object-cover rounded-card"
                onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                onMouseLeave={(e) => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0; }} />
            ) : (
              <>
                <Film size={20} className="text-dim/40" />
                <span className="font-mono text-[10px] text-dim/50">Drop video here</span>
                <span className="font-mono text-[8px] text-dim/25">MP4 · MOV · WEBM</span>
              </>
            )}
          </div>

          {videoFile && (
            <span className="font-mono text-[9px] text-dim/40 truncate px-1">{videoFile.name}</span>
          )}

          {/* Frame count */}
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[8px] tracking-widest uppercase text-dim/40">FRAMES TO EXTRACT</span>
            <div className="flex gap-1">
              {FRAME_COUNTS.map((n) => (
                <button key={n} type="button" onClick={() => setFrameCount(n)}
                  className={cn(
                    "flex-1 py-1.5 font-mono text-[10px] rounded-sm transition-precise",
                    frameCount === n ? "text-white" : "text-dim hover:text-muted"
                  )}
                  style={{ border: frameCount === n ? "1px solid rgba(255,255,255,0.20)" : "1px solid rgba(255,255,255,0.06)" }}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={handleExtract}
            disabled={!videoFile || extracting}
            className="w-full justify-center">
            {extracting
              ? `Extracting ${extractProgress.current}/${extractProgress.total}…`
              : "Extract Frames"}
          </Button>

          {/* Divider */}
          {frames.length > 0 && (
            <>
              <div className="h-px bg-white/7" />

              {/* API key warning */}
              {!apiKey && (
                <div className="flex items-start gap-2 p-3 rounded-sm"
                  style={{ border: "1px solid rgba(215,25,33,0.25)", background: "rgba(215,25,33,0.04)" }}>
                  <AlertTriangle size={10} className="text-red/60 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[9px] text-red/70">No API key for {selectedModel.provider}.</span>
                    <button type="button" onClick={() => navigate("/settings")}
                      className="flex items-center gap-1 font-mono text-[8px] text-dim hover:text-white transition-precise">
                      <Settings size={8} /> Open Settings
                    </button>
                  </div>
                </div>
              )}

              {/* Model picker */}
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[8px] tracking-widest uppercase text-dim/40">MODEL</span>
                <div className="flex flex-col gap-1">
                  {(["anthropic", "openai"] as const).map((provider) => (
                    <div key={provider} className="flex flex-col gap-0.5">
                      <span className="font-mono text-[7px] tracking-widest uppercase text-dim/25">{provider}</span>
                      {AI_MODELS.filter((m) => m.provider === provider).map((m) => (
                        <button key={m.id} type="button" onClick={() => setSelectedModel(m)}
                          className={cn(
                            "flex items-center justify-between px-2 py-1.5 rounded-sm text-left transition-precise",
                            selectedModel.id === m.id ? "text-white" : "text-dim hover:text-muted"
                          )}
                          style={{ border: selectedModel.id === m.id ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(255,255,255,0.05)" }}>
                          <span className="font-mono text-[9px]">{m.label}</span>
                          <span className="font-mono text-[7px] tracking-widest uppercase text-dim/30">{m.tier}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <Button variant="primary" size="md" onClick={handleAnalyze}
                disabled={!selected.size || !apiKey || analyzing}
                className="w-full justify-center">
                <Scan size={11} />
                {analyzing
                  ? `Analyzing ${analyzeProgress.current}/${analyzeProgress.total}…`
                  : selected.size
                    ? `Analyze Selected (${selected.size})`
                    : "Select frames to analyze"}
              </Button>
            </>
          )}
        </div>

        {/* Right: frames + results */}
        <div className="flex-1 min-w-0 flex flex-col gap-6 overflow-y-auto">

          {/* Empty state */}
          {!videoFile && (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Film size={24} className="text-dim/20" />
              <span className="font-mono text-[10px] text-dim/40">Drop a video to extract frames for AI analysis.</span>
            </div>
          )}

          {/* Extraction progress */}
          {extracting && (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-5 h-5 border border-white/20 border-t-white/60 rounded-full animate-spin" />
              <span className="font-mono text-[10px] text-dim/50">
                Extracting frame {extractProgress.current} of {extractProgress.total}…
              </span>
            </div>
          )}

          {/* Frame grid */}
          {frames.length > 0 && !extracting && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="system-label">{frames.length} FRAMES</span>
                {selected.size > 0 && (
                  <button type="button" onClick={() => setSelected(new Set())}
                    className="font-mono text-[8px] text-dim/40 hover:text-dim transition-precise">
                    Clear selection
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {frames.map((frame, idx) => {
                  const isSelected = selected.has(idx);
                  return (
                    <button key={idx} type="button" onClick={() => toggleSelect(idx)}
                      className={cn(
                        "relative flex flex-col overflow-hidden rounded-sm transition-precise group",
                        isSelected ? "ring-1 ring-white/40" : "hover:ring-1 hover:ring-white/15"
                      )}>
                      <img src={frame.thumbUrl} alt={formatTime(frame.timestamp)}
                        className="w-full aspect-video object-cover" />
                      {/* Timestamp */}
                      <div className="absolute bottom-0 inset-x-0 px-1.5 py-1 bg-black/60">
                        <span className="font-mono text-[8px] text-white/60">{formatTime(frame.timestamp)}</span>
                      </div>
                      {/* Selected overlay */}
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-sm bg-white/90 flex items-center justify-center">
                          <Check size={9} className="text-black" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="flex flex-col gap-3">
              <span className="system-label">{results.length} ANALYZED</span>
              {results.map(({ frameIdx, result, error }) => (
                error ? (
                  <div key={frameIdx} className="flex items-center gap-3 p-3 rounded-sm"
                    style={{ border: "1px solid rgba(215,25,33,0.20)", background: "rgba(215,25,33,0.04)" }}>
                    <AlertTriangle size={10} className="text-red/60 shrink-0" />
                    <span className="font-mono text-[10px] text-red/70">Frame {formatTime(frames[frameIdx].timestamp)}: {error}</span>
                  </div>
                ) : (
                  <ResultCard
                    key={frameIdx}
                    frame={frames[frameIdx]}
                    result={result}
                    onImport={() => handleImport(result, frameIdx)}
                    imported={importedIds.has(frameIdx)}
                  />
                )
              ))}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
