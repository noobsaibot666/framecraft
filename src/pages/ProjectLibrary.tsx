import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ChevronDown, Archive, X } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { getProjects, searchProjects, createProject, updateProject } from "@/lib/projects";
import { cn } from "@/lib/utils";
import type { Project, ProjectStatus, ProjectFilters } from "@/types";

// ─── Constants ────────────────────────────────────────────────

const STATUS_COLORS: Record<ProjectStatus, string> = {
  draft:    "text-dim/60",
  active:   "text-white/70",
  review:   "text-white/50",
  archived: "text-dim/30",
};

const STATUS_DOT: Record<ProjectStatus, string> = {
  draft:    "bg-white/20",
  active:   "bg-white/70",
  review:   "bg-white/40",
  archived: "bg-white/10",
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all",      label: "All statuses" },
  { value: "active",   label: "Active" },
  { value: "draft",    label: "Draft" },
  { value: "review",   label: "Review" },
  { value: "archived", label: "Archived" },
];

// ─── Sub-components ───────────────────────────────────────────

function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[9px] text-dim/50 uppercase tracking-widest">{label}</span>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="appearance-none pr-5 h-7 pl-2 font-mono text-[10px] text-dim bg-transparent focus:outline-none cursor-pointer">
          {options.map((o) => <option key={o.value} value={o.value} className="bg-panel text-white">{o.label}</option>)}
        </select>
        <ChevronDown size={8} className="absolute right-0.5 top-1/2 -translate-y-1/2 text-dim/40 pointer-events-none" />
      </div>
    </div>
  );
}

function ProjectCard({ project, onClick, onArchive }: {
  project: Project;
  onClick: () => void;
  onArchive: () => void;
}) {
  const isArchived = project.status === "archived";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 p-4 rounded-card cursor-pointer group transition-all duration-150",
        "hover:ring-1 hover:ring-white/10",
        isArchived && "opacity-50"
      )}
      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
      onClick={onClick}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Status dot */}
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0 mt-1.5", STATUS_DOT[project.status])} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className={cn("font-sans text-[13px] font-medium leading-snug", STATUS_COLORS[project.status])}>
              {project.title}
            </span>
            <button type="button"
              onClick={(e) => { e.stopPropagation(); onArchive(); }}
              className="text-dim/20 hover:text-dim/60 transition-precise opacity-0 group-hover:opacity-100 shrink-0"
              title={isArchived ? "Un-archive" : "Archive"}>
              {isArchived ? <X size={10} /> : <Archive size={10} />}
            </button>
          </div>

          {/* Client / Campaign */}
          {(project.client || project.campaign) && (
            <p className="font-mono text-[9px] text-dim/50 mt-0.5 truncate">
              {[project.client, project.campaign].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>

      {/* Tags */}
      {project.tags && project.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {project.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="font-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm text-dim/50"
              style={{ border: "var(--border-dim)" }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Brief excerpt */}
      {project.brief_text && (
        <p className="font-mono text-[9px] text-dim/50 leading-relaxed line-clamp-2">
          {project.brief_text}
        </p>
      )}

      {/* Counts */}
      <div className="flex items-center gap-4 pt-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        {[
          { label: "prompts", val: project.prompt_count ?? 0 },
          { label: "results", val: project.result_count ?? 0 },
          { label: "refs",    val: project.reference_count ?? 0 },
        ].map(({ label, val }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="font-mono text-[11px] text-soft-white tabular-nums">{val}</span>
            <span className="font-mono text-[8px] text-dim/40 tracking-widest uppercase">{label}</span>
          </div>
        ))}
        <div className="flex-1" />
        <span className="font-mono text-[8px] text-dim/30 tracking-widest uppercase">{project.status}</span>
      </div>
    </div>
  );
}

// ─── Inline create form ───────────────────────────────────────

function CreateForm({ onSave, onClose }: { onSave: (id: string) => void; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [campaign, setCampaign] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const id = await createProject({
        title: title.trim(),
        client: client.trim() || undefined,
        campaign: campaign.trim() || undefined,
        status: "draft",
      });
      onSave(id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-5 rounded-card mb-4"
      style={{ border: "var(--border-strong)", background: "var(--surface-card)" }}>
      <div className="flex items-center justify-between">
        <span className="system-label">NEW PROJECT</span>
        <button type="button" onClick={onClose} className="text-dim/40 hover:text-white transition-precise">
          <X size={12} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5 col-span-3">
          <label className="system-label">TITLE</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Campaign or project name…"
            autoFocus
            className="h-8 px-3 font-sans text-[11px] text-white placeholder:text-dim/40 bg-transparent rounded-sm focus:outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.15)" }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onClose(); }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="system-label">CLIENT</label>
          <input
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="Client name…"
            className="h-8 px-3 font-mono text-[10px] text-white placeholder:text-dim/40 bg-transparent rounded-sm focus:outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.10)" }}
          />
        </div>
        <div className="flex flex-col gap-1.5 col-span-2">
          <label className="system-label">CAMPAIGN</label>
          <input
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            placeholder="Campaign name…"
            className="h-8 px-3 font-mono text-[10px] text-white placeholder:text-dim/40 bg-transparent rounded-sm focus:outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.10)" }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={handleSave} disabled={!title.trim() || saving}>
          {saving ? "Creating…" : "Create Project"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export function ProjectLibrary() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);

  const buildFilters = (): ProjectFilters => {
    const f: ProjectFilters = {};
    if (statusFilter !== "all") f.status = statusFilter as ProjectStatus;
    return f;
  };

  const load = async () => {
    setLoading(true);
    try {
      const filters = buildFilters();
      const results = search.trim()
        ? await searchProjects(search.trim(), filters)
        : await getProjects(filters);
      setProjects(results);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search, statusFilter]);

  const handleArchive = async (project: Project) => {
    const nextStatus: ProjectStatus = project.status === "archived" ? "draft" : "archived";
    await updateProject(project.id, { status: nextStatus });
    setProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, status: nextStatus } : p));
  };

  const handleCreated = (id: string) => {
    setShowCreate(false);
    navigate(`/projects/${id}`);
  };

  return (
    <PageContainer
      title="Projects"
      subtitle="CAMPAIGN WORKSPACE"
      action={
        <Button variant="ghost" size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={11} /> New Project
        </Button>
      }
    >
      {/* Toolbar */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, client, campaign…"
          className="h-7 px-3 font-mono text-[10px] text-soft-white placeholder:text-dim/40 bg-transparent rounded-sm focus:outline-none w-52"
          style={{ border: "var(--border-dim)" }}
        />
        <FilterSelect label="STATUS" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
        <div className="flex-1" />
        <span className="font-mono text-[9px] text-dim/40">{projects.length} projects</span>
      </div>

      {/* Create form */}
      {showCreate && <CreateForm onSave={handleCreated} onClose={() => setShowCreate(false)} />}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <span className="font-mono text-[10px] text-dim/40">Loading…</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <span className="font-mono text-[11px] text-dim/40">
            {search || statusFilter !== "all" ? "No projects match your filters." : "No projects yet."}
          </span>
          {!search && statusFilter === "all" && (
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={10} /> Create your first project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onClick={() => navigate(`/projects/${p.id}`)}
              onArchive={() => handleArchive(p)}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
