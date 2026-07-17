import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clapperboard, Plus, ScanEye } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { NewCinemaProjectModal } from "@/components/cinema/NewCinemaProjectModal";
import { getCinemaProjects } from "@/lib/cinemaProjects";
import { getProviderCapability } from "@/lib/videoProviderCapabilities";
import { useToastStore } from "@/stores/useToastStore";
import { cn } from "@/lib/utils";
import type { CinemaProject } from "@/types";

const STATUS_DOT: Record<CinemaProject["status"], string> = {
  draft: "bg-readable",
  scripting: "bg-cyan",
  assets: "bg-amber",
  scenes: "bg-amber",
  complete: "bg-white",
  archived: "bg-white/20",
};

function ProjectCard({ project, onClick }: { project: CinemaProject; onClick: () => void }) {
  const videoCapability = getProviderCapability(project.video_provider);

  return (
    <div
      className="flex flex-col gap-4 p-5 rounded-card transition-all duration-150 border border-white/22 bg-white/7 hover:bg-white/10 hover:border-white/30"
      style={{ cursor: "pointer" }}
      onClick={onClick}
    >
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

      <div className="flex items-center gap-5 pt-2 border-t border-white/12">
        {[
          { label: "folders", val: project.folder_count ?? 0 },
          { label: "assets", val: project.asset_count ?? 0 },
          { label: "scenes", val: project.scene_count ?? 0 },
          { label: "shots", val: project.shot_count ?? 0 },
        ].map(({ label, val }) => (
          <div key={label} className="flex items-center gap-1">
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
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onClick={() => navigate(`/cinema-studio/${p.id}/script`)} />
          ))}
        </div>
      )}

      {showCreate && <NewCinemaProjectModal onCreated={handleCreated} onClose={() => setShowCreate(false)} />}
    </PageContainer>
  );
}
