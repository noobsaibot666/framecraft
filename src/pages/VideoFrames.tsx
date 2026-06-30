import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "react-router-dom";
import { Film, Scan, Copy, Check, AlertTriangle, ArrowRight, Tag, Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Upload, Download, Bookmark, Trash2 } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { usePromptStore } from "@/stores/usePromptStore";
import { AI_MODELS, getApiKey } from "@/lib/aiConfig";
import type { AIModel } from "@/lib/aiConfig";
import { analyzeImage } from "@/lib/analyzeImage";
import type { AnalysisResult } from "@/lib/analyzeImage";
import { buildFramePromptInput, dataUrlToBytes, frameFilename, importableFrameResults, type FrameAnalysisResult } from "@/lib/videoFrames";
import { createReference } from "@/lib/references";
import { cn } from "@/lib/utils";

// ─── Frame extraction (canvas API — no external deps) ─────────

interface ExtractedFrame {
  dataUrl: string;   // full-res PNG for API + export
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
    const objectUrl = URL.createObjectURL(file);
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
      fn();
    };

    const fail = (error: Error) => finish(() => reject(error));

    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = objectUrl;

    video.addEventListener("error", () => fail(new Error("Failed to load video. Check the file format.")));

    video.addEventListener("loadedmetadata", async () => {
      try {
        const duration = video.duration;
        if (!isFinite(duration) || duration < 0.5) {
          fail(new Error("Video too short or duration unreadable."));
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

          await new Promise<void>((res, rej) => {
            const timeout = window.setTimeout(() => {
              cleanup();
              rej(new Error(`Timed out seeking to ${formatTime(timestamp)}.`));
            }, 8000);
            const cleanup = () => {
              window.clearTimeout(timeout);
              video.removeEventListener("seeked", onSeeked);
              video.removeEventListener("error", onError);
            };
            const onSeeked = () => {
              cleanup();
              res();
            };
            const onError = () => {
              cleanup();
              rej(new Error(`Failed to seek to ${formatTime(timestamp)}.`));
            };

            video.addEventListener("seeked", onSeeked, { once: true });
            video.addEventListener("error", onError, { once: true });
            video.currentTime = Math.min(timestamp, duration - 0.1);
          });

          fullCtx.drawImage(video, 0, 0, fullCanvas.width, fullCanvas.height);
          thumbCtx.drawImage(video, 0, 0, thumbCanvas.width, thumbCanvas.height);

          frames.push({
            dataUrl:  fullCanvas.toDataURL("image/png"),
            thumbUrl: thumbCanvas.toDataURL("image/jpeg", 0.70),
            timestamp,
          });

          onProgress(i + 1, count);
        }

        finish(() => resolve(frames));
      } catch (e) {
        fail(e instanceof Error ? e : new Error("Failed to extract frames."));
      }
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
      className="flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-readable hover:text-cyan transition-precise px-3 py-2 rounded-sm"
      style={{ border: "var(--border-dim)" }}>
      {copied ? <Check size={10} className="text-cyan" /> : <Copy size={10} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function ResultCard({ frame, result, onImport, imported, disabled = false }: {
  frame: ExtractedFrame;
  result: AnalysisResult;
  onImport: () => void;
  imported: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[144px_1fr] gap-5 p-5 rounded-card"
      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
      <div className="relative">
        <img src={frame.thumbUrl} alt={formatTime(frame.timestamp)}
          className="w-full md:w-36 aspect-video object-cover rounded-sm"
          style={{ border: "1px solid rgba(215,25,33,0.24)" }} />
        <span className="absolute bottom-1 left-1 font-mono text-[10px] text-white px-2 py-1 rounded-sm"
          style={{ background: "rgba(0,0,0,0.68)" }}>
          {formatTime(frame.timestamp)}
        </span>
      </div>

      <div className="flex flex-col gap-2 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-sans text-[16px] font-semibold text-white truncate">{result.title}</span>
            <span className="font-mono text-[10px] text-amber uppercase tracking-widest">Recommended next prompt</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {result.aspect_ratio && (
                <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-1 rounded-sm text-readable"
                style={{ border: "var(--border-dim)" }}>{result.aspect_ratio}</span>
            )}
            <CopyButton text={result.suggested_prompt} />
            {imported ? (
              <span className="flex items-center gap-1 font-mono text-[8px] text-white/40"><Check size={8} /> Saved</span>
            ) : (
              <button type="button" onClick={onImport} disabled={disabled}
                className="flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-cyan hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-precise px-3 py-2 rounded-sm"
                style={{ border: "var(--border-dim)" }}>
                <ArrowRight size={8} /> Import
              </button>
            )}
          </div>
        </div>

        <p className="font-mono text-[13px] text-soft-white leading-relaxed line-clamp-3">
          {result.suggested_prompt}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="system-label text-[10px]">STYLE NOTES</span>
            <p className="font-mono text-[12px] text-readable leading-relaxed line-clamp-2">
              {result.style_notes}
            </p>
          </div>
          {result.avoidance_suggestions?.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="system-label text-[10px] text-red/75">AVOID</span>
              <div className="flex flex-wrap gap-1">
                {result.avoidance_suggestions.slice(0, 4).map((item) => (
                  <span key={item} className="font-mono text-[9px] tracking-widest uppercase px-2 py-1 rounded-sm text-red/75"
                    style={{ border: "1px solid rgba(215,25,33,0.20)" }}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {result.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 items-center">
            <Tag size={10} className="text-cyan" />
            {result.tags.map((tag) => (
              <span key={tag} className="font-mono text-[9px] tracking-widest uppercase px-2 py-1 rounded-sm text-readable"
                style={{ border: "var(--border-dim)" }}>{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

const FRAME_COUNTS = [4, 8, 12, 16] as const;

export function VideoFrames() {
  const navigate = useNavigate();
  const { create } = usePromptStore();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [selectedModel, setSelectedModel] = useState<AIModel>(AI_MODELS[0]);
  const apiKey = getApiKey(selectedModel.provider);

  // Video file state
  const [videoFile, setVideoFile]     = useState<File | null>(null);
  const [videoObjUrl, setVideoObjUrl] = useState("");

  // Player state
  const [isPlaying, setIsPlaying]   = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]     = useState(0);
  const [isMuted, setIsMuted]       = useState(false);

  // Extraction state
  const [frameCount, setFrameCount]     = useState<4 | 8 | 12 | 16>(12);
  const [extracting, setExtracting]     = useState(false);
  const [extractProgress, setExtractProgress] = useState({ current: 0, total: 0 });
  const [frames, setFrames]             = useState<ExtractedFrame[]>([]);
  const [extractError, setExtractError] = useState("");

  // Selection + analysis state
  const [selected, setSelected]         = useState<Set<number>>(new Set());
  const [analyzing, setAnalyzing]       = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ current: 0, total: 0 });
  const [results, setResults]           = useState<FrameAnalysisResult[]>([]);
  const [importedIds, setImportedIds]   = useState<Set<number>>(new Set());
  const [importingAll, setImportingAll] = useState(false);
  const [savingFrameIdx, setSavingFrameIdx] = useState<number | null>(null);
  const [savedFrameIdx, setSavedFrameIdx] = useState<number | null>(null);
  const [saveFrameError, setSaveFrameError] = useState("");
  const [savedRefFrameIdx, setSavedRefFrameIdx] = useState<number | null>(null);

  useEffect(() => () => {
    if (videoObjUrl) URL.revokeObjectURL(videoObjUrl);
  }, [videoObjUrl]);

  // Player controls
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  };
  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };
  const handleSeek = (t: number) => {
    if (videoRef.current) videoRef.current.currentTime = t;
    setCurrentTime(t);
  };
  const skip = (secs: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, v.currentTime + secs));
  };

  const captureCurrentFrame = () => {
    const v = videoRef.current;
    if (!v || !videoFile) return;

    const maxW = 1280;
    const scale = v.videoWidth > maxW ? maxW / v.videoWidth : 1;
    const fullCanvas = document.createElement("canvas");
    fullCanvas.width  = Math.round(v.videoWidth  * scale);
    fullCanvas.height = Math.round(v.videoHeight * scale);
    fullCanvas.getContext("2d")!.drawImage(v, 0, 0, fullCanvas.width, fullCanvas.height);

    const thumbScale = v.videoWidth > 160 ? 160 / v.videoWidth : 1;
    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width  = Math.round(v.videoWidth  * thumbScale);
    thumbCanvas.height = Math.round(v.videoHeight * thumbScale);
    thumbCanvas.getContext("2d")!.drawImage(v, 0, 0, thumbCanvas.width, thumbCanvas.height);

    const frame: ExtractedFrame = {
      dataUrl:   fullCanvas.toDataURL("image/png"),
      thumbUrl:  thumbCanvas.toDataURL("image/jpeg", 0.70),
      timestamp: v.currentTime,
    };
    const newIdx = frames.length;
    setFrames((prev) => [...prev, frame]);
    setSelected((prev) => new Set(prev).add(newIdx));
  };

  const removeFrame = (idx: number) => {
    setFrames((prev) => prev.filter((_, i) => i !== idx));
    setSelected((prev) => new Set([...prev]
      .filter((i) => i !== idx)
      .map((i) => i > idx ? i - 1 : i)));
    setResults((prev) => prev
      .filter((item) => item.frameIdx !== idx)
      .map((item) => ({
        ...item,
        frameIdx: item.frameIdx > idx ? item.frameIdx - 1 : item.frameIdx,
      })));
    setImportedIds((prev) => new Set([...prev]
      .filter((i) => i !== idx)
      .map((i) => i > idx ? i - 1 : i)));
  };

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    if (videoObjUrl) URL.revokeObjectURL(videoObjUrl);
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoObjUrl(url);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setFrames([]);
    setSelected(new Set());
    setResults([]);
    setImportedIds(new Set());
    setExtractError("");
    setSaveFrameError("");
    setImportingAll(false);
  }, [videoObjUrl]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/*": [".mp4", ".mov", ".webm", ".avi", ".mkv"] },
    maxFiles: 1,
    multiple: false,
    noClick: !!videoFile, // video click = play/pause; file picker via Replace button
  });

  const handleExtract = async () => {
    if (!videoFile) return;
    setExtracting(true);
    setFrames([]);
    setSelected(new Set());
    setResults([]);
    setExtractError("");
    try {
      const extracted = await extractFrames(videoFile, frameCount, (current, total) =>
        setExtractProgress({ current, total })
      );
      setFrames(extracted);
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : "Frame extraction failed.");
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
    if (selected.size > 4 && !window.confirm(`Analyze ${selected.size} frames? This can use roughly ${selected.size * 1000} image tokens with ${selectedModel.label}.`)) {
      return;
    }
    const indices = [...selected].sort((a, b) => a - b);
    setAnalyzing(true);
    setResults([]);
    setImportedIds(new Set());
    setAnalyzeProgress({ current: 0, total: indices.length });
    const out: FrameAnalysisResult[] = [];
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      const frame = frames[idx];
      const base64 = frame.dataUrl.split(",")[1];
      try {
        const result = await analyzeImage(base64, "image/png", selectedModel);
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
    await create(buildFramePromptInput(result, frames[frameIdx].dataUrl));
    setImportedIds((prev) => new Set(prev).add(frameIdx));
  };

  const handleImportAll = async () => {
    if (importingAll) return;
    setImportingAll(true);
    try {
      const pending = importableFrameResults(results, importedIds);
      for (const item of pending) {
        await handleImport(item.result, item.frameIdx);
      }
    } finally {
      setImportingAll(false);
    }
  };

  const handleSaveFrame = async (frame: ExtractedFrame, frameIdx: number) => {
    if (!videoFile) return;
    setSavingFrameIdx(frameIdx);
    setSaveFrameError("");
    try {
      const [{ save }, { writeFile }] = await Promise.all([
        import("@tauri-apps/plugin-dialog"),
        import("@tauri-apps/plugin-fs"),
      ]);
      const path = await save({
        defaultPath: frameFilename(videoFile.name, frame.timestamp),
        filters: [{ name: "PNG Image", extensions: ["png"] }],
      });
      if (!path) return;
      await writeFile(path, dataUrlToBytes(frame.dataUrl));
      setSavedFrameIdx(frameIdx);
      setTimeout(() => setSavedFrameIdx(null), 1800);
    } catch (e) {
      setSaveFrameError(e instanceof Error ? e.message : "Failed to save frame.");
    } finally {
      setSavingFrameIdx(null);
    }
  };

  const handleSaveFrameAsRef = async (frame: ExtractedFrame, frameIdx: number) => {
    const img = new Image();
    img.onload = async () => {
      const MAX = 400;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      await createReference({
        title: `Frame @ ${formatTime(frame.timestamp)}`,
        kind: "frame",
        file_data: frame.dataUrl,
        thumbnail_data: canvas.toDataURL("image/jpeg", 0.75),
        notes: videoFile?.name,
      });
      setSavedRefFrameIdx(frameIdx);
      setTimeout(() => setSavedRefFrameIdx(null), 1800);
    };
    img.src = frame.dataUrl;
  };

  const unsavedImportCount = importableFrameResults(results, importedIds).length;

  return (
    <PageContainer title="Video Frames" subtitle="FRAME EXTRACTION + AI PROMPT RECONSTRUCTION">
      <div className="flex flex-col gap-6">

        {/* ── Video preview — full width, big ── */}
        <div {...getRootProps()}
          className={cn(
            "relative w-full max-h-[560px] rounded-card overflow-hidden cursor-pointer transition-precise",
            !videoFile && "flex flex-col items-center justify-center gap-4",
            isDragActive ? "bg-cyan/8" : !videoFile && "hover:border-cyan/40"
          )}
          style={{
            aspectRatio: "16 / 9",
            border: isDragActive
              ? "1px solid rgba(255,255,255,0.30)"
              : videoFile
                ? "1px solid rgba(255,255,255,0.08)"
                : "var(--border-default)",
          }}>
          <input {...getInputProps()} />
          {videoFile ? (
            <>
              <video
                ref={videoRef}
                src={videoObjUrl}
                muted={isMuted}
                playsInline
                className="w-full h-full max-h-[520px] object-contain bg-black cursor-pointer"
                onClick={togglePlay}
                onTimeUpdate={(e) => setCurrentTime((e.currentTarget as HTMLVideoElement).currentTime)}
                onLoadedMetadata={(e) => setDuration((e.currentTarget as HTMLVideoElement).duration)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />
              {/* Play/Pause overlay — shown briefly on toggle */}
              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.15)" }}>
                    <Play size={22} className="text-white ml-1" />
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
                <Film size={36} className="text-cyan" />
              <div className="flex flex-col items-center gap-1.5">
                <span className="font-mono text-[14px] text-soft-white">Drop video here or click to browse</span>
                <span className="font-mono text-[12px] text-readable">MP4 · MOV · WEBM · AVI · MKV</span>
              </div>
            </>
          )}

          {/* Extraction progress overlay */}
          {extracting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
              style={{ background: "rgba(0,0,0,0.75)" }}>
              <div className="w-6 h-6 border border-white/20 border-t-white/70 rounded-full animate-spin" />
              <span className="font-mono text-[14px] text-white">
                Extracting frame {extractProgress.current} of {extractProgress.total}...
              </span>
              {extractProgress.total > 0 && (
                <div className="w-48 h-px bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-white/40 transition-all"
                    style={{ width: `${(extractProgress.current / extractProgress.total) * 100}%` }} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Player controls ── */}
        {videoFile && (
          <div className="flex items-center gap-4 px-4 py-3 rounded-card overflow-x-auto"
            style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>

            {/* Skip back */}
            <button type="button" onClick={() => skip(-5)}
              className="text-readable hover:text-cyan transition-precise shrink-0" title="-5s">
              <SkipBack size={16} />
            </button>

            {/* Play / Pause */}
            <button type="button" onClick={togglePlay}
              className="text-cyan hover:text-white transition-precise shrink-0">
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            {/* Skip forward */}
            <button type="button" onClick={() => skip(5)}
              className="text-readable hover:text-cyan transition-precise shrink-0" title="+5s">
              <SkipForward size={16} />
            </button>

            {/* Scrubber */}
            <div className="flex-1 flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.05}
                value={currentTime}
                onChange={(e) => handleSeek(Number(e.target.value))}
                className="w-full h-0.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, rgba(255,255,255,0.75) ${duration ? (currentTime / duration) * 100 : 0}%, rgba(255,255,255,0.12) 0%)`,
                  accentColor: "white",
                }}
              />
            </div>

            {/* Time */}
            <span className="font-mono text-[12px] text-readable shrink-0 tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Capture current frame */}
            <button type="button" onClick={captureCurrentFrame}
              disabled={!videoFile || duration === 0}
              className="flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-amber hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-precise shrink-0 px-3 py-2 rounded-sm"
              style={{ border: "1px solid rgba(215,25,33,0.35)", background: "rgba(215,25,33,0.08)" }}
              title={`Capture frame at ${formatTime(currentTime)}`}>
              + Frame
            </button>

            {/* Mute */}
            <button type="button" onClick={toggleMute}
              className="text-readable hover:text-cyan transition-precise shrink-0">
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>

            <div className="w-px h-4 bg-white/10 shrink-0" />

            {/* Replace video */}
            <label className="flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-readable hover:text-cyan transition-precise cursor-pointer shrink-0 px-3 py-2 rounded-sm"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <Upload size={11} /> Replace
              <input type="file" accept="video/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onDrop([f]);
              }} />
            </label>
          </div>
        )}

        {/* ── Action controls bar ── */}
        <div className="flex items-center gap-4 flex-wrap py-1">
          {/* Filename */}
          {videoFile && (
            <span className="font-mono text-[12px] text-readable truncate max-w-72">
              {videoFile.name}
            </span>
          )}

          {videoFile && <div className="w-px h-4 bg-white/10" />}

          {/* Frame count */}
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] tracking-widest uppercase text-readable">FRAMES</span>
            <div className="flex gap-1">
              {FRAME_COUNTS.map((n) => (
                <button key={n} type="button" onClick={() => setFrameCount(n)}
                  className={cn(
                    "w-10 py-2 font-mono text-[12px] rounded-sm transition-precise",
                    frameCount === n ? "text-white" : "text-readable hover:text-cyan"
                  )}
                  style={{ border: frameCount === n ? "1px solid rgba(255,255,255,0.20)" : "1px solid rgba(255,255,255,0.06)" }}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={handleExtract}
            disabled={!videoFile || extracting}>
            {extracting ? "Extracting…" : "Extract Frames"}
          </Button>

          <div className="flex-1" />

          {/* API key warning (compact) */}
          {frames.length > 0 && !apiKey && (
            <button type="button" onClick={() => navigate("/settings")}
              className="flex items-center gap-2 font-mono text-[12px] text-red/80 hover:text-red transition-precise">
              <AlertTriangle size={9} /> No {selectedModel.provider} key — Settings
            </button>
          )}

          {/* Model select */}
          {frames.length > 0 && (
            <div className="relative">
              <select
                value={selectedModel.id}
                onChange={(e) => setSelectedModel(AI_MODELS.find((m) => m.id === e.target.value) ?? AI_MODELS[0])}
                className="accent-selected appearance-none h-9 pl-3 pr-8 font-mono text-[12px] text-soft-white bg-dark rounded-sm focus:outline-none cursor-pointer transition-precise">
                <optgroup label="Anthropic">
                  {AI_MODELS.filter((m) => m.provider === "anthropic").map((m) => (
                    <option key={m.id} value={m.id} className="bg-panel">{m.label}</option>
                  ))}
                </optgroup>
                <optgroup label="OpenAI">
                  {AI_MODELS.filter((m) => m.provider === "openai").map((m) => (
                    <option key={m.id} value={m.id} className="bg-panel">{m.label}</option>
                  ))}
                </optgroup>
              </select>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-dim/40 pointer-events-none text-[8px]">▾</span>
            </div>
          )}

          {/* Analyze button */}
          {frames.length > 0 && (
            <Button variant="primary" size="sm" onClick={handleAnalyze}
              disabled={!selected.size || !apiKey || analyzing}>
              <Scan size={10} />
              {analyzing
                ? `Analyzing ${analyzeProgress.current}/${analyzeProgress.total}…`
                : selected.size
                  ? `Analyze Selected (${selected.size})`
                  : "Select frames"}
            </Button>
          )}
        </div>

        {(extractError || saveFrameError) && (
          <div className="flex items-start gap-2 p-3 rounded-sm"
            style={{ border: "1px solid rgba(215,25,33,0.22)", background: "rgba(215,25,33,0.04)" }}>
            <AlertTriangle size={10} className="text-red/60 shrink-0 mt-0.5" />
            <span className="font-mono text-[13px] text-red/80">
              {extractError || saveFrameError}
            </span>
          </div>
        )}

        {/* ── Frame grid ── */}
        {frames.length > 0 && !extracting && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="system-label text-readable">{frames.length} FRAMES · click to select</span>
              {selected.size > 0 && (
                <button type="button" onClick={() => setSelected(new Set())}
                  className="font-mono text-[10px] text-readable hover:text-cyan transition-precise">
                  Clear selection ({selected.size})
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {frames.map((frame, idx) => {
                const isSelected = selected.has(idx);
                return (
                  <div key={idx}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSelect(idx)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSelect(idx);
                      }
                    }}
                    className={cn(
                      "relative overflow-hidden rounded-sm transition-precise cursor-pointer focus:outline-none",
                      isSelected ? "ring-1 ring-red/70" : "hover:ring-1 hover:ring-white/15"
                    )}
                    style={{
                      border: isSelected ? "1px solid rgba(215,25,33,0.68)" : "1px solid rgba(255,255,255,0.06)",
                      boxShadow: isSelected ? "0 0 0 1px rgba(215,25,33,0.28)" : "none",
                    }}>
                    <img src={frame.thumbUrl} alt={formatTime(frame.timestamp)}
                      className="w-full aspect-video object-cover block" />
                    <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); handleSaveFrame(frame, idx); }}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-sm font-mono text-[9px] tracking-widest uppercase text-white hover:text-cyan transition-precise"
                        style={{ background: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,255,255,0.12)" }}
                        title="Save frame as PNG">
                        {savedFrameIdx === idx ? <Check size={8} /> : <Download size={8} />}
                        {savingFrameIdx === idx ? "Saving" : savedFrameIdx === idx ? "Saved" : "PNG"}
                      </button>
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); handleSaveFrameAsRef(frame, idx); }}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-sm font-mono text-[9px] tracking-widest uppercase text-white hover:text-cyan transition-precise"
                        style={{ background: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,255,255,0.12)" }}
                        title="Save frame as Reference">
                        {savedRefFrameIdx === idx ? <Check size={8} /> : <Bookmark size={8} />}
                        {savedRefFrameIdx === idx ? "Saved" : "Ref"}
                      </button>
                    </div>
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); removeFrame(idx); }}
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-sm flex items-center justify-center text-white/65 hover:text-white transition-precise"
                      style={{ background: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,255,255,0.12)" }}
                      title="Remove frame">
                      <Trash2 size={10} />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 px-2 py-1"
                      style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}>
                      <span className="font-mono text-[12px] text-white">{formatTime(frame.timestamp)}</span>
                    </div>
                    {isSelected && (
                      <div className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-sm flex items-center justify-center"
                        style={{ background: "rgba(215,25,33,0.92)" }}>
                        <Check size={11} className="text-white" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {results.length > 0 && (
          <div className="flex flex-col gap-3 mt-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="system-label text-readable">{results.length} ANALYZED</span>
              {unsavedImportCount > 0 && (
                <Button variant="ghost" size="sm" onClick={handleImportAll} disabled={importingAll}>
                  <ArrowRight size={10} /> {importingAll ? "Importing..." : `Import All Analyzed (${unsavedImportCount})`}
                </Button>
              )}
            </div>
            {results.map(({ frameIdx, result, error }) => (
              error ? (
                <div key={frameIdx} className="flex items-center gap-3 p-3 rounded-sm"
                  style={{ border: "1px solid rgba(215,25,33,0.20)", background: "rgba(215,25,33,0.04)" }}>
                  <AlertTriangle size={10} className="text-red/60 shrink-0" />
                  <span className="font-mono text-[13px] text-red/80">
                    Frame {formatTime(frames[frameIdx].timestamp)}: {error}
                  </span>
                </div>
              ) : (
                <ResultCard
                  key={frameIdx}
                  frame={frames[frameIdx]}
                  result={result}
                  onImport={() => handleImport(result, frameIdx)}
                  imported={importedIds.has(frameIdx)}
                  disabled={importingAll}
                />
              )
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
