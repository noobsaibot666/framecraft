import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Copy, Check, Star, AlertTriangle, GitBranch,
  ExternalLink, ChevronRight, GitFork,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import {
  findRoot, loadFamily, buildTree, flattenTree,
  diffPromptText, diffMetadata,
  type VersionNode, type DiffSegment,
} from "@/lib/lineage";
import { cn } from "@/lib/utils";
import type { Prompt } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────

function riskColor(risk: number): string {
  if (risk >= 7) return "text-red/70";
  if (risk >= 4) return "text-white/50";
  return "text-dim/40";
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={8} className={cn(i < value ? "text-white/60 fill-white/40" : "text-white/10")} />
      ))}
    </div>
  );
}

// ─── Diff renderer ────────────────────────────────────────────

function DiffText({ segments }: { segments: DiffSegment[] }) {
  return (
    <p className="font-mono text-[10px] leading-relaxed">
      {segments.map((seg, i) => (
        <span key={i} className={cn(
          seg.type === "added"   && "bg-white/10 text-white rounded-sm px-0.5",
          seg.type === "removed" && "bg-red/10 text-red/60 line-through rounded-sm px-0.5",
          seg.type === "equal"   && "text-dim/60",
        )}>
          {seg.text}
        </span>
      ))}
    </p>
  );
}

// ─── Version Card ─────────────────────────────────────────────

function VersionCard({
  node,
  isSelected,
  isCompare,
  depth,
  onClick,
  onOpen,
  onFork,
  onCopy,
  copied,
}: {
  node: VersionNode;
  isSelected: boolean;
  isCompare: boolean;
  depth: number;
  onClick: () => void;
  onOpen: () => void;
  onFork: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const indent = Math.min(depth, 4) * 16;
  const isBranch = depth > 0;

  return (
    <div style={{ paddingLeft: indent }}>
      <div
        className={cn(
          "relative flex flex-col gap-2 p-3 rounded-card cursor-pointer group transition-all duration-100",
          isSelected && "ring-1 ring-white/40",
          isCompare && "ring-1 ring-white/20",
          !isSelected && !isCompare && "hover:ring-1 hover:ring-white/10"
        )}
        style={{ border: "var(--border-default)", background: isSelected ? "rgba(255,255,255,0.06)" : "var(--surface-card)" }}
        onClick={onClick}
      >
        {/* Branch indicator */}
        {isBranch && (
          <div className="absolute -left-3 top-4 flex items-center gap-1 text-dim/30">
            <GitBranch size={8} />
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-[9px] text-dim/50 shrink-0">v{node.version}</span>
            <span className={cn(
              "font-sans text-[12px] font-medium truncate",
              isSelected ? "text-white" : "text-soft-white"
            )}>
              {node.title}
            </span>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-1 shrink-0">
            {node.is_winner && (
              <span className="font-mono text-[7px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm text-white/60"
                style={{ border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)" }}>
                WIN
              </span>
            )}
            {node.is_failed && (
              <span className="font-mono text-[7px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm text-red/50"
                style={{ border: "1px solid rgba(215,25,33,0.25)", background: "rgba(215,25,33,0.06)" }}>
                FAIL
              </span>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4">
          <Stars value={node.rating} />
          <span className={cn("font-mono text-[9px]", riskColor(node.ai_look_risk))}>
            AI {node.ai_look_risk}/10
          </span>
          {node.result_count > 0 && (
            <span className="font-mono text-[9px] text-dim/40">
              {node.result_count} result{node.result_count !== 1 ? "s" : ""}
            </span>
          )}
          {node.children.length > 0 && (
            <span className="flex items-center gap-1 font-mono text-[9px] text-dim/30">
              <GitBranch size={8} /> {node.children.length}
            </span>
          )}
        </div>

        {/* Provider / date */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[8px] text-dim/30 tracking-widest uppercase">{node.provider}</span>
          {node.aspect_ratio && (
            <span className="font-mono text-[8px] text-dim/30">{node.aspect_ratio}</span>
          )}
          <span className="flex-1" />
          <span className="font-mono text-[8px] text-dim/25">
            {new Date(node.created_at).toLocaleDateString()}
          </span>
        </div>

        {/* Actions (show on hover or selected) */}
        <div className={cn(
          "flex items-center gap-1.5 transition-opacity",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          <button type="button" onClick={(e) => { e.stopPropagation(); onCopy(); }}
            className="flex items-center gap-1 font-mono text-[8px] tracking-widest uppercase px-2 py-1 rounded-sm text-dim hover:text-white transition-precise"
            style={{ border: "var(--border-dim)" }}>
            {copied ? <Check size={7} /> : <Copy size={7} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onFork(); }}
            className="flex items-center gap-1 font-mono text-[8px] tracking-widest uppercase px-2 py-1 rounded-sm text-dim hover:text-white transition-precise"
            style={{ border: "var(--border-dim)" }}>
            <GitFork size={7} /> Fork
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }}
            className="flex items-center gap-1 font-mono text-[8px] tracking-widest uppercase px-2 py-1 rounded-sm text-dim hover:text-white transition-precise"
            style={{ border: "var(--border-dim)" }}>
            <ExternalLink size={7} /> Open
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Comparison Panel ─────────────────────────────────────────

function ComparePanel({ a, b }: { a: VersionNode; b: VersionNode }) {
  const promptDiff = diffPromptText(a.prompt_text, b.prompt_text);
  const avoidDiff = (a.avoidance_text || b.avoidance_text)
    ? diffPromptText(a.avoidance_text ?? "", b.avoidance_text ?? "")
    : null;
  const changedMeta = diffMetadata(a, b);

  const metaLabel: Record<string, string> = {
    provider: "Provider", aspect_ratio: "Aspect Ratio", model_version: "Model Version",
    camera: "Camera", lens: "Lens", lighting: "Lighting",
    style_ref: "Style Ref", character_ref: "Character Ref", image_ref: "Image Ref",
    avoidance_text: "Avoidance", category: "Category", use_case: "Use Case",
  };

  const hasChanges = promptDiff.some((s) => s.type !== "equal") ||
    (avoidDiff && avoidDiff.some((s) => s.type !== "equal")) ||
    changedMeta.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[9px] text-dim/50">v{a.version}</span>
        <ChevronRight size={10} className="text-dim/30" />
        <span className="font-mono text-[9px] text-white/70">v{b.version}</span>
        {!hasChanges && (
          <span className="font-mono text-[9px] text-dim/30">— identical</span>
        )}
      </div>

      {/* Prompt text diff */}
      <div className="flex flex-col gap-2 p-3 rounded-sm" style={{ border: "var(--border-dim)" }}>
        <span className="system-label">PROMPT TEXT</span>
        <DiffText segments={promptDiff} />
      </div>

      {/* Avoidance diff */}
      {avoidDiff && (
        <div className="flex flex-col gap-2 p-3 rounded-sm" style={{ border: "var(--border-dim)" }}>
          <span className="system-label">AVOIDANCE TEXT</span>
          <DiffText segments={avoidDiff} />
        </div>
      )}

      {/* Metadata changes */}
      {changedMeta.length > 0 && (
        <div className="flex flex-col gap-2 p-3 rounded-sm" style={{ border: "var(--border-dim)" }}>
          <span className="system-label">METADATA CHANGES</span>
          <div className="flex flex-col gap-2">
            {changedMeta.map((field) => {
              const fieldKey = field as keyof Prompt;
              const aVal = String((a[fieldKey] as string | number | undefined) ?? "—");
              const bVal = String((b[fieldKey] as string | number | undefined) ?? "—");
              return (
                <div key={field} className="grid grid-cols-[100px_1fr_1fr] gap-3 items-start">
                  <span className="font-mono text-[8px] text-dim/50 tracking-widest uppercase pt-0.5">
                    {metaLabel[field] ?? field}
                  </span>
                  <span className="font-mono text-[9px] text-red/50 line-through">{aVal}</span>
                  <span className="font-mono text-[9px] text-white/70">{bVal}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Side-by-side result summary */}
      <div className="grid grid-cols-2 gap-3">
        {[a, b].map((node) => (
          <div key={node.id} className="flex flex-col gap-2 p-3 rounded-sm" style={{ border: "var(--border-dim)" }}>
            <span className="system-label">v{node.version} RESULTS</span>
            <div className="flex items-center gap-3">
              <Stars value={node.rating} />
              <span className={cn("font-mono text-[9px]", riskColor(node.ai_look_risk))}>
                AI {node.ai_look_risk}/10
              </span>
            </div>
            <span className="font-mono text-[9px] text-dim/40">
              {node.result_count} result{node.result_count !== 1 ? "s" : ""}
              {node.is_winner ? " · WINNER" : ""}
              {node.is_failed ? " · FAILED" : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export function LineageView() {
  const { promptId } = useParams<{ promptId: string }>();
  const navigate = useNavigate();

  const [nodes, setNodes] = useState<VersionNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<VersionNode | null>(null);
  const [compare, setCompare] = useState<VersionNode | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [rootTitle, setRootTitle] = useState("");

  useEffect(() => {
    if (!promptId) return;
    (async () => {
      setLoading(true);
      try {
        const rootId = await findRoot(promptId);
        const family = await loadFamily(rootId);
        const tree = buildTree(family);
        const flat = flattenTree(tree);
        setNodes(flat);
        if (flat.length > 0) setRootTitle(flat[0].title);
        // Select the prompt we navigated from
        const target = flat.find((n) => n.id === promptId) ?? flat[0] ?? null;
        setSelected(target);
      } finally {
        setLoading(false);
      }
    })();
  }, [promptId]);

  const handleCopy = (node: VersionNode) => {
    navigator.clipboard.writeText(node.prompt_text);
    setCopiedId(node.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleFork = (node: VersionNode) => {
    navigate(`/craft/${node.id}?fork=1`);
  };

  const handlePrimarySelect = (node: VersionNode) => {
    setSelected(node);
    setCompare(null);
  };

  // Build depth map for visual indentation
  const depthMap = new Map<string, number>();
  const computeDepths = (n: VersionNode, d: number) => {
    depthMap.set(n.id, d);
    for (const child of n.children) computeDepths(child, d + 1);
  };
  if (nodes.length > 0) {
    const tree = buildTree([...nodes]);
    if (tree) computeDepths(tree, 0);
  }

  const compareMode = selected !== null && compare !== null;

  if (loading) {
    return (
      <PageContainer title="Lineage" subtitle="LOADING…">
        <div className="flex items-center justify-center h-40">
          <span className="font-mono text-[10px] text-dim/40">Loading…</span>
        </div>
      </PageContainer>
    );
  }

  if (nodes.length === 0) {
    return (
      <PageContainer title="Lineage" subtitle="VERSION HISTORY">
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <span className="font-mono text-[12px] text-dim/40">No version history found.</span>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft size={10} /> Back
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={rootTitle || "Lineage"}
      subtitle={`VERSION HISTORY · ${nodes.length} VERSION${nodes.length !== 1 ? "S" : ""}`}
      action={
        <div className="flex items-center gap-2">
          {compareMode && (
            <button type="button" onClick={() => setCompare(null)}
              className="font-mono text-[9px] tracking-widest uppercase px-3 py-1.5 rounded-sm text-dim hover:text-white transition-precise"
              style={{ border: "var(--border-dim)" }}>
              Clear Compare
            </button>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft size={11} /> Back
          </Button>
        </div>
      }
    >
      {compareMode && (
        <div className="mb-2 px-3 py-2 rounded-sm font-mono text-[9px] text-dim/50"
          style={{ background: "rgba(255,255,255,0.03)", border: "var(--border-dim)" }}>
          Comparing <span className="text-white/50">v{selected!.version}</span> → <span className="text-white/70">v{compare!.version}</span>. Click a card to change selection.
        </div>
      )}

      <div className={cn("grid gap-6", compareMode ? "grid-cols-[280px_1fr]" : "grid-cols-[280px_1fr]")}>

        {/* Left: version tree */}
        <div className="flex flex-col gap-2">
          <span className="system-label px-1">VERSIONS</span>
          <div className="flex flex-col gap-1.5">
            {nodes.map((node) => (
              <VersionCard
                key={node.id}
                node={node}
                isSelected={selected?.id === node.id}
                isCompare={compare?.id === node.id}
                depth={depthMap.get(node.id) ?? 0}
                onClick={() => {
                  if (!selected) {
                    handlePrimarySelect(node);
                  } else if (selected.id === node.id) {
                    // deselect
                    setSelected(null);
                    setCompare(null);
                  } else {
                    // second click on a different node = set as compare
                    setCompare(node);
                  }
                }}
                onOpen={() => navigate(`/library/${node.id}`)}
                onFork={() => handleFork(node)}
                onCopy={() => handleCopy(node)}
                copied={copiedId === node.id}
              />
            ))}
          </div>

          {nodes.length > 1 && !compareMode && (
            <p className="font-mono text-[8px] text-dim/30 px-1 pt-1">
              Click a second version to compare.
            </p>
          )}
        </div>

        {/* Right: detail or comparison */}
        <div className="flex flex-col gap-4">
          {compareMode ? (
            <ComparePanel a={selected!} b={compare!} />
          ) : selected ? (
            <>
              {/* Selected version detail */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] text-dim/50">v{selected.version}</span>
                  <span className="font-sans text-[14px] font-medium text-white">{selected.title}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {selected.is_winner && (
                    <span className="font-mono text-[8px] tracking-widest uppercase px-2 py-1 rounded-sm text-white/60"
                      style={{ border: "1px solid rgba(255,255,255,0.15)" }}>WINNER</span>
                  )}
                  {selected.is_failed && (
                    <span className="font-mono text-[8px] tracking-widest uppercase px-2 py-1 rounded-sm text-red/50"
                      style={{ border: "1px solid rgba(215,25,33,0.25)" }}>FAILED</span>
                  )}
                </div>
              </div>

              {/* Prompt text */}
              <div className="flex flex-col gap-2 p-4 rounded-card"
                style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
                <div className="flex items-center justify-between">
                  <span className="system-label">PROMPT TEXT</span>
                  <button type="button" onClick={() => handleCopy(selected)}
                    className="flex items-center gap-1 font-mono text-[8px] tracking-widest uppercase px-2 py-1 rounded-sm text-dim hover:text-white transition-precise"
                    style={{ border: "var(--border-dim)" }}>
                    {copiedId === selected.id ? <Check size={8} /> : <Copy size={8} />}
                    {copiedId === selected.id ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="font-mono text-[12px] text-soft-white leading-relaxed">
                  {selected.prompt_text}
                </p>
              </div>

              {/* Avoidance */}
              {selected.avoidance_text && (
                <div className="flex flex-col gap-2 p-4 rounded-card"
                  style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle size={9} className="text-red/40" />
                    <span className="system-label">AVOIDANCE</span>
                  </div>
                  <p className="font-mono text-[10px] text-dim/70 leading-relaxed">{selected.avoidance_text}</p>
                </div>
              )}

              {/* Metadata grid */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "PROVIDER",   val: selected.provider },
                  { label: "ASPECT",     val: selected.aspect_ratio },
                  { label: "MODEL",      val: selected.model_version },
                  { label: "CAMERA",     val: selected.camera },
                  { label: "LENS",       val: selected.lens },
                  { label: "LIGHTING",   val: selected.lighting },
                  { label: "STYLE REF",  val: selected.style_ref },
                  { label: "CHAR REF",   val: selected.character_ref },
                  { label: "IMAGE REF",  val: selected.image_ref },
                ].filter((f) => f.val).map((f) => (
                  <div key={f.label} className="flex flex-col gap-0.5 px-3 py-2 rounded-sm"
                    style={{ background: "rgba(255,255,255,0.03)", border: "var(--border-dim)" }}>
                    <span className="font-mono text-[8px] text-dim/40 tracking-widest uppercase">{f.label}</span>
                    <span className="font-mono text-[10px] text-soft-white truncate">{f.val}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => navigate(`/library/${selected.id}`)}>
                  <ExternalLink size={10} /> Open Prompt
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleFork(selected)}>
                  <GitFork size={10} /> Fork Version
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-48">
              <span className="font-mono text-[10px] text-dim/30">Select a version to inspect.</span>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
