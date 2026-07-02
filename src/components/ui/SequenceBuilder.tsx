import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripHorizontal } from "lucide-react";
import type { Token } from "@/types";

// ─── Sortable Pill ────────────────────────────────────────────

interface SortablePillProps {
  token: Token;
  displayText: string;
  isEditing: boolean;
  editText: string;
  conflicting: boolean;
  onEditStart: (id: string) => void;
  onEditChange: (text: string) => void;
  onEditCommit: () => void;
  onRemove: (id: string) => void;
}

function SortablePill({
  token,
  displayText,
  isEditing,
  editText,
  conflicting,
  onEditStart,
  onEditChange,
  onEditCommit,
  onRemove,
}: SortablePillProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: token.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const isLowQuality = token.quality_score < -0.1;
  const isHighQuality = token.quality_score > 0.3;
  const pillBorder = conflicting
    ? "1px solid rgba(251,191,36,0.55)"
    : isLowQuality
    ? "1px solid rgba(215,25,33,0.35)"
    : isHighQuality
    ? "1px solid rgba(255,255,255,0.28)"
    : "var(--border-strong)";
  const qualityHint = conflicting
    ? " · Conflicts with another instruction — see warning above"
    : isLowQuality
    ? ` · Low quality score (${token.quality_score.toFixed(2)})`
    : isHighQuality
    ? ` · Proven token (${token.quality_score.toFixed(2)})`
    : "";

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, border: pillBorder, background: conflicting ? "rgba(251,191,36,0.06)" : "rgba(255,255,255,0.06)", opacity: conflicting ? 0.6 : style.opacity }}
      className="shrink-0 inline-flex min-h-8 items-center gap-1.5 rounded-sm transition-precise"
      title={`${displayText}${qualityHint}`}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="pl-2 py-1.5 text-readable hover:text-cyan cursor-grab active:cursor-grabbing transition-precise"
        {...attributes}
        {...listeners}
      >
        <GripHorizontal size={12} />
      </button>

      {/* Text — click to edit inline */}
      {isEditing ? (
        <input
          autoFocus
          value={editText}
          onChange={(e) => onEditChange(e.target.value)}
          onBlur={onEditCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") onEditCommit();
          }}
          className="font-mono text-[10.5px] tracking-wide text-white bg-transparent outline-none min-w-0 py-1"
          style={{ width: `${Math.max(editText.length, 4)}ch` }}
        />
      ) : (
        <span
          className="font-mono text-[10.5px] tracking-wide text-white py-1 cursor-text select-none"
          onClick={() => onEditStart(token.id)}
        >
          {displayText}
        </span>
      )}

      {/* Remove */}
      <button
        type="button"
        onClick={() => onRemove(token.id)}
        className="pr-2 py-1.5 text-readable hover:text-red transition-precise leading-none text-[13px]"
      >
        ×
      </button>
    </div>
  );
}

// ─── Sequence Builder ─────────────────────────────────────────

interface SequenceBuilderProps {
  tokens: Token[];
  overrides: Record<string, string>;
  onReorder: (tokens: Token[]) => void;
  onRemove: (tokenId: string) => void;
  onEditCommit: (tokenId: string, text: string) => void;
  /** Token IDs flagged by inconsistency detection — rendered greyed-out with a warning accent. */
  conflictingIds?: Set<string>;
}

export function SequenceBuilder({
  tokens,
  overrides,
  onReorder,
  onRemove,
  onEditCommit,
  conflictingIds,
}: SequenceBuilderProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = tokens.findIndex((t) => t.id === active.id);
      const newIndex = tokens.findIndex((t) => t.id === over.id);
      onReorder(arrayMove(tokens, oldIndex, newIndex));
    }
  };

  const startEdit = (id: string) => {
    const token = tokens.find((t) => t.id === id);
    if (!token) return;
    setEditingId(id);
    setEditText(overrides[id] ?? token.text);
  };

  const commitEdit = () => {
    if (editingId) {
      onEditCommit(editingId, editText.trim() || (tokens.find((t) => t.id === editingId)?.text ?? ""));
      setEditingId(null);
      setEditText("");
    }
  };

  if (tokens.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-9 rounded-sm"
        style={{ border: "var(--border-dim)", borderStyle: "dashed" }}
      >
        <span className="font-mono text-[10.5px] text-readable">Add tokens from the library below</span>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={tokens.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
        <div className="flex flex-wrap gap-1.5 min-h-9">
          {tokens.map((token) => (
            <SortablePill
              key={token.id}
              token={token}
              displayText={overrides[token.id] ?? token.text}
              isEditing={editingId === token.id}
              editText={editText}
              conflicting={conflictingIds?.has(token.id) ?? false}
              onEditStart={startEdit}
              onEditChange={setEditText}
              onEditCommit={commitEdit}
              onRemove={onRemove}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
