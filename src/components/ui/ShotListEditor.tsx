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
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, X } from "lucide-react";

// Real shot-by-shot editor (audit doc 05 §12/§13) — shared by Seedance and
// Kling, which both ask for ordered, editable shot lists rather than a
// single free-text field. Previously "shot-by-shot" existed only as a
// formula-step label string with no actual input anywhere.

export interface Shot {
  id: string;
  text: string;
}

function ShotRow({ shot, index, onChange, onRemove }: {
  shot: Shot;
  index: number;
  onChange: (text: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: shot.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center gap-2"
    >
      <button
        type="button"
        className="shrink-0 text-cyan/40 hover:text-cyan cursor-grab active:cursor-grabbing transition-precise"
        {...attributes}
        {...listeners}
        title="Drag to reorder"
      >
        <GripVertical size={12} />
      </button>
      <span className="shrink-0 w-14 font-mono text-[9px] text-cyan/60 tracking-widest uppercase">Shot {String(index + 1).padStart(2, "0")}</span>
      <input
        value={shot.text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="what happens in this shot…"
        className="flex-1 h-9 px-2.5 rounded-sm bg-dark font-mono text-[12px] text-soft-white placeholder:text-dim focus:outline-none focus:border-cyan/55 transition-precise"
        style={{ border: "1px solid rgba(255,255,255,0.16)" }}
      />
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 text-dim/40 hover:text-red transition-precise"
        title="Remove shot"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function ShotListEditor({ shots, onChange }: { shots: Shot[]; onChange: (shots: Shot[]) => void }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = shots.findIndex((s) => s.id === active.id);
      const newIndex = shots.findIndex((s) => s.id === over.id);
      if (oldIndex >= 0 && newIndex >= 0) onChange(arrayMove(shots, oldIndex, newIndex));
    }
  };

  const handleAdd = () => {
    onChange([...shots, { id: crypto.randomUUID(), text: "" }]);
  };

  return (
    <div className="flex flex-col gap-1.5 col-span-full">
      <div className="flex items-center justify-between">
        <label className="system-label text-[12px] text-muted">SHOT-BY-SHOT</label>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1 font-mono text-[9px] tracking-widest uppercase text-cyan/70 hover:text-cyan transition-precise"
        >
          <Plus size={9} /> Add Shot
        </button>
      </div>
      {shots.length === 0 ? (
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center justify-center h-10 rounded-sm font-mono text-[11px] text-dim/50 hover:text-white transition-precise"
          style={{ border: "1px dashed rgba(255,255,255,0.16)" }}
        >
          <Plus size={11} className="mr-1.5" /> Add the first shot
        </button>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={shots.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-1.5">
              {shots.map((shot, index) => (
                <ShotRow
                  key={shot.id}
                  shot={shot}
                  index={index}
                  onChange={(text) => onChange(shots.map((s) => (s.id === shot.id ? { ...s, text } : s)))}
                  onRemove={() => onChange(shots.filter((s) => s.id !== shot.id))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

/** Render a shot list as a compact numbered string for prompt assembly. Pure. */
export function formatShotsForAssembly(shots: Shot[]): string {
  const filled = shots.filter((s) => s.text.trim());
  if (!filled.length) return "";
  return filled.map((s, i) => `Shot ${i + 1}: ${s.text.trim()}`).join(". ");
}
