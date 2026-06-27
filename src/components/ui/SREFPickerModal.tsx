import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { getSREFs } from "@/lib/db";
import { useImageDisplaySrc } from "@/lib/useImageDisplaySrc";
import type { SREF } from "@/types";

interface Props {
  onSelect: (sref: SREF) => void;
  onClose: () => void;
}

function SREFThumb({ path, code }: { path?: string; code: string }) {
  const { src, onError } = useImageDisplaySrc(path ?? "");
  return (
    <div className="aspect-square rounded-sm overflow-hidden flex items-center justify-center"
      style={{ background: "rgba(255,255,255,0.06)" }}>
      {src ? (
        <img src={src} onError={onError} alt={code} className="w-full h-full object-cover" />
      ) : (
        <span className="font-mono text-[10px] text-readable">{code}</span>
      )}
    </div>
  );
}

export function SREFPickerModal({ onSelect, onClose }: Props) {
  const [srefs, setSrefs] = useState<SREF[]>([]);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSREFs().then(setSrefs).catch(() => {});
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const q = query.toLowerCase();
  const filtered = srefs.filter(
    (s) =>
      !q ||
      s.code.includes(q) ||
      (s.title?.toLowerCase().includes(q)) ||
      (s.description?.toLowerCase().includes(q))
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.72)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex flex-col w-full max-w-2xl max-h-[80vh] rounded-card overflow-hidden"
        style={{ background: "var(--surface-card)", border: "var(--border-default)" }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 shrink-0"
          style={{ borderBottom: "var(--border-default)" }}>
          <Search size={13} className="text-readable shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search SREFs by code or title…"
            className="flex-1 bg-transparent font-mono text-[13px] text-white placeholder:text-readable/50 focus:outline-none"
          />
          <span className="font-mono text-[10px] text-muted">{filtered.length}</span>
          <button onClick={onClose} className="text-readable hover:text-white transition-precise">
            <X size={14} />
          </button>
        </div>

        {/* Grid */}
        <div className="overflow-y-auto flex-1 p-4">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16 font-mono text-[12px] text-readable">
              {srefs.length === 0 ? "No SREFs in library." : "No matches."}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSelect(s)}
                  className="flex flex-col gap-2 p-2 rounded-sm text-left hover:opacity-80 transition-precise group"
                  style={{ background: "rgba(255,255,255,0.04)", border: "var(--border-default)" }}
                >
                  <SREFThumb path={s.example_path} code={s.code} />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    {s.title && (
                      <span className="font-sans text-[11px] font-medium text-white truncate leading-tight">
                        {s.title}
                      </span>
                    )}
                    <span className="font-mono text-[10px] text-readable truncate">
                      {s.code}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
