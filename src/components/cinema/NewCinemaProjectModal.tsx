import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createCinemaProject } from "@/lib/cinemaProjects";
import { getConnectedModels, providerLabel } from "@/lib/aiConfig";
import { IMAGE_PROVIDER_OPTIONS, VIDEO_PROVIDER_OPTIONS } from "@/lib/providerParameters";
import { useToastStore } from "@/stores/useToastStore";
import { cn } from "@/lib/utils";
import type { Provider } from "@/types";

interface Props {
  onCreated: (id: string) => void;
  onClose: () => void;
}

function PickerRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | "";
  onChange: (v: T | "") => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="system-label">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(value === o.value ? "" : o.value)}
            className={cn(
              "h-8 px-3 rounded-sm font-mono text-[10px] tracking-widest uppercase transition-precise border",
              value === o.value
                ? "text-cyan border-cyan/55 bg-cyan/10"
                : "text-readable border-white/18 hover:text-white hover:border-white/30"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NewCinemaProjectModal({ onCreated, onClose }: Props) {
  const toast = useToastStore((s) => s.add);
  const [title, setTitle] = useState("");
  const [scriptModel, setScriptModel] = useState("");
  const [imageProvider, setImageProvider] = useState<Provider | "">("");
  const [videoProvider, setVideoProvider] = useState<Provider | "">("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const connectedModels = getConnectedModels();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleCreate = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const id = await createCinemaProject({
        title: title.trim(),
        script_model: scriptModel || undefined,
        image_provider: imageProvider || undefined,
        video_provider: videoProvider || undefined,
      });
      toast(`"${title.trim()}" created`, "success");
      onCreated(id);
    } catch (err) {
      console.error("createCinemaProject failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg || "Failed to create project", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.72)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex flex-col w-full max-w-lg rounded-card overflow-hidden"
        style={{ background: "var(--color-panel)", border: "var(--border-strong)" }}
      >
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "var(--border-default)" }}>
          <div className="flex flex-col gap-1">
            <span className="system-label">NEW CINEMA STUDIO PROJECT</span>
            <span className="font-mono text-[11px] text-readable">Name it, pick your models — script/assets come next.</span>
          </div>
          <button type="button" onClick={onClose} className="text-dim/40 hover:text-white transition-precise">
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-6 py-6">
          <div className="flex flex-col gap-1.5">
            <label className="system-label">TITLE</label>
            <input
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Desert Wanderer"
              className="h-10 px-3 font-sans text-[14px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none"
              style={{ border: "1px solid rgba(255,255,255,0.18)" }}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="system-label">DEFAULT AI MODEL</label>
            <span className="font-mono text-[10.5px] text-muted leading-relaxed">
              Used across Script, Assets, Scenes, and Shots — switchable per-page any time.
            </span>
            {connectedModels.length === 0 ? (
              <span className="font-mono text-[11px] text-dim/60">
                No AI models connected yet — add an API key in Settings to choose one here.
              </span>
            ) : (
              <select
                value={scriptModel}
                onChange={(e) => setScriptModel(e.target.value)}
                className="h-9 px-3 font-mono text-[12px] text-white bg-dark rounded-sm focus:outline-none"
                style={{ border: "1px solid rgba(255,255,255,0.16)" }}
              >
                <option value="">Uses your Settings default</option>
                {(["anthropic", "openai", "deepseek"] as const).map((provider) => {
                  const models = connectedModels.filter((m) => m.provider === provider);
                  if (models.length === 0) return null;
                  return (
                    <optgroup key={provider} label={providerLabel(provider)}>
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            )}
          </div>

          <PickerRow label="IMAGE MODEL (ASSETS)" options={IMAGE_PROVIDER_OPTIONS} value={imageProvider} onChange={setImageProvider} />
          <PickerRow label="VIDEO MODEL (SCENES)" options={VIDEO_PROVIDER_OPTIONS} value={videoProvider} onChange={setVideoProvider} />
        </div>

        <div className="flex items-center gap-2 px-6 py-5" style={{ borderTop: "var(--border-default)" }}>
          <Button variant="primary" size="xs" onClick={handleCreate} disabled={!title.trim() || saving}>
            {saving ? "Creating…" : "Create Project"}
          </Button>
          <Button variant="ghost" size="xs" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
