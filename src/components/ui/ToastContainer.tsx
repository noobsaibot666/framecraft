import { X } from "lucide-react";
import { useToastStore, type ToastItem } from "@/stores/useToastStore";

const TYPE_STYLES: Record<ToastItem["type"], string> = {
  success: "border-cyan/30 text-cyan/90",
  error: "border-red/40 text-red/90",
  info: "border-white/20 text-soft-white/80",
};

const TYPE_DOT: Record<ToastItem["type"], string> = {
  success: "bg-cyan",
  error: "bg-red",
  info: "bg-white/40",
};

function Toast({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div
      role="status"
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-sm min-w-48 max-w-xs ${TYPE_STYLES[item.type]}`}
      style={{ background: "var(--surface-card)", border: "1px solid", borderColor: "inherit" }}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TYPE_DOT[item.type]}`} />
      <span className="font-mono text-[10px] flex-1 leading-relaxed">{item.message}</span>
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        className="shrink-0 text-dim/40 hover:text-white transition-precise"
        aria-label="Dismiss"
      >
        <X size={9} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  if (!toasts.length) return null;
  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 items-end pointer-events-none"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <Toast item={t} />
        </div>
      ))}
    </div>
  );
}
