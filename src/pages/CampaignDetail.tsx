import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Briefcase, Plus, CheckCircle2, Clock, Archive } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { getCampaign, getProjectsForCampaign, updateCampaign } from "@/lib/campaigns";
import { createProject } from "@/lib/projects";
import type { Campaign, Project } from "@/types";

const STATUS_LABEL: Record<Project["status"], string> = {
  draft:     "Draft",
  active:    "Active",
  review:    "Review",
  archived:  "Archived",
  delivered: "Delivered",
};

const STATUS_DOT: Record<Project["status"], string> = {
  draft:     "bg-readable",
  active:    "bg-cyan",
  review:    "bg-amber",
  archived:  "bg-white/20",
  delivered: "bg-white",
};

export function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editClient, setEditClient] = useState("");
  const [editBrief, setEditBrief] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  useEffect(() => { if (id) load(id); }, [id]);

  async function load(cid: string) {
    const [c, ps] = await Promise.all([getCampaign(cid), getProjectsForCampaign(cid)]);
    setCampaign(c);
    setProjects(ps);
    if (c) { setEditTitle(c.title); setEditClient(c.client ?? ""); setEditBrief(c.brief ?? ""); }
  }

  async function handleSaveEdit() {
    if (!id || !campaign) return;
    await updateCampaign(id, {
      title: editTitle.trim() || campaign.title,
      client: editClient.trim() || undefined,
      brief: editBrief.trim() || undefined,
    });
    setEditing(false);
    load(id);
  }

  async function handleAddProject() {
    if (!id) return;
    setCreatingProject(true);
    const projectId = await createProject({ title: "New Project", campaign_id: id });
    navigate(`/projects/${projectId}`);
  }

  if (!campaign) {
    return (
      <PageContainer title="Campaign" subtitle="LOADING">
        <div className="font-mono text-[12px] text-readable">Loading…</div>
      </PageContainer>
    );
  }

  const delivered = projects.filter((p) => p.status === "delivered").length;
  const active = projects.filter((p) => p.status === "active").length;
  const winnerTotal = projects.reduce((sum, p) => sum + (p.winner_count ?? 0), 0);
  const promptTotal = projects.reduce((sum, p) => sum + (p.prompt_count ?? 0), 0);
  const resultTotal = projects.reduce((sum, p) => sum + (p.result_count ?? 0), 0);
  const winRate = promptTotal > 0 ? Math.round((winnerTotal / promptTotal) * 100) : 0;

  return (
    <PageContainer
      title={campaign.title}
      subtitle={campaign.client ?? "CAMPAIGN"}
      action={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/campaigns")}>
            <ArrowLeft size={11} /> Campaigns
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
          <Button variant="primary" size="sm" onClick={handleAddProject} disabled={creatingProject}>
            <Plus size={11} /> Add Project
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-8 max-w-5xl">

        {/* Edit form */}
        {editing && (
          <div className="flex flex-col gap-4 p-6 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] tracking-widest uppercase text-readable">Title</span>
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                  className="h-10 px-3 font-mono text-[12px] text-soft-white bg-dark rounded-sm focus:outline-none"
                  style={{ border: "1px solid rgba(255,255,255,0.24)" }} />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] tracking-widest uppercase text-readable">Client</span>
                <input value={editClient} onChange={(e) => setEditClient(e.target.value)}
                  className="h-10 px-3 font-mono text-[12px] text-soft-white bg-dark rounded-sm focus:outline-none"
                  style={{ border: "1px solid rgba(255,255,255,0.24)" }} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] tracking-widest uppercase text-readable">Brief</span>
              <textarea value={editBrief} onChange={(e) => setEditBrief(e.target.value)} rows={3}
                className="px-3 py-2 font-mono text-[12px] text-soft-white bg-dark rounded-sm focus:outline-none resize-none"
                style={{ border: "1px solid rgba(255,255,255,0.24)" }} />
            </div>
            <div className="flex items-center gap-3">
              <Button variant="primary" size="sm" onClick={handleSaveEdit}>Save</Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Stats strip */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: "PROJECTS",  value: projects.length },
            { label: "ACTIVE",    value: active },
            { label: "DELIVERED", value: delivered },
            { label: "PROMPTS",   value: promptTotal },
            { label: "RESULTS",   value: resultTotal },
            { label: "WIN RATE",  value: winnerTotal > 0 ? `${winRate}%` : "—" },
          ].map((s) => (
            <div key={s.label} className="flex flex-col gap-1 p-4 rounded-sm"
              style={{ background: "rgba(255,255,255,0.04)", border: "var(--border-default)" }}>
              <span className="font-mono text-[9px] tracking-widest uppercase text-readable">{s.label}</span>
              <span className="font-mono text-[20px] text-white">{s.value}</span>
            </div>
          ))}
        </div>

        {/* Brief */}
        {campaign.brief && !editing && (
          <div className="flex flex-col gap-2 p-5 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
            <span className="font-mono text-[10px] tracking-widest uppercase text-readable">BRIEF</span>
            <p className="font-mono text-[12px] text-soft-white leading-relaxed">{campaign.brief}</p>
          </div>
        )}

        {/* Projects */}
        <div className="flex flex-col gap-3">
          <span className="font-mono text-[10px] tracking-widest uppercase text-readable">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </span>

          {projects.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <Briefcase size={22} className="text-readable" />
              <p className="font-mono text-[12px] text-readable">No projects yet. Add one to get started.</p>
              <Button variant="ghost" size="sm" onClick={handleAddProject}>
                <Plus size={11} /> Add Project
              </Button>
            </div>
          ) : (
            projects.map((p) => (
              <div key={p.id}
                className="flex items-center gap-4 p-5 rounded-card cursor-pointer hover:opacity-90 transition-precise"
                style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[p.status]}`} />
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="font-sans text-[13px] font-semibold text-white truncate">{p.title}</span>
                  <span className="font-mono text-[10px] text-readable">{STATUS_LABEL[p.status]}</span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-mono text-[13px] text-white">{p.prompt_count ?? 0}</span>
                    <span className="font-mono text-[8px] text-muted uppercase tracking-widest">prompts</span>
                  </div>
                  {(p.result_count ?? 0) > 0 && (
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="font-mono text-[13px] text-white">{p.result_count}</span>
                      <span className="font-mono text-[8px] text-muted uppercase tracking-widest">results</span>
                    </div>
                  )}
                  {(p.winner_count ?? 0) > 0 && (
                    <div className="flex items-center gap-1">
                      <CheckCircle2 size={10} className="text-white/60" />
                      <span className="font-mono text-[11px] text-white">{p.winner_count}</span>
                    </div>
                  )}
                  {p.status === "delivered" && (
                    <Archive size={12} className="text-readable" />
                  )}
                  {p.status === "active" && (
                    <Clock size={12} className="text-cyan/60" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </PageContainer>
  );
}
