import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, Info, MonitorCog, MoreHorizontal, Settings, X } from "lucide-react";
import { Link } from "react-router-dom";
import {
  APP_MENU_ITEMS,
  type AppMenuItemId,
  SUPPORTED_CREATIVE_PROVIDERS,
  SUPPORTED_SYSTEM_PROVIDERS,
} from "@/lib/appInfo";
import {
  getPreferences,
  PREF_ASPECT_RATIOS,
  PREF_CATEGORIES,
  setDefaultAspectRatio,
  setDefaultCategory,
  setDefaultProvider,
  type UserPreferences,
} from "@/lib/userPreferences";
import { cn } from "@/lib/utils";

function NativeModal({
  title,
  eyebrow,
  children,
  onClose,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-140 rounded-card border border-white/14 bg-[#121212] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-5 border-b border-white/8 px-6 py-5">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-cyan">{eyebrow}</span>
            <h2 className="font-sans text-[22px] font-semibold tracking-normal text-white">{title}</h2>
          </div>
          <button
            type="button"
            className="rounded-sm p-2 text-soft-white/65 transition-precise hover:bg-white/8 hover:text-white"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>
        <div className="px-6 py-5">{children}</div>
      </section>
    </div>
  );
}

function PreferencesModal({ onClose }: { onClose: () => void }) {
  const [prefs, setPrefs] = useState<UserPreferences>(() => getPreferences());
  const [saved, setSaved] = useState(false);

  const save = (next: UserPreferences) => {
    setDefaultProvider(next.defaultProvider);
    setDefaultAspectRatio(next.defaultAspectRatio);
    setDefaultCategory(next.defaultCategory);
    setPrefs(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <NativeModal title="Preferences" eyebrow="Craft defaults" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <MonitorCog size={16} className="mt-0.5 shrink-0 text-cyan" />
          <p className="font-mono text-[12px] leading-relaxed text-readable">
            Applied when starting a new prompt with no project context.
          </p>
        </div>

        {/* Default provider */}
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-widest text-readable">Default Provider</span>
          <select
            value={prefs.defaultProvider}
            onChange={(e) => save({ ...prefs, defaultProvider: e.target.value })}
            className="h-10 px-3 font-mono text-[12px] text-soft-white bg-dark rounded-sm focus:outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.24)" }}
          >
            {SUPPORTED_CREATIVE_PROVIDERS.map((p) => (
              <option key={p} value={p.toLowerCase().replace(/\s+/g, "_")}>{p}</option>
            ))}
          </select>
        </div>

        {/* Default aspect ratio */}
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-widest text-readable">Default Aspect Ratio</span>
          <select
            value={prefs.defaultAspectRatio}
            onChange={(e) => save({ ...prefs, defaultAspectRatio: e.target.value })}
            className="h-10 px-3 font-mono text-[12px] text-soft-white bg-dark rounded-sm focus:outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.24)" }}
          >
            {PREF_ASPECT_RATIOS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Default category */}
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-widest text-readable">Default Category</span>
          <select
            value={prefs.defaultCategory}
            onChange={(e) => save({ ...prefs, defaultCategory: e.target.value })}
            className="h-10 px-3 font-mono text-[12px] text-soft-white bg-dark rounded-sm focus:outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.24)" }}
          >
            {PREF_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          {saved ? (
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-white/40">
              <Check size={10} /> Saved
            </span>
          ) : <span />}
          <Link
            to="/settings"
            onClick={onClose}
            className="font-mono text-[11px] uppercase tracking-widest text-readable hover:text-cyan transition-precise"
          >
            Full Settings →
          </Link>
        </div>
      </div>
    </NativeModal>
  );
}

function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <NativeModal title="Framecraft" eyebrow="About" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <p className="font-mono text-[12px] leading-relaxed text-readable">
          Creative prompt workspace for projects, references, recipes, comparison, analysis, and portable libraries.
        </p>

        <div className="grid gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-soft-white/65">
            Creative providers
          </span>
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_CREATIVE_PROVIDERS.map((provider) => (
              <span
                key={provider}
                className="rounded-sm border border-white/12 bg-white/5 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-soft-white"
              >
                {provider}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-soft-white/65">
            System providers
          </span>
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_SYSTEM_PROVIDERS.map((provider) => (
              <span
                key={provider}
                className="rounded-sm border border-cyan/25 bg-cyan/8 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white"
              >
                {provider}
              </span>
            ))}
          </div>
        </div>
      </div>
    </NativeModal>
  );
}

export function AppMenu() {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<AppMenuItemId | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function openModal(id: AppMenuItemId) {
    setOpen(false);
    setModal(id);
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        className={cn(
          "flex h-8 items-center gap-2 rounded-[6px] border px-3 transition-precise",
          "font-mono text-[10.5px] uppercase tracking-[0.12em]",
          open
            ? "border-cyan/45 bg-cyan/8 text-white"
            : "border-white/12 text-soft-white/75 hover:border-cyan/45 hover:text-cyan"
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal size={14} />
        Menu
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-40 w-56 rounded-card border border-white/14 bg-[#121212] p-1.5 shadow-2xl"
        >
          {APP_MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-3 rounded-[5px] px-3 py-2.5 text-left font-mono text-[11px] uppercase tracking-widest text-soft-white/80 transition-precise hover:bg-cyan/8 hover:text-cyan"
              onClick={() => openModal(item.id)}
            >
              {item.id === "preferences" ? <Settings size={14} /> : <Info size={14} />}
              {item.label}
            </button>
          ))}
        </div>
      )}

      {modal === "preferences" && <PreferencesModal onClose={() => setModal(null)} />}
      {modal === "about" && <AboutModal onClose={() => setModal(null)} />}
    </div>
  );
}
