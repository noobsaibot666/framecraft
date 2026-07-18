import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, ArchiveRestore, Clapperboard, Plus, ScanEye, Trash2 } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { NewCinemaProjectModal } from "@/components/cinema/NewCinemaProjectModal";
import { deleteCinemaProject, getCinemaProjects, updateCinemaProject } from "@/lib/cinemaProjects";
import { getProviderCapability } from "@/lib/videoProviderCapabilities";
import { useToastStore } from "@/stores/useToastStore";
import { cn } from "@/lib/utils";
import type { CinemaProject, CinemaProjectStatus } from "@/types";

// Restoring from "archived" has no stored "previous status" to fall back to, so derive the
// most accurate non-archived status from the project's own real progress signals instead of
// guessing "draft" (which would be wrong for a project that already has scenes).
function deriveActiveStatus(project: CinemaProject): CinemaProjectStatus {
  if ((project.scene_count ?? 0) > 0) return "scenes";
  if (project.script_status === "approved") return "assets";
  if (project.script_content?.trim()) return "scripting";
  return "draft";
}

const STATUS_DOT: Record<CinemaProject["status"], string> = {
  draft: "bg-readable",
  scripting: "bg-cyan",
  assets: "bg-amber",
  scenes: "bg-amber",
  complete: "bg-white",
  archived: "bg-white/20",
};

function ProjectCard({
  project,
  onClick,
  onToggleArchive,
  onDelete,
}: {
  project: CinemaProject;
  onClick: () => void;
  onToggleArchive: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const videoCapability = getProviderCapability(project.video_provider);

  return (
    <div
      className="group relative flex flex-col gap-4 p-5 rounded-card transition-all duration-150 border border-white/22 bg-white/7 hover:bg-white/10 hover:border-white/30 min-w-0"
      style={{ cursor: "pointer" }}
      onClick={onClick}
    >
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-precise z-10">
        <button
          type="button"
          onClick={onToggleArchive}
          className="p-1.5 rounded-sm bg-black/60 text-muted hover:text-cyan transition-precise"
          title={project.status === "archived" ? "Restore" : "Archive"}
        >
          {project.status === "archived" ? <ArchiveRestore size={12} /> : <Archive size={12} />}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 rounded-sm bg-black/60 text-muted hover:text-red transition-precise"
          title="Delete project"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="aspect-video rounded-sm overflow-hidden flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)" }}>
        {project.thumbnail_data ? (
          <img src={project.thumbnail_data} alt={project.title} className="w-full h-full object-cover" />
        ) : (
          <Clapperboard size={22} className="text-white/20" />
        )}
      </div>

      <div className="flex items-start gap-3">
        <span className={cn("w-2 h-2 rounded-full shrink-0 mt-1.5", STATUS_DOT[project.status])} />
        <div className="flex-1 min-w-0">
          <span className="font-sans text-[15px] font-semibold leading-snug text-white truncate block">
            {project.title}
          </span>
          <span className="font-mono text-[9px] text-readable tracking-widest uppercase">{project.status}</span>
        </div>
      </div>

      {(project.script_model || project.image_provider || project.video_provider) && (
        <div className="flex flex-wrap gap-1.5">
          {project.script_model && (
            <span className="font-mono text-[9px] tracking-widest uppercase px-2 py-1 rounded-sm text-readable border border-white/12">
              {project.script_model}
            </span>
          )}
          {project.image_provider && (
            <span className="font-mono text-[9px] tracking-widest uppercase px-2 py-1 rounded-sm text-cyan border border-cyan/30">
              {project.image_provider}
            </span>
          )}
          {project.video_provider && (
            <span className="font-mono text-[9px] tracking-widest uppercase px-2 py-1 rounded-sm text-amber border border-amber/30">
              {project.video_provider}
            </span>
          )}
          {videoCapability?.acceptsImageReference && (
            <span
              className="flex items-center gap-1 font-mono text-[9px] tracking-widest uppercase px-2 py-1 rounded-sm text-readable border border-white/12"
              title={`${videoCapability.label} sees image reference (up to ${videoCapability.maxReferenceImages ?? "several"})`}
            >
              <ScanEye size={9} /> SEES REF
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-white/12">
        {[
          { label: "folders", val: project.folder_count ?? 0 },
          { label: "assets", val: project.asset_count ?? 0 },
          { label: "scenes", val: project.scene_count ?? 0 },
          { label: "shots", val: project.shot_count ?? 0 },
        ].map(({ label, val }) => (
          <div key={label} className="flex items-center gap-1 shrink-0">
            <span className="font-mono text-[14px] text-soft-white tabular-nums">{val}</span>
            <span className="font-mono text-[9px] text-muted tracking-widest uppercase">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CinemaStudioLibrary() {
  const navigate = useNavigate();
  const toast = useToastStore((s) => s.add);
  const [projects, setProjects] = useState<CinemaProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setProjects(await getCinemaProjects());
    } catch (err) {
      console.error("getCinemaProjects failed:", err);
      toast("Failed to load Cinema Studio projects", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreated = (id: string) => {
    setShowCreate(false);
    navigate(`/cinema-studio/${id}/script`);
  };

  const handleToggleArchive = async (e: React.MouseEvent, project: CinemaProject) => {
    e.stopPropagation();
    const nextStatus: CinemaProjectStatus = project.status === "archived" ? deriveActiveStatus(project) : "archived";
    try {
      await updateCinemaProject(project.id, { status: nextStatus });
      setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, status: nextStatus } : p)));
      toast(project.status === "archived" ? "Project restored" : "Project archived", "info");
    } catch {
      toast("Failed to update project", "error");
    }
  };

  const handleDelete = async (e: React.MouseEvent, project: CinemaProject) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${project.title}" and everything inside it — script, folders, assets, scenes, shots? This can't be undone.`)) return;
    try {
      await deleteCinemaProject(project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      toast("Project deleted", "info");
    } catch {
      toast("Failed to delete project", "error");
    }
  };

  const active = projects.filter((p) => p.status !== "archived");
  const archived = projects.filter((p) => p.status === "archived");

  return (
    <PageContainer
      title="Cinema Studio"
      subtitle="VIDEO PRODUCTION WORKSPACE"
      description="Script → folder-organized assets → scene/shot direction, built for video generation."
      action={
        <Button variant="primary" size="md" onClick={() => setShowCreate(true)}>
          <Plus size={11} /> New Project
        </Button>
      }
    >
      {loading ? (
        <div className="flex items-center gap-3 h-40 justify-center">
          <span className="font-ndot text-[20px] text-dim/30 animate-pulse">···</span>
          <span className="font-mono text-[12px] text-muted">Loading projects…</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div
            className="flex flex-col items-center gap-3 p-8 rounded-card max-w-sm w-full"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <Clapperboard size={28} className="text-white/25" />
            <span className="system-label">NO PROJECTS YET</span>
            <span className="font-mono text-[13px] text-readable text-center leading-relaxed">
              A Cinema Studio project takes a script through folder-organized assets to scene-by-scene shot direction.
            </span>
            <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={10} /> Create First Project
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {active.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onClick={() => navigate(`/cinema-studio/${p.id}/script`)}
                onToggleArchive={(e) => handleToggleArchive(e, p)}
                onDelete={(e) => handleDelete(e, p)}
              />
            ))}
          </div>

          {archived.length > 0 && (
            <div className="flex flex-col gap-3">
              <span className="system-label text-[11px]">ARCHIVED ({archived.length})</span>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 opacity-60">
                {archived.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onClick={() => navigate(`/cinema-studio/${p.id}/script`)}
                    onToggleArchive={(e) => handleToggleArchive(e, p)}
                    onDelete={(e) => handleDelete(e, p)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showCreate && <NewCinemaProjectModal onCreated={handleCreated} onClose={() => setShowCreate(false)} />}
    </PageContainer>
  );
}
