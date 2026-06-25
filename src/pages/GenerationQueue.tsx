import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Copy, ExternalLink, GripVertical, Plus, SkipForward, Upload, X } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Badge, ProviderBadge } from "@/components/ui/Badge";
import { usePromptStore } from "@/stores/usePromptStore";
import {
  addToQueue,
  clearDone,
  getQueue,
  reorderQueue,
  updateQueueStatus,
  type QueueItem,
  type QueueStatus,
} from "@/lib/queue";
import { fileToDataUrl, importQueueResult, matchQueueFiles } from "@/lib/queueImport";
import { cn } from "@/lib/utils";
import type { Prompt } from "@/types";

const STATUS_LABELS: Record<QueueStatus, string> = {
  pending: "Pending",
  sent: "Sent",
  done: "Done",
  failed: "Failed",
  skipped: "Skipped",
};

function providerUrl(prompt: Prompt | undefined): string {
  switch (prompt?.provider) {
    case "midjourney": return "https://www.midjourney.com/imagine";
    case "dalle": return "https://chatgpt.com/";
    case "firefly": return "https://firefly.adobe.com/";
    case "ideogram": return "https://ideogram.ai/";
    case "flux": return "https://fal.ai/models/flux";
    default: return "https://www.google.com/search?q=AI+image+generator";
  }
}

function statusClass(status: QueueStatus): string {
  if (status === "pending") return "text-amber border-amber/45";
  if (status === "sent") return "text-cyan border-cyan/40";
  if (status === "done") return "text-white border-white/35";
  if (status === "failed") return "text-red border-red/50";
  return "text-muted border-white/18";
}

function QueueCard({
  item,
  prompt,
  onCopy,
  onStatus,
  onImport,
}: {
  item: QueueItem;
  prompt?: Prompt;
  onCopy: () => void;
  onStatus: (status: QueueStatus) => void;
  onImport: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, border: "var(--border-default)", background: "var(--surface-card)" }}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-4 p-5 rounded-card"
    >
      <button
        type="button"
        className="text-muted hover:text-cyan transition-precise cursor-grab active:cursor-grabbing pt-1"
        {...attributes}
        {...listeners}
        aria-label="Drag queue item"
      >
        <GripVertical size={14} />
      </button>

      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-sans text-[15px] text-white font-semibold truncate">
            {prompt?.title ?? item.prompt_title ?? item.prompt_id}
          </span>
          {prompt?.provider && <ProviderBadge provider={prompt.provider} />}
          <span
            className={cn("font-mono text-[9px] tracking-widest uppercase px-2 py-1 rounded-sm border", statusClass(item.status))}
          >
            {STATUS_LABELS[item.status]}
          </span>
        </div>
        <p className="font-mono text-[12px] text-readable leading-relaxed line-clamp-2">
          {prompt?.prompt_text ?? item.prompt_text ?? "Prompt not loaded in dev store."}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button type="button" onClick={onCopy} className="p-2 rounded-sm text-readable hover:text-cyan transition-precise" title="Copy prompt">
          <Copy size={12} />
        </button>
        <button type="button" onClick={() => { window.open(providerUrl(prompt), "_blank"); onStatus("sent"); }}
          className="p-2 rounded-sm text-readable hover:text-cyan transition-precise" title={`Open in ${prompt?.provider ?? "provider"}`}>
          <ExternalLink size={12} />
        </button>
        <button type="button" onClick={onImport} className="p-2 rounded-sm text-readable hover:text-cyan transition-precise" title="Import result">
          <Upload size={12} />
        </button>
        <button type="button" onClick={() => onStatus("done")} className="p-2 rounded-sm text-readable hover:text-cyan transition-precise" title="Mark done">
          <Check size={12} />
        </button>
        <button type="button" onClick={() => onStatus("skipped")} className="p-2 rounded-sm text-readable hover:text-cyan transition-precise" title="Skip">
          <SkipForward size={12} />
        </button>
      </div>
    </div>
  );
}

export function GenerationQueue() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project") ?? undefined;
  const { prompts, fetchPrompts } = usePromptStore();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [singleImportId, setSingleImportId] = useState<string | null>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);
  const singleFileRef = useRef<HTMLInputElement>(null);

  const promptMap = useMemo(() => new Map(prompts.map((prompt) => [prompt.id, prompt])), [prompts]);
  const pending = items.filter((item) => item.status === "pending");

  const refresh = async () => {
    const [queue] = await Promise.all([getQueue(projectId), fetchPrompts()]);
    setItems(queue);
  };

  useEffect(() => { refresh(); }, [projectId]);

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    const oldIndex = items.findIndex((item) => item.id === event.active.id);
    const newIndex = items.findIndex((item) => item.id === event.over?.id);
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    await reorderQueue(next.map((item) => item.id));
  };

  const handleAddSelected = async () => {
    for (const promptId of selected) await addToQueue(promptId, projectId);
    setSelected(new Set());
    setShowAdd(false);
    await refresh();
  };

  const copyAllPending = async () => {
    const text = pending
      .map((item) => promptMap.get(item.prompt_id)?.prompt_text ?? item.prompt_text)
      .filter(Boolean)
      .join("\n\n---\n\n");
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const withPromptData = (item: QueueItem): QueueItem => {
    const prompt = promptMap.get(item.prompt_id);
    return {
      ...item,
      provider: item.provider ?? prompt?.provider,
      prompt_title: item.prompt_title ?? prompt?.title,
      prompt_text: item.prompt_text ?? prompt?.prompt_text,
    };
  };

  const handleSingleImport = async (files: FileList | null) => {
    const file = files?.[0];
    const item = items.find((entry) => entry.id === singleImportId);
    setSingleImportId(null);
    if (!file || !item) return;

    try {
      setImportError(null);
      await importQueueResult(withPromptData(item), await fileToDataUrl(file));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Import failed");
    } finally {
      if (singleFileRef.current) singleFileRef.current.value = "";
      await refresh();
    }
  };

  const handleBulkImport = async (files: FileList | null) => {
    if (!files?.length) return;
    const fileList = Array.from(files);
    const matches = matchQueueFiles(items.map(withPromptData), fileList);

    try {
      setImportError(null);
      for (const match of matches.matched) {
        await importQueueResult(match.item, await fileToDataUrl(match.file));
      }
      if (matches.unmatched.length > 0) {
        setImportError(`${matches.unmatched.length} file${matches.unmatched.length === 1 ? "" : "s"} did not match queued prompts.`);
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Import failed");
    } finally {
      if (bulkFileRef.current) bulkFileRef.current.value = "";
      await refresh();
    }
  };

  return (
    <PageContainer
      title="Generation Queue"
      subtitle={projectId ? "PROJECT FILTER ACTIVE" : "PENDING PROMPT BATCH"}
      action={
        <div className="flex items-center gap-2">
          <input
            ref={bulkFileRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(event) => handleBulkImport(event.target.files)}
          />
          <input
            ref={singleFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handleSingleImport(event.target.files)}
          />
          <Button variant="ghost" size="md" onClick={() => bulkFileRef.current?.click()}>
            <Upload size={11} /> Bulk Import
          </Button>
          <Button variant="ghost" size="md" onClick={copyAllPending} disabled={pending.length === 0}>
            <Copy size={11} /> {copied ? "Copied" : "Copy Pending"}
          </Button>
          <Button variant="ghost" size="md" onClick={async () => { await clearDone(); await refresh(); }}>
            Clear Done
          </Button>
          <Button variant="primary" size="md" onClick={() => setShowAdd(true)}>
            <Plus size={11} /> Add Prompts
          </Button>
        </div>
      }
    >
      {showAdd && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="w-[640px] max-h-[72vh] flex flex-col gap-4 p-6 rounded-card" style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
            <div className="flex items-center justify-between">
              <span className="system-label">ADD PROMPTS</span>
              <button type="button" className="text-muted hover:text-white" onClick={() => setShowAdd(false)}><X size={14} /></button>
            </div>
            <div className="overflow-auto flex flex-col gap-1 pr-1">
              {prompts.map((prompt) => (
                <label key={prompt.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center p-3 rounded-sm cursor-pointer hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={selected.has(prompt.id)}
                    onChange={(event) => {
                      const next = new Set(selected);
                      if (event.target.checked) next.add(prompt.id); else next.delete(prompt.id);
                      setSelected(next);
                    }}
                    className="accent-white/70"
                  />
                  <span className="font-mono text-[12px] text-readable truncate">{prompt.title}</span>
                  <ProviderBadge provider={prompt.provider} />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="md" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button variant="primary" size="md" disabled={selected.size === 0} onClick={handleAddSelected}>
                Add {selected.size}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-5">
        <Badge variant="default">{items.length} total</Badge>
        <Badge variant="default">{pending.length} pending</Badge>
      </div>
      {importError && (
        <div className="mb-5 px-4 py-3 rounded-sm border border-red/30 bg-red/10 font-mono text-[11px] text-red">
          {importError}
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex items-center justify-center h-48 rounded-card" style={{ border: "var(--border-dim)", background: "var(--surface-base)" }}>
          <span className="font-mono text-[12px] text-readable">No queued prompts.</span>
        </div>
      ) : (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <QueueCard
                  key={item.id}
                  item={item}
                  prompt={promptMap.get(item.prompt_id)}
                  onCopy={async () => {
                    await navigator.clipboard.writeText(promptMap.get(item.prompt_id)?.prompt_text ?? item.prompt_text ?? "");
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  onStatus={async (status) => {
                    await updateQueueStatus(item.id, status);
                    await refresh();
                  }}
                  onImport={async () => {
                    setSingleImportId(item.id);
                    singleFileRef.current?.click();
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </PageContainer>
  );
}
