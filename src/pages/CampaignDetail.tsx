import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Briefcase, Plus, CheckCircle2, Clock, Archive, AlertCircle, RefreshCw } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { getCampaign, getProjectsForCampaign, updateCampaign } from "@/lib/campaigns";
import { createProject } from "@/lib/projects";
import { useToastStore } from "@/stores/useToastStore";
import { createLatestRequestGuard } from "@/lib/latestRequest";
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
  const toast = useToastStore((s) => s.add);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "not-found" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editClient, setEditClient] = useState("");
  const [editBrief, setEditBrief] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectBrief, setNewProjectBrief] = useState("");
  const loadGuard = useRef(createLatestRequestGuard());
  const loadedCampaignId = useRef<string | null>(null);

  const load = useCallback(async (cid: string) => {
    // Only show loading spinner when switching to a different campaign or on first load —
    // don't blank existing data on a same-campaign refetch (e.g. after edit/create).
    const isSameCampaign = loadedCampaignId.current === cid;
    setLoadState((prev) => (isSameCampaign && prev === "ready") ? "ready" : "loading");
    if (!isSameCampaign) {
      setCampaign(null);
      setProjects([]);
    }
    const token = loadGuard.current.begin();
    try {
      const [c, ps] = await Promise.all([getCampaign(cid), getProjectsForCampaign(cid)]);
      if (!loadGuard.current.isCurrent(token)) return;
      if (!c) {
        setLoadState("not-found");
        return;
      }
      loadedCampaignId.current = cid;
      setCampaign(c);
      setProjects(ps);
      setEditTitle(c.title);
      setEditClient(c.client ?? "");
      setEditBrief(c.brief ?? "");
      setLoadState("ready");
    } catch (err) {
      if (!loadGuard.current.isCurrent(token)) return;
      console.error("CampaignDetail load failed:", err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    if (id) load(id);
    return () => { loadGuard.current.invalidate(); };
  }, [id, load]);

  async function handleSaveEdit() {
    if (!id || !campaign) return;
    try {
      await updateCampaign(id, {
        title: editTitle.trim() || campaign.title,
        client: editClient.trim() || undefined,
        brief: editBrief.trim() || undefined,
      });
      setEditing(false);
      toast("Campaign saved", "success");
      load(id);
    } catch {
      toast("Failed to save campaign", "error");
    }
  }

  async function handleQuickCreate() {
    if (!id) return;
    setCreatingProject(true);
    try {
      const projectId = await createProject({
        title: "New Project",
        campaign: campaign?.title,
        campaign_id: id,
      });
      navigate(`/projects/${projectId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg || "Failed to create project", "error");
      setCreatingProject(false);
    }
  }

  async function handleCreateProject() {
    if (!id || !newProjectTitle.trim()) return;
    setCreatingProject(true);
    try {
      const projectId = await createProject({
        title: newProjectTitle.trim(),
        brief_text: newProjectBrief.trim() || undefined,
        campaign: campaign?.title,
        campaign_id: id,
      });
      toast(`"${newProjectTitle.trim()}" created`, "success");
      setShowCreateForm(false);
      setNewProjectTitle("");
      setNewProjectBrief("");
      load(id);
      navigate(`/projects/${projectId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg || "Failed to create project", "error");
    } finally {
      setCreatingProject(false);
    }
  }

  // ── Loading state ──────────────────────────────────────────────
  if (loadState === "loading") {
    return (
      <PageContainer title="Campaign" subtitle="LOADING">
        <div className="flex items-center gap-3 py-8">
          <span className="font-ndot text-[20px] text-dim/30 animate-pulse">···</span>
          <span className="font-mono text-[12px] text-muted">Loading campaign…</span>
        </div>
      </PageContainer>
    );
  }

  // ── Not found ─────────────────────────────────────────────────
  if (loadState === "not-found") {
    return (
      <PageContainer title="Campaign" subtitle="NOT FOUND">
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <AlertCircle size={24} className="text-readable" />
          <p className="font-mono text-[13px] text-readable">Campaign not found or has been deleted.</p>
          <Button variant="ghost" size="sm" onClick={() => navigate("/campaigns")}>
            <ArrowLeft size={11} /> Back to Campaigns
          </Button>
        </div>
      </PageContainer>
    );
  }

  // ── Error state ───────────────────────────────────────────────
  if (loadState === "error") {
    return (
      <PageContainer title="Campaign" subtitle="ERROR">
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <AlertCircle size={24} className="text-red/60" />
          <p className="font-mono text-[13px] text-readable">Failed to load campaign data.</p>
          {errorMsg && (
            <p className="font-mono text-[10px] text-red/60 max-w-sm wrap-break-word">{errorMsg}</p>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => id && load(id)}>
              <RefreshCw size={11} /> Retry
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/campaigns")}>
              <ArrowLeft size={11} /> Back
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  // ── Loaded ────────────────────────────────────────────────────
  const delivered = projects.filter((p) => p.status === "delivered").length;
  const active = projects.filter((p) => p.status === "active").length;
  const winnerTotal = projects.reduce((sum, p) => sum + (p.winner_count ?? 0), 0);
  const promptTotal = projects.reduce((sum, p) => sum + (p.prompt_count ?? 0), 0);
  const resultTotal = projects.reduce((sum, p) => sum + (p.result_count ?? 0), 0);
  const winRate = promptTotal > 0 ? Math.round((winnerTotal / promptTotal) * 100) : 0;

  return (
    <PageContainer
      title={campaign!.title}
      subtitle={campaign!.client ?? "CAMPAIGN"}
      action={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/campaigns")}>
            <ArrowLeft size={11} /> Campaigns
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setShowCreateForm(true); setNewProjectTitle(""); setNewProjectBrief(""); }}
            disabled={creatingProject}
          >
            <Plus size={11} /> Add Project
          </Button>
          <Button variant="primary" size="sm" onClick={handleQuickCreate} disabled={creatingProject}>
            <Plus size={11} /> {creatingProject ? "Creating…" : "Quick Create"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-8 w-full">

        {/* Edit form */}
        {editing && (
          <div
            className="flex flex-col gap-4 p-6 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] tracking-widest uppercase text-readable">Title</span>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="h-10 px-3 font-mono text-[13px] text-soft-white bg-dark rounded-sm focus:outline-none"
                  style={{ border: "1px solid rgba(255,255,255,0.24)" }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] tracking-widest uppercase text-readable">Client</span>
                <input
                  value={editClient}
                  onChange={(e) => setEditClient(e.target.value)}
                  className="h-10 px-3 font-mono text-[13px] text-soft-white bg-dark rounded-sm focus:outline-none"
                  style={{ border: "1px solid rgba(255,255,255,0.24)" }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] tracking-widest uppercase text-readable">Brief</span>
              <textarea
                value={editBrief}
                onChange={(e) => setEditBrief(e.target.value)}
                rows={3}
                className="px-3 py-2 font-mono text-[13px] text-soft-white bg-dark rounded-sm focus:outline-none resize-none"
                style={{ border: "1px solid rgba(255,255,255,0.24)" }}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button variant="primary" size="sm" onClick={handleSaveEdit}>Save</Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Create project form */}
        {showCreateForm && (
          <div
            className="flex flex-col gap-4 p-6 rounded-card"
            style={{ border: "var(--border-strong)", background: "var(--surface-card)" }}
          >
            <div className="flex items-center justify-between">
              <span className="system-label">NEW PROJECT</span>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="text-dim/40 hover:text-white transition-precise font-mono text-[10px] tracking-widest"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] tracking-widest uppercase text-readable">Title</span>
              <input
                autoFocus
                value={newProjectTitle}
                onChange={(e) => setNewProjectTitle(e.target.value)}
                placeholder="Project name…"
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateProject(); if (e.key === "Escape") setShowCreateForm(false); }}
                className="h-10 px-3 font-sans text-[14px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none"
                style={{ border: "1px solid rgba(255,255,255,0.18)" }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] tracking-widest uppercase text-readable">Brief <span className="text-muted">(optional)</span></span>
              <textarea
                value={newProjectBrief}
                onChange={(e) => setNewProjectBrief(e.target.value)}
                placeholder="What this project needs to solve…"
                rows={3}
                className="px-3 py-2 font-mono text-[13px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none resize-none"
                style={{ border: "1px solid rgba(255,255,255,0.16)" }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="primary" size="sm"
                onClick={handleCreateProject}
                disabled={!newProjectTitle.trim() || creatingProject}
              >
                {creatingProject ? "Creating…" : "Create Project"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}>Cancel</Button>
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
            <div
              key={s.label}
              className="flex flex-col gap-1 p-4 rounded-sm"
              style={{ background: "rgba(255,255,255,0.04)", border: "var(--border-default)" }}
            >
              <span className="font-mono text-[9px] tracking-widest uppercase text-readable">{s.label}</span>
              <span className="font-mono text-[20px] text-white leading-tight">{s.value}</span>
            </div>
          ))}
        </div>

        {/* Brief */}
        {campaign!.brief && !editing && (
          <div
            className="flex flex-col gap-2 p-5 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <span className="font-mono text-[10px] tracking-widest uppercase text-readable">BRIEF</span>
            <p className="font-mono text-[13px] text-soft-white leading-relaxed">{campaign!.brief}</p>
          </div>
        )}

        {/* Projects list */}
        <div className="flex flex-col gap-3">
          <span className="font-mono text-[10px] tracking-widest uppercase text-readable">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </span>

          {projects.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <Briefcase size={22} className="text-readable" />
              <p className="font-mono text-[13px] text-readable">No projects yet. Add one to get started.</p>
              <Button variant="ghost" size="sm" onClick={() => { setShowCreateForm(true); setNewProjectTitle(""); setNewProjectBrief(""); }}>
                <Plus size={11} /> Add Project
              </Button>
            </div>
          ) : (
            projects.map((p) => (
              <div
                key={p.id}
                className="flex items-start gap-4 p-5 rounded-card transition-precise
                  border border-white/22 bg-white/7 hover:bg-white/10 hover:border-white/30"
                style={{ cursor: "pointer" }}
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                <span className={`inline-block w-2 h-2 rounded-full shrink-0 mt-1 ${STATUS_DOT[p.status]}`} />
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="font-sans text-[14px] font-semibold text-white truncate">{p.title}</span>
                  <span className="font-mono text-[10px] text-readable">{STATUS_LABEL[p.status]}</span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-mono text-[14px] text-white leading-none">{p.prompt_count ?? 0}</span>
                    <span className="font-mono text-[8px] text-muted uppercase tracking-widest">prompts</span>
                  </div>
                  {(p.result_count ?? 0) > 0 && (
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="font-mono text-[14px] text-white leading-none">{p.result_count}</span>
                      <span className="font-mono text-[8px] text-muted uppercase tracking-widest">results</span>
                    </div>
                  )}
                  {(p.winner_count ?? 0) > 0 && (
                    <div className="flex items-center gap-1">
                      <CheckCircle2 size={10} className="text-white/60" />
                      <span className="font-mono text-[12px] text-white">{p.winner_count}</span>
                    </div>
                  )}
                  {p.status === "delivered" && <Archive size={12} className="text-readable" />}
                  {p.status === "active" && <Clock size={12} className="text-cyan/60" />}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </PageContainer>
  );
}
