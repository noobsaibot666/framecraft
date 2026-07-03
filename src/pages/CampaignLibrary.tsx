import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Briefcase, Archive, Trash2 } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { getCampaigns, createCampaign, updateCampaign, deleteCampaign } from "@/lib/campaigns";
import { useToastStore } from "@/stores/useToastStore";
import type { Campaign } from "@/types";

export function CampaignLibrary() {
  const navigate = useNavigate();
  const toast = useToastStore((s) => s.add);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  // Audit doc 05 §2 — without this, the empty state rendered on every mount
  // before the async fetch resolved, reproducing "Campaign page often loads
  // empty" in the list view (CampaignDetail already had this guard).
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newClient, setNewClient] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setCampaigns(await getCampaigns());
    } catch {
      toast("Failed to load campaigns", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const c = await createCampaign({ title: newTitle.trim(), client: newClient.trim() || undefined });
      setNewTitle("");
      setNewClient("");
      setShowCreate(false);
      toast(`"${c.title}" created`, "success");
      navigate(`/campaigns/${c.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err) || "Failed to create campaign", "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleArchive(c: Campaign) {
    try {
      await updateCampaign(c.id, { status: c.status === "archived" ? "active" : "archived" });
      toast(c.status === "archived" ? "Campaign restored" : "Campaign archived", "info");
      load();
    } catch {
      toast("Failed to update campaign", "error");
    }
  }

  async function handleDelete(c: Campaign) {
    try {
      await deleteCampaign(c.id);
      toast("Campaign deleted", "info");
      load();
    } catch {
      toast("Failed to delete campaign", "error");
    }
  }

  const active = campaigns.filter((c) => c.status === "active");
  const archived = campaigns.filter((c) => c.status === "archived");

  return (
    <PageContainer title="Campaigns" subtitle="JOB ORGANIZATION">
      <div className="flex flex-col gap-8 w-full">

        {/* Header row */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-[12px] text-readable tracking-widest uppercase">
            {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}
          </span>
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={11} /> New Campaign
          </Button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div
            className="flex flex-col gap-4 p-6 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <span className="font-sans text-[14px] font-semibold text-white tracking-wide">NEW CAMPAIGN</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] tracking-widest uppercase text-readable">Title</span>
                <input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="e.g. Summer 2026 Campaign"
                  className="h-10 px-3 font-mono text-[13px] text-soft-white bg-dark rounded-sm focus:outline-none"
                  style={{ border: "1px solid rgba(255,255,255,0.24)" }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] tracking-widest uppercase text-readable">Client</span>
                <input
                  value={newClient}
                  onChange={(e) => setNewClient(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="e.g. Acme Co"
                  className="h-10 px-3 font-mono text-[13px] text-soft-white bg-dark rounded-sm focus:outline-none"
                  style={{ border: "1px solid rgba(255,255,255,0.24)" }}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="primary" size="sm" onClick={handleCreate} disabled={!newTitle.trim() || creating}>
                {creating ? "Creating…" : "Create"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowCreate(false); setNewTitle(""); setNewClient(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Loading state — must gate the empty state below, not race it */}
        {loading && (
          <div className="flex items-center gap-3 py-8">
            <span className="font-ndot text-[20px] text-dim/30 animate-pulse">···</span>
            <span className="font-mono text-[12px] text-muted">Loading campaigns…</span>
          </div>
        )}

        {/* Empty state — centered in full width */}
        {!loading && campaigns.length === 0 && !showCreate && (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center w-full">
            <Briefcase size={28} className="text-readable" />
            <p className="font-mono text-[13px] text-readable leading-relaxed max-w-xs">
              Campaigns group projects under a single client job. Create one to get started.
            </p>
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={11} /> Create First Campaign
            </Button>
          </div>
        )}

        {/* Active campaigns */}
        {active.length > 0 && (
          <div className="flex flex-col gap-3">
            {active.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                onClick={() => navigate(`/campaigns/${c.id}`)}
                onArchive={() => handleArchive(c)}
                onDelete={() => handleDelete(c)}
              />
            ))}
          </div>
        )}

        {/* Archived */}
        {archived.length > 0 && (
          <div className="flex flex-col gap-3">
            <span className="font-mono text-[10px] text-muted tracking-widest uppercase">Archived</span>
            {archived.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                dimmed
                onClick={() => navigate(`/campaigns/${c.id}`)}
                onArchive={() => handleArchive(c)}
                onDelete={() => handleDelete(c)}
              />
            ))}
          </div>
        )}

      </div>
    </PageContainer>
  );
}

function CampaignCard({
  campaign, dimmed, onClick, onArchive, onDelete,
}: {
  campaign: Campaign;
  dimmed?: boolean;
  onClick: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      className={`flex items-start gap-5 p-5 rounded-card group transition-precise
        border border-white/22 bg-white/7
        hover:bg-white/10 hover:border-white/30
        ${dimmed ? "opacity-50 hover:opacity-80" : ""}`}
      style={{ cursor: "pointer" }}
      onClick={onClick}
    >
      {/* Icon aligned with first line of text */}
      <Briefcase size={15} className="text-readable shrink-0 mt-0.5" />

      {/* Title + client */}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="font-sans text-[15px] font-semibold text-white truncate">{campaign.title}</span>
        {campaign.client && (
          <span className="font-mono text-[12px] text-readable">{campaign.client}</span>
        )}
      </div>

      {/* Right side: project count + actions */}
      <div className="flex items-start gap-5 shrink-0">
        <div className="flex flex-col items-end gap-0.5">
          <span className="font-mono text-[16px] text-white leading-none">{campaign.project_count ?? 0}</span>
          <span className="font-mono text-[9px] text-muted tracking-widest uppercase">projects</span>
        </div>

        <div
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-precise"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onArchive}
            className="flex items-center justify-center w-7 h-7 rounded-sm text-readable hover:text-white hover:bg-white/10 transition-precise"
            title={campaign.status === "archived" ? "Restore" : "Archive"}
          >
            <Archive size={12} />
          </button>
          {confirmDelete ? (
            <>
              <button
                onClick={() => { onDelete(); setConfirmDelete(false); }}
                className="flex items-center justify-center px-2 h-7 rounded-sm font-mono text-[10px] text-red hover:bg-red/10 transition-precise"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex items-center justify-center px-2 h-7 rounded-sm font-mono text-[10px] text-readable hover:text-white transition-precise"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center justify-center w-7 h-7 rounded-sm text-readable hover:text-red hover:bg-red/8 transition-precise"
              title="Delete campaign"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
