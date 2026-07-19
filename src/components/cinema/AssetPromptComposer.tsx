import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, Copy, GitFork, ImageUp, Lock, Pencil, Sparkles, Star, Library, Unlink, Unlock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { RatingDisplay } from "@/components/ui/RatingDisplay";
import { AssetParametersPanel } from "./AssetParametersPanel";
import { createAssetVersion, getPreviousVersion, isTagTaken, updateCinemaAsset } from "@/lib/cinemaAssets";
import { draftAssetPrompt } from "@/lib/cinemaAssetPrompt";
import { copyToClipboard } from "@/lib/cinemaExport";
import { createPrompt } from "@/lib/db";
import { AI_MODELS, resolveModelPreference, type AIQuality } from "@/lib/aiConfig";
import { getPreferences } from "@/lib/userPreferences";
import { ModelSelector } from "@/components/ui/ModelSelector";
import { QualitySelector } from "@/components/ui/QualitySelector";
import { IMAGE_PROVIDER_OPTIONS, formatPromptWithParameters } from "@/lib/providerParameters";
import { fileToDataUrl, validateMediaFile } from "@/lib/imageUtils";
import { thumbnailFromDataUrl } from "@/lib/fileStore";
import { useToastStore } from "@/stores/useToastStore";
import { cn, slugify } from "@/lib/utils";
import type { CinemaAsset, CinemaFolder, CinemaProject, Provider } from "@/types";

interface Props {
  asset: CinemaAsset;
  folder: CinemaFolder;
  project: CinemaProject;
  onChange: () => void;
  /** Selects a different asset in the parent's folder view — used after "New Version" to jump straight to the fresh draft. */
  onSelectAsset: (assetId: string) => void;
}

export function AssetPromptComposer({ asset, folder, project, onChange, onSelectAsset }: Props) {
  const toast = useToastStore((s) => s.add);
  const [title, setTitle] = useState(asset.title);
  const [instruction, setInstruction] = useState(asset.instruction ?? "");
  const [promptText, setPromptText] = useState(asset.prompt_text ?? "");
  const [isPrimary, setIsPrimary] = useState(asset.is_primary);
  const [provider, setProvider] = useState<Provider>(asset.provider ?? project.image_provider ?? "midjourney");
  const [parameters, setParameters] = useState(asset.prompt_parameters);
  const [draftNonce, setDraftNonce] = useState(0);
  const [bypassContext, setBypassContext] = useState(false);
  const [rating, setRating] = useState(asset.rating);
  const [feedback, setFeedback] = useState(asset.feedback ?? "");
  const [modelId, setModelId] = useState(() => resolveModelPreference(project.script_model)?.id ?? AI_MODELS[0].id);
  const [quality, setQuality] = useState<AIQuality>(() => getPreferences().defaultAiQuality);
  const model = AI_MODELS.find((m) => m.id === modelId) ?? AI_MODELS[0];

  const [editingTag, setEditingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState(asset.tag);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [autosaved, setAutosaved] = useState(false);
  const hydratedRef = useRef(false);

  // Silent debounced autosave — edits are no longer lost if the user
  // navigates away (e.g. back to Script Studio) without clicking Save Asset.
  // Skips the first run (component mount) so it doesn't re-save unchanged data.
  useEffect(() => {
    if (!hydratedRef.current) { hydratedRef.current = true; return; }
    const timer = window.setTimeout(() => {
      updateCinemaAsset(asset.id, {
        title, prompt_text: promptText, is_primary: isPrimary, instruction,
        provider, prompt_parameters: parameters, rating, feedback,
      })
        .then(() => {
          onChange();
          setAutosaved(true);
          window.setTimeout(() => setAutosaved(false), 1200);
        })
        .catch(() => toast("Failed to autosave asset", "error"));
    }, 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, promptText, isPrimary, instruction, provider, parameters, rating, feedback]);

  const handleSaveTag = async () => {
    const normalized = tagDraft.trim().replace(/^@/, "");
    if (!normalized) { toast("Tag can't be empty", "error"); return; }
    const candidate = `@${slugify(normalized)}`;
    if (candidate !== asset.tag && await isTagTaken(asset.project_id, candidate, asset.id)) {
      toast(`${candidate} is already used by another asset in this project`, "error");
      return;
    }
    try {
      await updateCinemaAsset(asset.id, { tag: candidate });
      setEditingTag(false);
      onChange();
      toast("Tag updated", "success");
    } catch {
      toast("Failed to update tag", "error");
    }
  };

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      await validateMediaFile(file);
      const dataUrl = await fileToDataUrl(file);
      // 640px (not the 320px default) — this thumbnail is displayed fairly large across
      // Cinema Studio (project cover, moodboard cards at higher zoom), and 320px was
      // visibly soft/upscaled at those sizes.
      const thumb = await thumbnailFromDataUrl(dataUrl, 640);
      await updateCinemaAsset(asset.id, { file_data: dataUrl, thumbnail_data: thumb });
      onChange();
      toast("Image imported", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to import image", "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFileSelected(e.dataTransfer.files[0]);
  };

  const handleDraft = async () => {
    if (!instruction.trim()) { toast("Describe what you want first", "error"); return; }
    setDrafting(true);
    try {
      const previous = bypassContext ? undefined : await getPreviousVersion(asset);
      const draft = await draftAssetPrompt({
        folderKind: folder.kind,
        folderName: folder.name,
        folderDescription: folder.description,
        scriptExcerpt: project.script_content?.slice(0, 1500),
        assetTitle: title,
        instruction,
        provider,
        bypassContext,
        previousAttempt: previous?.prompt_text
          ? { promptText: previous.prompt_text, rating: previous.rating, feedback: previous.feedback }
          : undefined,
      }, model, quality);
      setPromptText(draft.promptText);
      setParameters(draft.parameters);
      setDraftNonce((n) => n + 1);
      // Persisted immediately (not left to the debounce) so the prompt is
      // there to copy right away — this is a deliberate, infrequent action,
      // not keystroke noise.
      await updateCinemaAsset(asset.id, { prompt_text: draft.promptText, prompt_parameters: draft.parameters ?? null, provider, instruction });
      onChange();
      toast("Prompt drafted", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to draft prompt", "error");
    } finally {
      setDrafting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCinemaAsset(asset.id, {
        title, prompt_text: promptText, is_primary: isPrimary, instruction,
        provider, prompt_parameters: parameters, rating, feedback,
      });
      onChange();
      toast("Asset saved", "success");
    } catch {
      toast("Failed to save asset", "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePromote = async () => {
    if (!promptText.trim()) { toast("Nothing to promote yet — draft or write a prompt first", "error"); return; }
    setPromoting(true);
    try {
      const promptId = await createPrompt({
        title: `${asset.tag} — ${title}`,
        provider: provider,
        category: "cinematic",
        prompt_text: promptText,
        parameters,
        tags: ["cinema-studio", folder.kind],
        notes: `Cinema Studio asset for "${project.title}" / ${folder.name}.`,
      });
      await updateCinemaAsset(asset.id, { prompt_id: promptId });
      onChange();
      toast("Promoted to Prompt Library — full versioning and rating now available", "success");
    } catch {
      toast("Failed to promote prompt", "error");
    } finally {
      setPromoting(false);
    }
  };

  const handleCopyPrompt = async () => {
    if (!promptText.trim()) return;
    try {
      await copyToClipboard(formatPromptWithParameters(provider, promptText, parameters));
      toast("Prompt copied", "success");
    } catch {
      toast("Failed to copy prompt", "error");
    }
  };

  const handleNewVersion = async () => {
    setCreatingVersion(true);
    try {
      // Persist current edits first so the new version carries forward the
      // instruction/provider the user actually landed on, not a stale save.
      await updateCinemaAsset(asset.id, { title, instruction, provider, rating, feedback });
      const newId = await createAssetVersion({ ...asset, title, instruction, provider });
      onChange();
      onSelectAsset(newId);
      toast(`New version created`, "success");
    } catch {
      toast("Failed to create a new version", "error");
    } finally {
      setCreatingVersion(false);
    }
  };

  const handleToggleLock = async () => {
    try {
      await updateCinemaAsset(asset.id, { locked: !asset.locked });
      onChange();
      toast(asset.locked ? "Asset unlocked" : "Asset locked — approved for the Moodboard sequence", "success");
    } catch {
      toast("Failed to update lock state", "error");
    }
  };

  return (
    <div className="flex flex-col gap-4 p-5 rounded-card" style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
      <div className="flex items-center justify-between">
        {editingTag ? (
          <div className="flex items-center gap-1.5">
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              autoFocus
              className="h-7 px-2 font-mono text-[11px] text-white bg-transparent rounded-sm focus:outline-none w-40"
              style={{ border: "1px solid rgba(255,255,255,0.2)" }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveTag(); if (e.key === "Escape") { setEditingTag(false); setTagDraft(asset.tag); } }}
            />
            <button type="button" onClick={handleSaveTag} className="text-cyan hover:text-white transition-precise"><Check size={12} /></button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setTagDraft(asset.tag); setEditingTag(true); }}
            className="flex items-center gap-1.5 font-mono text-[11px] text-cyan tracking-widest uppercase hover:text-white transition-precise group"
          >
            {asset.tag} <Pencil size={9} className="opacity-0 group-hover:opacity-100 transition-precise" />
            {asset.version_number > 1 && <span className="text-muted">V{asset.version_number}</span>}
          </button>
        )}
        <div className="flex items-center gap-3">
          {asset.locked && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-cyan tracking-widest uppercase">
              <Lock size={10} /> Locked
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsPrimary((v) => !v)}
            className={cn("flex items-center gap-1 font-mono text-[10px] tracking-widest uppercase transition-precise", isPrimary ? "text-amber" : "text-muted hover:text-amber")}
            title="Mark as the primary reference for this folder"
          >
            <Star size={11} fill={isPrimary ? "currentColor" : "none"} /> Primary
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="system-label">TITLE</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-9 px-3 font-sans text-[14px] text-white bg-transparent rounded-sm focus:outline-none"
          style={{ border: "1px solid rgba(255,255,255,0.16)" }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="system-label">DESCRIBE WHAT YOU WANT</label>
          <div className="flex flex-col gap-1 items-end">
            <span className="font-mono text-[9px] text-muted tracking-widest uppercase">Target provider</span>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as Provider)}
              className="h-7 px-2 font-mono text-[10.5px] text-white bg-dark rounded-sm focus:outline-none"
              style={{ border: "1px solid rgba(255,255,255,0.16)" }}
            >
              {IMAGE_PROVIDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder={`e.g. "Write a prompt for a character sheet of this guy, dressed as a pirate. Three views: full body front, full body back, and a close-up portrait…"`}
          rows={8}
          className="px-3 py-2 font-mono text-[12.5px] leading-relaxed text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none resize-none"
          style={{ border: "1px solid rgba(255,255,255,0.16)" }}
        />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setBypassContext((v) => !v)}
            title="Send only the text typed above — skip the script excerpt and folder guidance the AI normally gets as context"
            className={cn(
              "flex items-center gap-1 h-7 px-2 rounded-sm font-mono text-[9.5px] tracking-widest uppercase transition-precise",
              bypassContext ? "text-cyan border border-cyan/50 bg-cyan/10" : "text-muted border border-white/16 hover:text-cyan hover:border-cyan/40"
            )}
          >
            <Unlink size={10} /> Exact Text Only
          </button>
          <div className="flex-1" />
          <ModelSelector value={modelId} onChange={setModelId} />
          <QualitySelector value={quality} onChange={setQuality} />
          <Button variant="primary" size="xs" onClick={handleDraft} disabled={drafting || !instruction.trim()}>
            <Sparkles size={11} /> {drafting ? "Drafting…" : "Generate Prompt"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="system-label">PROMPT</label>
          <button
            type="button"
            onClick={handleCopyPrompt}
            disabled={!promptText.trim()}
            className="flex items-center gap-1 font-mono text-[9.5px] text-muted hover:text-cyan tracking-widest uppercase transition-precise disabled:opacity-30"
          >
            <Copy size={10} /> Copy
          </button>
        </div>
        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="The finished prompt — generate one above, or write it directly."
          rows={8}
          className="px-3 py-2 font-mono text-[12.5px] leading-relaxed text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none resize-none"
          style={{ border: "1px solid rgba(255,255,255,0.16)" }}
        />
      </div>

      <AssetParametersPanel key={draftNonce} provider={provider} parameters={parameters} onChange={setParameters} promptText={promptText} />

      <div className="flex flex-col gap-1.5">
        <label className="system-label">GENERATED IMAGE</label>
        <span className="font-mono text-[10.5px] text-muted -mt-0.5">
          Take the prompt above to your image generator, then import the result here.
        </span>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelected(e.target.files?.[0])} />
        {asset.file_data ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "flex items-center gap-3 p-2 -m-2 rounded-sm transition-precise",
              dragging && "bg-cyan/8 ring-1 ring-cyan/50"
            )}
          >
            <img src={asset.file_data} alt={asset.title} className="w-24 h-24 object-cover rounded-sm border border-white/12" />
            <Button variant="ghost" size="xs" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <ImageUp size={11} /> {uploading ? "Importing…" : "Replace Image"}
            </Button>
            <span className="font-mono text-[10px] text-dim/60">or drop a new image here</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            disabled={uploading}
            className={cn(
              "flex items-center justify-center gap-2 h-16 rounded-sm border-2 border-dashed transition-precise font-mono text-[11px]",
              dragging ? "border-cyan/60 bg-cyan/8 text-cyan" : "border-white/20 text-readable hover:border-cyan/45 hover:text-cyan"
            )}
          >
            <ImageUp size={13} /> {uploading ? "Importing…" : dragging ? "Drop here" : "Import generated image, or drag one in"}
          </button>
        )}
      </div>

      {asset.file_data && (
        <div className="flex flex-col gap-2 p-3 rounded-sm" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="flex items-center justify-between">
            <span className="system-label text-[10px]">RATE THIS RESULT</span>
            <RatingDisplay value={rating ?? 0} onChange={setRating} size="sm" />
          </div>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What would you change? (fed into the next version's redraft)"
            rows={2}
            className="px-2.5 py-2 font-mono text-[11px] leading-relaxed text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none resize-none"
            style={{ border: "1px solid rgba(255,255,255,0.14)" }}
          />
          <div className="flex items-center justify-end">
            <Button variant="ghost" size="xs" onClick={handleNewVersion} disabled={creatingVersion}>
              <GitFork size={11} /> {creatingVersion ? "Creating…" : `New Version (V${asset.version_number + 1})`}
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        {autosaved && (
          <span className="flex items-center gap-1 font-mono text-[10px] text-cyan tracking-widest uppercase">
            <CheckCircle2 size={11} /> Autosaved
          </span>
        )}
        <Button variant="ghost" size="xs" onClick={handlePromote} disabled={promoting || !!asset.prompt_id}>
          <Library size={11} /> {asset.prompt_id ? "In Prompt Library" : promoting ? "Promoting…" : "Promote to Library"}
        </Button>
        <Button variant={asset.locked ? "muted" : "accent"} size="xs" onClick={handleToggleLock}>
          {asset.locked ? <Unlock size={11} /> : <Lock size={11} />} {asset.locked ? "Unlock" : "Lock Asset"}
        </Button>
        <Button variant="primary" size="xs" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Asset"}
        </Button>
      </div>
    </div>
  );
}
