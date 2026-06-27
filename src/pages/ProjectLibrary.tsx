import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Archive, ArchiveRestore, Trash2, X, FolderKanban } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { getProjects, searchProjects, createProject, updateProject, deleteProject } from "@/lib/projects";
import { cn } from "@/lib/utils";
import type { Project, ProjectStatus, ProjectFilters } from "@/types";

// ─── Constants ────────────────────────────────────────────────

const STATUS_COLORS: Record<ProjectStatus, string> = {
  draft:     "text-readable",
  active:    "text-white",
  review:    "text-amber",
  archived:  "text-muted",
  delivered: "text-white",
};

const STATUS_DOT: Record<ProjectStatus, string> = {
  draft:     "bg-readable",
  active:    "bg-cyan",
  review:    "bg-amber",
  archived:  "bg-white/20",
  delivered: "bg-white",
};

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "all",       label: "All" },
  { value: "active",    label: "Active" },
  { value: "draft",     label: "Draft" },
  { value: "review",    label: "Review" },
  { value: "delivered", label: "Delivered" },
];

const PROJECT_TYPE_OPTIONS = [
  { value: "", label: "Select type" },
  { value: "campaign", label: "Campaign" },
  { value: "image-series", label: "Image series" },
  { value: "video-sequence", label: "Video sequence" },
  { value: "brand-system", label: "Brand system" },
  { value: "research", label: "Research" },
];

const ASPECT_RATIO_OPTIONS = ["1:1", "4:5", "9:16", "16:9", "3:2", "2:3"];
const PROVIDER_TARGET_OPTIONS = ["midjourney", "nano banana", "gpt image", "seedance", "kling", "runway", "higgsfield"];

// ─── Sub-components ───────────────────────────────────────────

function ProjectCard({ project, view, onClick, onArchive, onDelete }: {
  project: Project;
  view: "active" | "archived";
  onClick: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const isArchived = project.status === "archived";

  return (
    <div
      className={cn(
        "flex flex-col gap-4 p-5 rounded-card cursor-pointer group transition-all duration-150",
        "hover:ring-1 hover:ring-cyan/35",
        isArchived && "opacity-50"
      )}
      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
      onClick={onClick}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Status dot */}
        <span className={cn("w-2 h-2 rounded-full shrink-0 mt-1.5", STATUS_DOT[project.status])} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className={cn("font-sans text-[15px] font-semibold leading-snug", STATUS_COLORS[project.status])}>
              {project.title}
            </span>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-precise shrink-0">
              <button type="button"
                onClick={(e) => { e.stopPropagation(); onArchive(); }}
                className="text-muted hover:text-cyan transition-precise"
                title={view === "archived" ? "Restore" : "Archive"}>
                {view === "archived" ? <ArchiveRestore size={12} /> : <Archive size={12} />}
              </button>
              {view === "archived" && (
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="text-muted hover:text-red transition-precise"
                  title="Delete permanently">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Client / Campaign */}
          {(project.client || project.campaign) && (
            <p className="font-mono text-[11px] text-readable mt-1 truncate">
              {[project.client, project.campaign].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>

      {/* Tags */}
      {project.tags && project.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {project.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="font-mono text-[9px] tracking-widest uppercase px-2 py-1 rounded-sm text-muted"
              style={{ border: "var(--border-dim)" }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Brief excerpt */}
      {project.brief_text && (
        <p className="font-mono text-[11px] text-readable leading-relaxed line-clamp-2">
          {project.brief_text}
        </p>
      )}

      {/* Counts */}
      <div className="flex items-center gap-5 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
        {[
          { label: "prompts", val: project.prompt_count ?? 0 },
          { label: "results", val: project.result_count ?? 0 },
          { label: "refs",    val: project.reference_count ?? 0 },
        ].map(({ label, val }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="font-mono text-[14px] text-soft-white tabular-nums">{val}</span>
            <span className="font-mono text-[9px] text-muted tracking-widest uppercase">{label}</span>
          </div>
        ))}
        <div className="flex-1" />
        <span className="font-mono text-[9px] text-readable tracking-widest uppercase">{project.status}</span>
      </div>
    </div>
  );
}

// ─── Guided create form ───────────────────────────────────────

function CreateForm({ onSave, onClose }: { onSave: (id: string) => void; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [campaign, setCampaign] = useState("");
  const [projectType, setProjectType] = useState("");
  const [intendedOutput, setIntendedOutput] = useState("");
  const [briefText, setBriefText] = useState("");
  const [creativeGoals, setCreativeGoals] = useState("");
  const [visualDirection, setVisualDirection] = useState("");
  const [imageNeeds, setImageNeeds] = useState("");
  const [videoNeeds, setVideoNeeds] = useState("");
  const [aspectRatios, setAspectRatios] = useState<string[]>(["16:9"]);
  const [providerTargets, setProviderTargets] = useState<string[]>(["midjourney"]);
  const [saving, setSaving] = useState(false);

  const toggleValue = (value: string, values: string[], setValues: (next: string[]) => void) => {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const id = await createProject({
        title: title.trim(),
        client: client.trim() || undefined,
        campaign: campaign.trim() || undefined,
        status: "draft",
        project_type: projectType || undefined,
        intended_output: intendedOutput.trim() || undefined,
        image_needs: imageNeeds.trim() || undefined,
        video_needs: videoNeeds.trim() || undefined,
        aspect_ratios: aspectRatios,
        provider_targets: providerTargets,
        brief_text: briefText.trim() || undefined,
        visual_direction: visualDirection.trim() || undefined,
        creative_goals: creativeGoals.trim() || undefined,
      });
      onSave(id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-7 p-7 rounded-card mb-7"
      style={{ border: "var(--border-strong)", background: "var(--surface-card)" }}>
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="system-label">NEW PROJECT SETUP</span>
          <span className="font-mono text-[11px] text-readable">Setup, craft direction, and output targets for this workspace.</span>
        </div>
        <button type="button" onClick={onClose} className="text-dim/40 hover:text-white transition-precise">
          <X size={12} />
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-6 gap-5">
        <div className="flex flex-col gap-1.5 xl:col-span-3">
          <label className="system-label">TITLE</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Campaign or project name…"
            autoFocus
            className="h-10 px-3 font-sans text-[13px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.18)" }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onClose(); }}
          />
        </div>
        <div className="flex flex-col gap-1.5 xl:col-span-3">
          <label className="system-label">PROJECT TYPE</label>
          <select
            value={projectType}
            onChange={(e) => setProjectType(e.target.value)}
            className="h-10 px-3 font-mono text-[12px] text-white bg-transparent rounded-sm focus:outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.16)" }}
          >
            {PROJECT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className="bg-panel text-white">{option.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 xl:col-span-3">
          <label className="system-label">CLIENT</label>
          <input
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="Client name…"
            className="h-10 px-3 font-mono text-[12px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.16)" }}
          />
        </div>
        <div className="flex flex-col gap-1.5 xl:col-span-3">
          <label className="system-label">CAMPAIGN</label>
          <input
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            placeholder="Campaign name…"
            className="h-10 px-3 font-mono text-[12px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.16)" }}
          />
        </div>

        <div className="flex flex-col gap-1.5 xl:col-span-3">
          <label className="system-label">INTENDED OUTPUT</label>
          <textarea
            value={intendedOutput}
            onChange={(e) => setIntendedOutput(e.target.value)}
            placeholder="Final assets, prompt systems, boards, videos..."
            rows={3}
            className="px-3 py-2 font-mono text-[12px] leading-relaxed text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none resize-none"
            style={{ border: "1px solid rgba(255,255,255,0.16)" }}
          />
        </div>
        <div className="flex flex-col gap-1.5 xl:col-span-3">
          <label className="system-label">BRIEF / CONTEXT</label>
          <textarea
            value={briefText}
            onChange={(e) => setBriefText(e.target.value)}
            placeholder="What this project needs to solve..."
            rows={3}
            className="px-3 py-2 font-mono text-[12px] leading-relaxed text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none resize-none"
            style={{ border: "1px solid rgba(255,255,255,0.16)" }}
          />
        </div>

        <div className="flex flex-col gap-2 xl:col-span-3">
          <label className="system-label">ASPECT RATIOS</label>
          <div className="flex flex-wrap gap-2">
            {ASPECT_RATIO_OPTIONS.map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => toggleValue(ratio, aspectRatios, setAspectRatios)}
                className={cn(
                  "h-8 px-3 rounded-sm font-mono text-[10px] tracking-widest uppercase transition-precise",
                  aspectRatios.includes(ratio) ? "text-black bg-cyan" : "text-readable hover:text-white"
                )}
                style={aspectRatios.includes(ratio) ? undefined : { border: "var(--border-default)" }}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 xl:col-span-3">
          <label className="system-label">PROVIDER TARGETS</label>
          <div className="flex flex-wrap gap-2">
            {PROVIDER_TARGET_OPTIONS.map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => toggleValue(provider, providerTargets, setProviderTargets)}
                className={cn(
                  "h-8 px-3 rounded-sm font-mono text-[10px] tracking-widest uppercase transition-precise",
                  providerTargets.includes(provider) ? "text-black bg-cyan" : "text-readable hover:text-white"
                )}
                style={providerTargets.includes(provider) ? undefined : { border: "var(--border-default)" }}
              >
                {provider}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 xl:col-span-2">
          <label className="system-label">IMAGE NEEDS</label>
          <textarea
            value={imageNeeds}
            onChange={(e) => setImageNeeds(e.target.value)}
            placeholder="Hero, product, background, variations..."
            rows={3}
            className="px-3 py-2 font-mono text-[12px] leading-relaxed text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none resize-none"
            style={{ border: "1px solid rgba(255,255,255,0.16)" }}
          />
        </div>
        <div className="flex flex-col gap-1.5 xl:col-span-2">
          <label className="system-label">VIDEO NEEDS</label>
          <textarea
            value={videoNeeds}
            onChange={(e) => setVideoNeeds(e.target.value)}
            placeholder="Motion tests, frames, transitions..."
            rows={3}
            className="px-3 py-2 font-mono text-[12px] leading-relaxed text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none resize-none"
            style={{ border: "1px solid rgba(255,255,255,0.16)" }}
          />
        </div>
        <div className="flex flex-col gap-1.5 xl:col-span-2">
          <label className="system-label">VISUAL DIRECTION</label>
          <textarea
            value={visualDirection}
            onChange={(e) => setVisualDirection(e.target.value)}
            placeholder="Look, style, realism level..."
            rows={3}
            className="px-3 py-2 font-mono text-[12px] leading-relaxed text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none resize-none"
            style={{ border: "1px solid rgba(255,255,255,0.16)" }}
          />
        </div>

        <div className="flex flex-col gap-1.5 xl:col-span-6">
          <label className="system-label">CREATIVE GOALS</label>
          <textarea
            value={creativeGoals}
            onChange={(e) => setCreativeGoals(e.target.value)}
            placeholder="What good looks like, what to avoid, and what should become reusable..."
            rows={3}
            className="px-3 py-2 font-mono text-[12px] leading-relaxed text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none resize-none"
            style={{ border: "1px solid rgba(255,255,255,0.16)" }}
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
  const [view, setView] = useState<"active" | "archived">("active");
  const [showCreate, setShowCreate] = useState(false);

  const buildFilters = (): ProjectFilters => {
    const f: ProjectFilters = {};
    if (view === "archived") f.status = "archived";
    else if (statusFilter !== "all") f.status = statusFilter as ProjectStatus;
    return f;
  };

  const load = async () => {
    setLoading(true);
    try {
      const filters = buildFilters();
      const results = search.trim()
        ? await searchProjects(search.trim(), filters)
        : await getProjects(filters);
      setProjects(view === "active" ? results.filter((project) => project.status !== "archived") : results);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search, statusFilter, view]);

  const handleArchive = async (project: Project) => {
    const nextStatus: ProjectStatus = project.status === "archived" ? "draft" : "archived";
    await updateProject(project.id, { status: nextStatus });
    setProjects((prev) => prev.filter((p) => p.id !== project.id));
  };

  const handleDelete = async (project: Project) => {
    if (project.status !== "archived") return;
    if (!window.confirm(`Delete archived project "${project.title}" permanently?`)) return;
    await deleteProject(project.id);
    setProjects((prev) => prev.filter((p) => p.id !== project.id));
  };

  const handleCreated = (id: string) => {
    setShowCreate(false);
    navigate(`/projects/${id}`);
  };

  return (
    <PageContainer
      title="Projects"
      subtitle={view === "archived" ? "ARCHIVED PROJECTS" : "CAMPAIGN WORKSPACE"}
      action={
        <div className="flex items-center gap-2">
          <Button
            variant={view === "archived" ? "ghost" : "primary"}
            size="md"
            onClick={() => setShowCreate(true)}
            disabled={view === "archived"}
          >
            <Plus size={11} /> New Project
          </Button>
          <Button
            variant={view === "archived" ? "primary" : "ghost"}
            size="md"
            onClick={() => setView(view === "archived" ? "active" : "archived")}
          >
            {view === "archived" ? <ArchiveRestore size={11} /> : <Archive size={11} />}
            {view === "archived" ? "Projects" : "Archive"}
          </Button>
        </div>
      }
    >
      {/* Toolbar */}
      <div className="flex flex-col gap-3 mb-7">
        <div className="flex items-center gap-4 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, client, campaign…"
            className="h-10 px-3 font-mono text-[12px] text-soft-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none w-72"
            style={{ border: "var(--border-default)" }}
          />
          <div className="flex-1" />
          <span className="font-mono text-[11px] text-readable">
            {projects.length} {view === "archived" ? "archived" : "active"} projects
          </span>
        </div>
        {view === "active" && (
          <div className="flex items-center gap-1.5">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "h-7 px-3 rounded-sm font-mono text-[9px] tracking-widest uppercase transition-precise",
                  statusFilter === tab.value
                    ? "text-black bg-cyan"
                    : "text-readable hover:text-white"
                )}
                style={statusFilter === tab.value ? undefined : { border: "var(--border-dim)" }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create form */}
      {showCreate && <CreateForm onSave={handleCreated} onClose={() => setShowCreate(false)} />}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <span className="font-mono text-[11px] text-muted">Loading...</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div
            className="flex flex-col items-center gap-3 p-8 rounded-card max-w-sm w-full"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <FolderKanban size={28} className="text-white/25" />
            <span className="system-label">
              {view === "archived" ? "ARCHIVE EMPTY" : "NO PROJECTS"}
            </span>
            <span className="font-mono text-[12px] text-readable text-center leading-relaxed">
              {view === "archived"
                ? "No archived projects yet."
                : search || statusFilter !== "all"
                  ? "No projects match your filters."
                  : "Projects group your prompts by brief or client. Create one to get started."}
            </span>
            {view === "active" && !search && statusFilter === "all" && (
              <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
                <Plus size={10} /> Create First Project
              </Button>
            )}
            {(search || statusFilter !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); }}>
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              view={view}
              onClick={() => navigate(`/projects/${p.id}`)}
              onArchive={() => handleArchive(p)}
              onDelete={() => handleDelete(p)}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
