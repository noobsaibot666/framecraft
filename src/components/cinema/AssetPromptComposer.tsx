import { useRef, useState } from "react";
import { Check, ImageUp, Pencil, Sparkles, Star, Library } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { isTagTaken, updateCinemaAsset } from "@/lib/cinemaAssets";
import { draftAssetPrompt } from "@/lib/cinemaAssetPrompt";
import { createPrompt } from "@/lib/db";
import { AI_MODELS, pickAvailableModel } from "@/lib/aiConfig";
import { fileToDataUrl, validateMediaFile } from "@/lib/imageUtils";
import { thumbnailFromDataUrl } from "@/lib/fileStore";
import { useToastStore } from "@/stores/useToastStore";
import { cn, slugify } from "@/lib/utils";
import type { CinemaAsset, CinemaFolder, CinemaProject } from "@/types";

interface Props {
  asset: CinemaAsset;
  folder: CinemaFolder;
  project: CinemaProject;
  onChange: () => void;
}

export function AssetPromptComposer({ asset, folder, project, onChange }: Props) {
  const toast = useToastStore((s) => s.add);
  const [title, setTitle] = useState(asset.title);
  const [instruction, setInstruction] = useState("");
  const [promptText, setPromptText] = useState(asset.prompt_text ?? "");
  const [isPrimary, setIsPrimary] = useState(asset.is_primary);
  const [modelId] = useState(() => pickAvailableModel()?.id ?? AI_MODELS[0].id);
  const model = AI_MODELS.find((m) => m.id === modelId) ?? AI_MODELS[0];

  const [editingTag, setEditingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState(asset.tag);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [promoting, setPromoting] = useState(false);

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
      const thumb = await thumbnailFromDataUrl(dataUrl);
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

  const handleDraft = async () => {
    if (!instruction.trim()) { toast("Describe what you want first", "error"); return; }
    setDrafting(true);
    try {
      const draft = await draftAssetPrompt({
        folderKind: folder.kind,
        folderName: folder.name,
        folderDescription: folder.description,
        scriptExcerpt: project.script_content?.slice(0, 1500),
        assetTitle: title,
        instruction,
      }, model);
      setPromptText(draft);
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
      await updateCinemaAsset(asset.id, { title, prompt_text: promptText, is_primary: isPrimary });
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
        provider: project.image_provider ?? "other",
        category: "cinematic",
        prompt_text: promptText,
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
          </button>
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
        <label className="system-label">GENERATED IMAGE</label>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelected(e.target.files?.[0])} />
        {asset.file_data ? (
          <div className="flex items-center gap-3">
            <img src={asset.file_data} alt={asset.title} className="w-24 h-24 object-cover rounded-sm border border-white/12" />
            <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <ImageUp size={11} /> {uploading ? "Importing…" : "Replace Image"}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center justify-center gap-2 h-16 rounded-sm border-2 border-dashed border-white/20 hover:border-cyan/45 transition-precise font-mono text-[11px] text-readable hover:text-cyan"
          >
            <ImageUp size={13} /> {uploading ? "Importing…" : "Import generated image"}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="system-label">DESCRIBE WHAT YOU WANT</label>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder={`e.g. "Write a prompt for a character sheet of this guy, dressed as a pirate. Three views: full body front, full body back, and a close-up portrait…"`}
          rows={4}
          className="px-3 py-2 font-mono text-[12.5px] leading-relaxed text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none resize-none"
          style={{ border: "1px solid rgba(255,255,255,0.16)" }}
        />
        <Button variant="primary" size="sm" onClick={handleDraft} disabled={drafting || !instruction.trim()} className="self-start">
          <Sparkles size={11} /> {drafting ? "Drafting…" : "Generate Prompt"}
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="system-label">PROMPT</label>
        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="The finished prompt — generate one above, or write it directly."
          rows={8}
          className="px-3 py-2 font-mono text-[12.5px] leading-relaxed text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none resize-none"
          style={{ border: "1px solid rgba(255,255,255,0.16)" }}
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Asset"}
        </Button>
        <Button variant="ghost" size="sm" onClick={handlePromote} disabled={promoting || !!asset.prompt_id}>
          <Library size={11} /> {asset.prompt_id ? "In Prompt Library" : promoting ? "Promoting…" : "Promote to Library"}
        </Button>
      </div>
    </div>
  );
}
