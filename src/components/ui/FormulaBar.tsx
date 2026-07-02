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
import { GripHorizontal, Plus, RotateCcw } from "lucide-react";

// Provider success formula editor (V2 §11) — ordered, draggable, removable
// steps rendered as accented chips inside the Identity section.

function FormulaChip({ step, onRemove }: { step: string; onRemove: (step: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : undefined,
        border: "1px solid rgba(72,229,232,0.35)",
        background: "rgba(72,229,232,0.06)",
      }}
      className="shrink-0 inline-flex min-h-7 items-center gap-1 rounded-sm transition-precise"
    >
      <button
        type="button"
        className="pl-1.5 py-1 text-cyan/50 hover:text-cyan cursor-grab active:cursor-grabbing transition-precise"
        {...attributes}
        {...listeners}
        title="Drag to reorder"
      >
        <GripHorizontal size={10} />
      </button>
      <span className="font-mono text-[10px] tracking-wide text-cyan/90 py-1 select-none">{step}</span>
      <button
        type="button"
        onClick={() => onRemove(step)}
        className="pr-1.5 py-1 text-cyan/40 hover:text-red transition-precise leading-none text-[12px]"
        title="Remove step"
      >
        ×
      </button>
    </div>
  );
}

interface FormulaBarProps {
  steps: string[];
  provider: string;
  onChange: (steps: string[]) => void;
  onResetToDefault: () => void;
}

export function FormulaBar({ steps, provider, onChange, onResetToDefault }: FormulaBarProps) {
  const [adding, setAdding] = useState(false);
  const [newStep, setNewStep] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = steps.indexOf(String(active.id));
      const newIndex = steps.indexOf(String(over.id));
      if (oldIndex >= 0 && newIndex >= 0) onChange(arrayMove(steps, oldIndex, newIndex));
    }
  };

  const handleAdd = () => {
    const trimmed = newStep.trim();
    if (trimmed && !steps.includes(trimmed)) onChange([...steps, trimmed]);
    setNewStep("");
    setAdding(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="system-label text-[12px] text-cyan/70">FORMULA</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-muted uppercase tracking-widest">{provider}</span>
          <button
            type="button"
            onClick={onResetToDefault}
            className="text-readable hover:text-cyan transition-precise"
            title="Reset to the provider's default formula"
          >
            <RotateCcw size={10} />
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={steps} strategy={horizontalListSortingStrategy}>
          <div className="flex flex-wrap items-center gap-1.5 min-h-8">
            {steps.map((step, index) => (
              <div key={step} className="flex items-center gap-1.5">
                {index > 0 && <span className="font-mono text-[10px] text-cyan/35">+</span>}
                <FormulaChip step={step} onRemove={(s) => onChange(steps.filter((x) => x !== s))} />
              </div>
            ))}
            {adding ? (
              <input
                autoFocus
                value={newStep}
                onChange={(e) => setNewStep(e.target.value)}
                onBlur={handleAdd}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") { setNewStep(""); setAdding(false); }
                }}
                placeholder="New step…"
                className="h-7 w-28 px-2 rounded-sm bg-transparent font-mono text-[10px] text-cyan placeholder:text-dim focus:outline-none"
                style={{ border: "1px solid rgba(72,229,232,0.35)" }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1 min-h-7 px-2 rounded-sm font-mono text-[10px] text-readable hover:text-cyan transition-precise"
                style={{ border: "var(--border-dim)", borderStyle: "dashed" }}
                title="Add a formula step"
              >
                <Plus size={9} /> Step
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <span className="font-mono text-[9px] leading-relaxed text-readable">
        The success structure for this provider. Drag to reorder, remove or add steps — the AI assistant and Analyze Draft check your prompt against it.
      </span>
    </div>
  );
}
