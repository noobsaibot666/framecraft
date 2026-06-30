import { useEffect, useState, useRef } from "react";
import { Copy, Plus, Star, Trash2, ChevronDown, X, AlertTriangle } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { getSREFs, updateSREFRating, createSREF, deleteSREF, getProfiles, updateProfileRating, createProfile, deleteProfile } from "@/lib/db";
import { cn } from "@/lib/utils";
import type { SREF, Profile } from "@/types";

// ─── Tabs ─────────────────────────────────────────────────────

type Tab = "srefs" | "profiles";

// ─── Star Rating ──────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <button key={i} type="button" onClick={() => onChange(i + 1 === value ? 0 : i + 1)}
          className="transition-precise">
          <Star size={10} className={cn(i < value ? "text-white/70 fill-white/50" : "text-white/10")} />
        </button>
      ))}
    </div>
  );
}

// ─── Copy button ──────────────────────────────────────────────

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(`--sref ${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" onClick={handleCopy}
      className="flex items-center gap-1.5 font-mono text-[9px] tracking-widest uppercase px-2 py-1 rounded-sm text-dim hover:text-white transition-precise"
      style={{ border: "var(--border-dim)" }}>
      <Copy size={8} />
      {copied ? "Copied!" : "--sref"}
    </button>
  );
}

// ─── SREF Card ────────────────────────────────────────────────

function SREFCard({ sref, onRatingChange, onDelete }: {
  sref: SREF;
  onRatingChange: (id: string, rating: number) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-card group"
      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-mono text-[14px] text-white font-medium tabular-nums tracking-tight">{sref.code}</span>
          {sref.title && <span className="font-sans text-[12px] text-muted truncate">{sref.title}</span>}
        </div>
        <button type="button" onClick={() => onDelete(sref.id)}
          className="text-dim/20 hover:text-red/70 transition-precise opacity-0 group-hover:opacity-100 shrink-0">
          <Trash2 size={10} />
        </button>
      </div>

      {/* Category / provider badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {sref.category && (
          <span className="font-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm text-dim/70"
            style={{ border: "var(--border-dim)" }}>{sref.category}</span>
        )}
        <span className="font-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm text-dim/50"
          style={{ border: "var(--border-dim)" }}>{sref.provider}</span>
      </div>

      {/* Best use */}
      {sref.best_use && (
        <p className="font-mono text-[9px] text-dim/70 leading-relaxed">{sref.best_use}</p>
      )}

      {/* Risk note */}
      {sref.risk_notes && (
        <div className="flex items-start gap-1.5">
          <AlertTriangle size={8} className="text-red/40 shrink-0 mt-0.5" />
          <p className="font-mono text-[8px] text-red/50 leading-relaxed">{sref.risk_notes}</p>
        </div>
      )}

      {/* Notes */}
      {sref.notes && !sref.best_use && (
        <p className="font-mono text-[9px] text-dim/50 leading-relaxed">{sref.notes}</p>
      )}

      {/* Footer: rating + copy */}
      <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <StarRating value={sref.rating} onChange={(r) => onRatingChange(sref.id, r)} />
        <CopyCodeButton code={sref.code} />
      </div>
    </div>
  );
}

// ─── Profile Card ─────────────────────────────────────────────

function ProfileCard({ profile, onRatingChange, onDelete }: {
  profile: Profile;
  onRatingChange: (id: string, rating: number) => void;
  onDelete: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(`--p ${profile.code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col gap-3 p-4 rounded-card group"
      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-mono text-[14px] text-white font-medium tabular-nums tracking-tight">{profile.code}</span>
          {profile.title && <span className="font-sans text-[12px] text-muted truncate">{profile.title}</span>}
        </div>
        <button type="button" onClick={() => onDelete(profile.id)}
          className="text-dim/20 hover:text-red/70 transition-precise opacity-0 group-hover:opacity-100 shrink-0">
          <Trash2 size={10} />
        </button>
      </div>

      {profile.best_use && (
        <p className="font-mono text-[9px] text-dim/70 leading-relaxed">{profile.best_use}</p>
      )}

      {profile.risk_notes && (
        <div className="flex items-start gap-1.5">
          <AlertTriangle size={8} className="text-red/40 shrink-0 mt-0.5" />
          <p className="font-mono text-[8px] text-red/50 leading-relaxed">{profile.risk_notes}</p>
        </div>
      )}

      {profile.notes && !profile.best_use && (
        <p className="font-mono text-[9px] text-dim/50 leading-relaxed">{profile.notes}</p>
      )}

      <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <StarRating value={profile.rating} onChange={(r) => onRatingChange(profile.id, r)} />
        <button type="button" onClick={handleCopy}
          className="flex items-center gap-1.5 font-mono text-[9px] tracking-widest uppercase px-2 py-1 rounded-sm text-dim hover:text-white transition-precise"
          style={{ border: "var(--border-dim)" }}>
          <Copy size={8} />
          {copied ? "Copied!" : "--p"}
        </button>
      </div>
    </div>
  );
}

// ─── Add Form ─────────────────────────────────────────────────

function AddForm({ type, onSave, onClose }: {
  type: Tab;
  onSave: () => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [bestUse, setBestUse] = useState("");
  const [riskNotes, setRiskNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => { codeRef.current?.focus(); }, []);

  const handleSave = async () => {
    if (!code.trim()) return;
    setSaving(true);
    try {
      if (type === "srefs") {
        await createSREF({ code: code.trim(), title: title || undefined, best_use: bestUse || undefined, risk_notes: riskNotes || undefined, notes: notes || undefined });
      } else {
        await createProfile({ code: code.trim(), title: title || undefined, best_use: bestUse || undefined, risk_notes: riskNotes || undefined, notes: notes || undefined });
      }
      onSave();
    } finally {
      setSaving(false);
    }
  };

  const label = type === "srefs" ? "SREF Code" : "Profile Code";
  const placeholder = type === "srefs" ? "e.g. 1234567890" : "e.g. my_profile_name";

  return (
    <div className="flex flex-col gap-4 p-5 rounded-card mb-2"
      style={{ border: "var(--border-strong)", background: "var(--surface-card)" }}>
      <div className="flex items-center justify-between">
        <span className="system-label">ADD {type === "srefs" ? "SREF" : "PROFILE"}</span>
        <button type="button" onClick={onClose} className="text-dim/40 hover:text-white transition-precise">
          <X size={12} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="system-label">{label.toUpperCase()}</label>
          <input ref={codeRef} value={code} onChange={(e) => setCode(e.target.value)}
            placeholder={placeholder}
            className="h-8 px-3 font-mono text-[12px] text-white placeholder:text-dim/50 bg-dark rounded-sm focus:outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.15)" }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onClose(); }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="system-label">TITLE (optional)</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Friendly name…"
            className="h-8 px-3 font-mono text-[12px] text-white placeholder:text-dim/50 bg-dark rounded-sm focus:outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.10)" }} />
        </div>
        <div className="flex flex-col gap-1.5 col-span-2">
          <label className="system-label">BEST USE</label>
          <input value={bestUse} onChange={(e) => setBestUse(e.target.value)}
            placeholder="What does this work best for?"
            className="h-8 px-3 font-mono text-[12px] text-white placeholder:text-dim/50 bg-dark rounded-sm focus:outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.10)" }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="system-label">RISK NOTES</label>
          <input value={riskNotes} onChange={(e) => setRiskNotes(e.target.value)}
            placeholder="Any artifacts or caveats?"
            className="h-8 px-3 font-mono text-[12px] text-white placeholder:text-dim/50 bg-dark rounded-sm focus:outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.10)" }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="system-label">NOTES</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes…"
            className="h-8 px-3 font-mono text-[12px] text-white placeholder:text-dim/50 bg-dark rounded-sm focus:outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.10)" }} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={handleSave} disabled={!code.trim() || saving}>
          {saving ? "Saving…" : `Add ${type === "srefs" ? "SREF" : "Profile"}`}
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Filter helpers ───────────────────────────────────────────

type RatingFilter = "all" | "rated" | "unrated";
type SREFSort = "newest" | "oldest" | "rating" | "name";

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[9px] text-dim/50 uppercase tracking-widest">{label}</span>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="appearance-none pr-5 h-7 pl-2 font-mono text-[10px] text-dim bg-transparent focus:outline-none cursor-pointer"
          style={{ border: "none" }}>
          {options.map((o) => <option key={o.value} value={o.value} className="bg-panel text-white">{o.label}</option>)}
        </select>
        <ChevronDown size={8} className="absolute right-0.5 top-1/2 -translate-y-1/2 text-dim/40 pointer-events-none" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export function SREFLibrary() {
  const [tab, setTab] = useState<Tab>("srefs");
  const [srefs, setSREFs] = useState<SREF[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [srefSort, setSrefSort] = useState<SREFSort>("newest");
  const [showAdd, setShowAdd] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [s, p] = await Promise.all([getSREFs(), getProfiles()]);
    setSREFs(s);
    setProfiles(p);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSREFRating = async (id: string, rating: number) => {
    await updateSREFRating(id, rating);
    setSREFs((prev) => prev.map((s) => s.id === id ? { ...s, rating } : s));
  };

  const handleProfileRating = async (id: string, rating: number) => {
    await updateProfileRating(id, rating);
    setProfiles((prev) => prev.map((p) => p.id === id ? { ...p, rating } : p));
  };

  const handleDeleteSREF = async (id: string) => {
    await deleteSREF(id);
    setSREFs((prev) => prev.filter((s) => s.id !== id));
  };

  const handleDeleteProfile = async (id: string) => {
    await deleteProfile(id);
    setProfiles((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAddSaved = () => {
    setShowAdd(false);
    loadData();
  };

  // Filtering
  const filterItems = <T extends SREF | Profile>(items: T[]): T[] => {
    const q = search.toLowerCase().trim();
    return items.filter((item) => {
      if (q && !item.code.toLowerCase().includes(q) && !(item.title ?? "").toLowerCase().includes(q) && !(item.best_use ?? "").toLowerCase().includes(q) && !(item.notes ?? "").toLowerCase().includes(q)) return false;
      if (ratingFilter === "rated" && item.rating === 0) return false;
      if (ratingFilter === "unrated" && item.rating > 0) return false;
      return true;
    });
  };

  const sortItems = <T extends SREF | Profile>(items: T[]): T[] => {
    return [...items].sort((a, b) => {
      if (srefSort === "rating") return b.rating - a.rating;
      if (srefSort === "name") return (a.title ?? a.code).localeCompare(b.title ?? b.code);
      if (srefSort === "oldest") return a.created_at.localeCompare(b.created_at);
      return b.created_at.localeCompare(a.created_at); // newest
    });
  };

  const filteredSREFs = sortItems(filterItems(srefs));
  const filteredProfiles = sortItems(filterItems(profiles));

  const totalShown = tab === "srefs" ? filteredSREFs.length : filteredProfiles.length;
  const totalAll = tab === "srefs" ? srefs.length : profiles.length;

  return (
    <PageContainer
      title="SREF Library"
      subtitle="STYLE REFERENCES & PROFILES"
      action={
        <Button variant="ghost" size="sm" onClick={() => { setShowAdd(true); }}>
          <Plus size={11} /> Add {tab === "srefs" ? "SREF" : "Profile"}
        </Button>
      }
    >
      {/* Tab + filters bar */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        {/* Tabs */}
        <div className="flex items-center gap-1">
          {(["srefs", "profiles"] as Tab[]).map((t) => (
            <button key={t} type="button"
              onClick={() => { setTab(t); setShowAdd(false); }}
              className={cn("font-mono text-[9px] tracking-widest uppercase px-3 py-1.5 rounded-sm transition-precise",
                tab === t ? "text-white" : "text-dim hover:text-muted")}
              style={{ border: tab === t ? "var(--border-strong)" : "var(--border-dim)", background: tab === t ? "rgba(255,255,255,0.05)" : "transparent" }}>
              {t === "srefs" ? `SREFs (${srefs.length})` : `Profiles (${profiles.length})`}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Search */}
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="h-7 px-3 font-mono text-[10px] text-soft-white placeholder:text-dim/40 bg-transparent rounded-sm focus:outline-none w-40"
          style={{ border: "var(--border-dim)" }} />

        {/* Rating filter */}
        <FilterSelect label="RATING" value={ratingFilter} onChange={(v) => setRatingFilter(v as RatingFilter)}
          options={[{ value: "all", label: "All" }, { value: "rated", label: "Rated" }, { value: "unrated", label: "Unrated" }]} />

        {/* Sort */}
        <FilterSelect label="SORT" value={srefSort} onChange={(v) => setSrefSort(v as SREFSort)}
          options={[{ value: "newest", label: "Newest" }, { value: "oldest", label: "Oldest" }, { value: "rating", label: "Rating" }, { value: "name", label: "Name" }]} />

        {/* Count */}
        <span className="font-mono text-[9px] text-dim/50">{totalShown === totalAll ? totalAll : `${totalShown}/${totalAll}`}</span>
      </div>

      {/* Add form */}
      {showAdd && <AddForm type={tab} onSave={handleAddSaved} onClose={() => setShowAdd(false)} />}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <span className="font-mono text-[10px] text-dim/40">Loading…</span>
        </div>
      ) : tab === "srefs" ? (
        filteredSREFs.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {filteredSREFs.map((sref) => (
              <SREFCard key={sref.id} sref={sref} onRatingChange={handleSREFRating} onDelete={handleDeleteSREF} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <span className="font-mono text-[12px] text-dim/40">
              {search || ratingFilter !== "all" ? "No SREFs match your filters." : "No SREFs yet."}
            </span>
            {!search && ratingFilter === "all" && (
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(true)}>
                <Plus size={10} /> Add your first SREF
              </Button>
            )}
          </div>
        )
      ) : (
        filteredProfiles.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {filteredProfiles.map((profile) => (
              <ProfileCard key={profile.id} profile={profile} onRatingChange={handleProfileRating} onDelete={handleDeleteProfile} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <span className="font-mono text-[12px] text-dim/40">
              {search || ratingFilter !== "all" ? "No profiles match your filters." : "No profiles yet."}
            </span>
            {!search && ratingFilter === "all" && (
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(true)}>
                <Plus size={10} /> Add your first profile
              </Button>
            )}
          </div>
        )
      )}
    </PageContainer>
  );
}
