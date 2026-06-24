import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Scan, Copy, Check, AlertTriangle, ArrowRight, Tag, Upload, X, Settings, ShieldAlert, BookOpen, ListChecks, FolderPlus, ChevronDown, Plus } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { usePromptStore } from "@/stores/usePromptStore";
import { AI_MODELS, getApiKey } from "@/lib/aiConfig";
import type { AIModel } from "@/lib/aiConfig";
import { parseBriefResult } from "@/lib/aiResultParsers";
import type { BriefResult, GeneratedPrompt, SuggestedRecipe } from "@/lib/aiResultParsers";
import { getProjects, createProject, addPromptToProject } from "@/lib/projects";
import type { Project } from "@/types";
import { cn } from "@/lib/utils";

// ─── AI Prompt ────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert creative director and Midjourney prompt engineer for advertising-grade production.

Analyze the creative brief and return ONLY a valid JSON object (no markdown, no explanation):
{
  "summary": "2-3 sentence summary of the brief's core ask and objective",
  "production_goal": "one sentence — what this campaign must achieve visually",
  "creative_direction": "overall visual direction and aesthetic approach",
  "tone": "tone descriptor (e.g. luxury minimal, bold editorial, warm lifestyle)",
  "key_elements": ["core visual element 1", "element 2"],
  "required_deliverables": ["hero key visual", "lifestyle context shot", "detail close-up"],
  "key_constraints": ["brand rule or restriction 1", "constraint 2"],
  "risk_areas": ["specific visual risk for this category — e.g. product reflections may look synthetic", "another risk if present"],
  "prompts": [
    {
      "title": "descriptive 3-6 word title",
      "prompt": "complete Midjourney-ready prompt with style, lighting, composition, and --ar parameter",
      "use_case": "what this shot serves in the campaign",
      "tags": ["category", "style"],
      "aspect_ratio": "16:9"
    }
  ],
  "suggested_recipes": [
    {
      "title": "Recipe name (3-5 words)",
      "description": "one sentence on what this recipe produces and when to use it",
      "token_sequence": ["subject token", "environment token", "lighting token", "camera token", "style token", "--ar 16:9"]
    }
  ]
}

required_deliverables: list what the campaign actually needs as distinct shots (not creative concepts — concrete deliverables like "hero pack shot", "talent lifestyle", "texture detail").
key_constraints: brand rules, legal restrictions, or production limits from the brief. Empty array if none stated.
risk_areas: what could go wrong visually for this specific brief — AI-look risks, category-specific production traps. 2-3 items maximum.
suggested_recipes: 1-2 reusable prompt structures for this campaign type. token_sequence is an ordered list of prompt tokens, not a full sentence.
Generate 4-5 distinct prompt variations covering: hero/key visual, lifestyle/context, detail close-up, alternative angle. Every prompt must be immediately usable in Midjourney.
Return only the JSON — no markdown fences, no preamble.`;

// ─── API Call ─────────────────────────────────────────────────

type BriefContent =
  | { type: "text"; text: string }
  | { type: "pdf"; base64: string };

async function analyzeBrief(content: BriefContent, model: AIModel): Promise<BriefResult> {
  const apiKey = getApiKey(model.provider);
  if (!apiKey) throw new Error(`No API key configured for ${model.provider}. Add it in Settings.`);

  if (content.type === "pdf" && model.provider === "openai") {
    throw new Error("PDF upload requires an Anthropic model. Paste the brief as text to use OpenAI.");
  }

  let rawText: string;

  if (model.provider === "anthropic") {
    const userContent =
      content.type === "pdf"
        ? [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: content.base64 } },
            { type: "text", text: SYSTEM_PROMPT },
          ]
        : [{ type: "text", text: `BRIEF:\n${content.text}\n\n${SYSTEM_PROMPT}` }];

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: model.id,
        max_tokens: 3072,
        messages: [{ role: "user", content: userContent }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(err?.error?.message ?? `Anthropic API error ${res.status}`);
    }
    const data = await res.json() as { content: { type: string; text: string }[] };
    rawText = data.content.find((c) => c.type === "text")?.text ?? "";

  } else {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: model.id,
        max_tokens: 3072,
        messages: [{ role: "user", content: `BRIEF:\n${(content as { type: "text"; text: string }).text}\n\n${SYSTEM_PROMPT}` }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(err?.error?.message ?? `OpenAI API error ${res.status}`);
    }
    const data = await res.json() as { choices: { message: { content: string } }[] };
    rawText = data.choices[0]?.message?.content ?? "";
  }

  return parseBriefResult(rawText);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Copy Button ──────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="flex items-center gap-1 font-mono text-[8px] tracking-widest uppercase text-dim hover:text-white transition-precise px-2 py-1 rounded-sm"
      style={{ border: "var(--border-dim)" }}>
      {copied ? <Check size={8} className="text-white/60" /> : <Copy size={8} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ─── Prompt Card ──────────────────────────────────────────────

function PromptCard({ p, onImport, imported, disabled = false }: {
  p: GeneratedPrompt;
  onImport: (p: GeneratedPrompt) => void;
  imported: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-card"
      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-sans text-[12px] font-semibold text-white truncate">{p.title}</span>
          <span className="font-mono text-[9px] text-dim/50">{p.use_case}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {p.aspect_ratio && (
            <span className="font-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm text-dim/50"
              style={{ border: "var(--border-dim)" }}>{p.aspect_ratio}</span>
          )}
          <CopyButton text={p.prompt} />
          {imported ? (
            <span className="flex items-center gap-1 font-mono text-[8px] text-white/40">
              <Check size={8} /> Saved
            </span>
          ) : (
            <button type="button" onClick={() => onImport(p)} disabled={disabled}
              className="flex items-center gap-1 font-mono text-[8px] tracking-widest uppercase text-dim hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-precise px-2 py-1 rounded-sm"
              style={{ border: "var(--border-dim)" }}>
              <ArrowRight size={8} /> Import
            </button>
          )}
        </div>
      </div>

      <p className="font-mono text-[10px] text-soft-white/70 leading-relaxed">{p.prompt}</p>

      {p.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {p.tags.map((tag) => (
            <span key={tag} className="font-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm text-dim/40"
              style={{ border: "var(--border-dim)" }}>{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

export function BriefAnalyzer() {
  const navigate = useNavigate();
  const { create } = usePromptStore();

  const [selectedModel, setSelectedModel] = useState<AIModel>(AI_MODELS[0]);
  const apiKey = getApiKey(selectedModel.provider);

  // Input state
  const [briefText, setBriefText] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<BriefResult | null>(null);
  const [error, setError] = useState("");
  const [importedIds, setImportedIds] = useState<Set<number>>(new Set());
  const [savedRecipeIds, setSavedRecipeIds] = useState<Set<number>>(new Set());
  const [importingAll, setImportingAll] = useState(false);

  // Project import state
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [savedToProjectId, setSavedToProjectId] = useState<string | null>(null);
  const [savingToProject, setSavingToProject] = useState(false);

  const hasInput = briefText.trim().length > 0 || attachedFile !== null;

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachedFile(file);
    // If it's a text file, read into textarea
    if (file.type === "text/plain" || file.name.endsWith(".md")) {
      file.text().then((t) => { setBriefText(t); setAttachedFile(null); });
    }
  }, []);

  const handleClearFile = () => { setAttachedFile(null); };

  const handleAnalyze = async () => {
    if (!hasInput || !apiKey) return;
    setAnalyzing(true);
    setError("");
    setResult(null);
    setImportedIds(new Set());
    setSavedRecipeIds(new Set());
    setImportingAll(false);
    setSavedToProjectId(null);
    setShowProjectPicker(false);
    try {
      let content: BriefContent;
      if (attachedFile) {
        const base64 = await fileToBase64(attachedFile);
        content = { type: "pdf", base64 };
      } else {
        content = { type: "text", text: briefText };
      }
      setResult(await analyzeBrief(content, selectedModel));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleImport = async (p: GeneratedPrompt, idx: number) => {
    await create({
      title: p.title,
      prompt_text: p.prompt,
      provider: "midjourney",
      tags: p.tags,
      aspect_ratio: p.aspect_ratio || undefined,
    });
    setImportedIds((prev) => new Set(prev).add(idx));
  };

  const handleImportAll = async () => {
    if (!result || importingAll) return;
    setImportingAll(true);
    try {
      const pending = result.prompts
        .map((prompt, idx) => ({ prompt, idx }))
        .filter(({ idx }) => !importedIds.has(idx));
      for (const item of pending) {
        await handleImport(item.prompt, item.idx);
      }
    } finally {
      setImportingAll(false);
    }
  };

  const handleSaveRecipe = async (recipe: SuggestedRecipe, idx: number) => {
    await create({
      title: recipe.title,
      prompt_text: recipe.token_sequence.join(", "),
      provider: "midjourney",
      is_recipe: true,
      notes: recipe.description,
    });
    setSavedRecipeIds((prev) => new Set(prev).add(idx));
  };

  const handleOpenProjectPicker = async () => {
    const list = await getProjects();
    setProjects(list);
    setShowProjectPicker(true);
  };

  const handleImportToProject = async (projectId: string) => {
    if (!result) return;
    setSavingToProject(true);
    setShowProjectPicker(false);
    try {
      for (let i = 0; i < result.prompts.length; i++) {
        const p = result.prompts[i];
        const id = await create({
          title: p.title,
          prompt_text: p.prompt,
          provider: "midjourney",
          tags: p.tags,
          aspect_ratio: p.aspect_ratio || undefined,
        });
        await addPromptToProject(projectId, id);
        setImportedIds((prev) => new Set(prev).add(i));
      }
      setSavedToProjectId(projectId);
    } finally {
      setSavingToProject(false);
    }
  };

  const handleImportToNewProject = async () => {
    if (!result) return;
    const projectId = await createProject({
      title: result.summary.slice(0, 60) || "Brief Analyzer Import",
      brief_text: briefText.trim() || undefined,
      production_goal: result.production_goal || undefined,
      status: "active",
    });
    await handleImportToProject(projectId);
    navigate(`/projects/${projectId}`);
  };

  return (
    <PageContainer title="Brief Analyzer" subtitle="AI-POWERED CREATIVE BRIEF BREAKDOWN">
      <div className="flex gap-6 h-full">

        {/* Left: input + model picker */}
        <div className="flex flex-col gap-4 w-64 shrink-0">

          {/* Brief input */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="system-label">CREATIVE BRIEF</span>
              <label className="flex items-center gap-1 font-mono text-[8px] tracking-widest uppercase text-dim hover:text-white transition-precise cursor-pointer px-2 py-1 rounded-sm"
                style={{ border: "var(--border-dim)" }}>
                <Upload size={8} /> Upload
                <input type="file" accept=".txt,.md,.pdf" className="hidden" onChange={handleFileChange} />
              </label>
            </div>

            {attachedFile ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-sm"
                style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
                <FileText size={12} className="text-dim shrink-0" />
                <span className="font-mono text-[10px] text-soft-white truncate flex-1">{attachedFile.name}</span>
                <button type="button" onClick={handleClearFile} className="text-dim/40 hover:text-white transition-precise">
                  <X size={10} />
                </button>
              </div>
            ) : (
              <textarea
                value={briefText}
                onChange={(e) => setBriefText(e.target.value)}
                placeholder="Paste brief here — campaign objective, target audience, key messages, visual references…"
                rows={10}
                className="w-full px-3 py-2 font-mono text-[10px] text-soft-white placeholder:text-dim/40 bg-dark rounded-sm focus:outline-none resize-none leading-relaxed transition-precise"
                style={{ border: "1px solid rgba(255,255,255,0.10)" }}
              />
            )}
          </div>

          {/* API key warning */}
          {!apiKey && (
            <div className="flex items-start gap-2 p-3 rounded-sm"
              style={{ border: "1px solid rgba(215,25,33,0.25)", background: "rgba(215,25,33,0.04)" }}>
              <AlertTriangle size={10} className="text-red/60 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[9px] text-red/70">No API key for {selectedModel.provider}.</span>
                <button type="button" onClick={() => navigate("/settings")}
                  className="flex items-center gap-1 font-mono text-[8px] text-dim hover:text-white transition-precise">
                  <Settings size={8} /> Open Settings
                </button>
              </div>
            </div>
          )}

          {/* Model picker */}
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[8px] tracking-widest uppercase text-dim/40">MODEL</span>
            <div className="flex flex-col gap-1">
              {(["anthropic", "openai"] as const).map((provider) => (
                <div key={provider} className="flex flex-col gap-0.5">
                  <span className="font-mono text-[7px] tracking-widest uppercase text-dim/25">{provider}</span>
                  {AI_MODELS.filter((m) => m.provider === provider).map((m) => (
                    <button key={m.id} type="button" onClick={() => setSelectedModel(m)}
                      className={cn(
                        "flex items-center justify-between px-2 py-1.5 rounded-sm text-left transition-precise",
                        selectedModel.id === m.id ? "text-white" : "text-dim hover:text-muted"
                      )}
                      style={{ border: selectedModel.id === m.id ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(255,255,255,0.05)" }}>
                      <span className="font-mono text-[9px]">{m.label}</span>
                      <span className="font-mono text-[7px] tracking-widest uppercase text-dim/30">{m.tier}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <Button variant="primary" size="md" onClick={handleAnalyze}
            disabled={!hasInput || !apiKey || analyzing}
            className="w-full justify-center">
            <Scan size={11} />
            {analyzing ? "Analyzing…" : "Analyze Brief"}
          </Button>
        </div>

        {/* Right: results */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {!result && !analyzing && !error && (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <FileText size={24} className="text-dim/20" />
              <span className="font-mono text-[10px] text-dim/40">Paste a brief and click Analyze to generate production-ready prompts.</span>
            </div>
          )}

          {analyzing && (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-5 h-5 border border-white/20 border-t-white/60 rounded-full animate-spin" />
              <span className="font-mono text-[10px] text-dim/50">Reading brief and generating prompts…</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-4 rounded-card"
              style={{ border: "1px solid rgba(215,25,33,0.25)", background: "rgba(215,25,33,0.04)" }}>
              <AlertTriangle size={12} className="text-red/60 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] text-red/70 font-medium">Analysis failed</span>
                <span className="font-mono text-[10px] text-muted">{error}</span>
              </div>
            </div>
          )}

          {result && (
            <div className="flex flex-col gap-5">
              {/* Brief overview */}
              <div className="flex flex-col gap-3 p-4 rounded-card"
                style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
                <div className="flex items-start justify-between gap-4">
                  <span className="system-label">BRIEF OVERVIEW</span>
                  <span className="font-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm text-dim/50 shrink-0"
                    style={{ border: "var(--border-dim)" }}>{result.tone}</span>
                </div>

                <p className="font-mono text-[10px] text-muted leading-relaxed">{result.summary}</p>

                {result.production_goal && (
                  <div className="flex flex-col gap-1 pt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                    <span className="system-label text-[8px]">PRODUCTION GOAL</span>
                    <p className="font-mono text-[10px] text-white leading-relaxed">{result.production_goal}</p>
                  </div>
                )}

                <div className="flex flex-col gap-1 pt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                  <span className="system-label text-[8px]">CREATIVE DIRECTION</span>
                  <p className="font-mono text-[10px] text-soft-white/70 leading-relaxed">{result.creative_direction}</p>
                </div>

                {result.key_elements?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Tag size={9} className="text-dim/40 mt-0.5" />
                    {result.key_elements.map((el) => (
                      <span key={el} className="font-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm text-dim/50"
                        style={{ border: "var(--border-dim)" }}>{el}</span>
                    ))}
                  </div>
                )}

                {(result.required_deliverables?.length > 0 || result.key_constraints?.length > 0) && (
                  <div className="grid grid-cols-2 gap-3 pt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                    {result.required_deliverables?.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1">
                          <ListChecks size={8} className="text-dim/40" />
                          <span className="system-label text-[8px]">DELIVERABLES</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          {result.required_deliverables.map((d) => (
                            <span key={d} className="font-mono text-[9px] text-soft-white/60 leading-snug">· {d}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {result.key_constraints?.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <span className="system-label text-[8px]">CONSTRAINTS</span>
                        <div className="flex flex-col gap-0.5">
                          {result.key_constraints.map((c) => (
                            <span key={c} className="font-mono text-[9px] text-soft-white/60 leading-snug">· {c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Risk areas */}
              {result.risk_areas?.length > 0 && (
                <div className="flex flex-col gap-2.5 p-4 rounded-card"
                  style={{ border: "1px solid rgba(215,25,33,0.20)", background: "rgba(215,25,33,0.03)" }}>
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert size={9} className="text-red/60" />
                    <span className="system-label text-red/60">PRODUCTION RISK AREAS</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {result.risk_areas.map((r) => (
                      <span key={r} className="font-mono text-[10px] text-red/50 leading-snug">· {r}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Generated prompts header */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="system-label">{result.prompts.length} GENERATED PROMPTS</span>
                <div className="flex items-center gap-2">
                  {result.prompts.length > 0 && importedIds.size < result.prompts.length && (
                    <Button variant="ghost" size="sm" onClick={handleImportAll} disabled={importingAll || savingToProject}>
                      <ArrowRight size={10} /> {importingAll ? "Importing..." : "Import All"}
                    </Button>
                  )}
                  {savedToProjectId ? (
                    <span className="flex items-center gap-1 font-mono text-[9px] text-white/40">
                      <Check size={9} /> Saved to project
                    </span>
                  ) : (
                    <div className="relative">
                      <button type="button"
                        onClick={showProjectPicker ? () => setShowProjectPicker(false) : handleOpenProjectPicker}
                        disabled={savingToProject}
                        className="flex items-center gap-1.5 font-mono text-[8px] tracking-widest uppercase px-2 py-1.5 rounded-sm text-dim hover:text-white transition-precise"
                        style={{ border: "var(--border-dim)" }}>
                        <FolderPlus size={9} />
                        {savingToProject ? "Saving…" : "Save to Project"}
                        <ChevronDown size={7} />
                      </button>
                      {showProjectPicker && (
                        <div className="absolute right-0 top-full mt-1 z-20 flex flex-col gap-1 p-2 rounded-card min-w-48"
                          style={{ border: "var(--border-strong)", background: "var(--surface-panel)" }}>
                          <button type="button" onClick={handleImportToNewProject}
                            className="flex items-center gap-2 px-3 py-2 rounded-sm text-left hover:bg-white/5 transition-precise">
                            <Plus size={9} className="text-dim/60 shrink-0" />
                            <span className="font-mono text-[9px] text-soft-white">New project from brief</span>
                          </button>
                          {projects.length > 0 && (
                            <div className="h-px my-1" style={{ background: "rgba(255,255,255,0.08)" }} />
                          )}
                          {projects.slice(0, 8).map((p) => (
                            <button key={p.id} type="button" onClick={() => handleImportToProject(p.id)}
                              className="flex items-center gap-2 px-3 py-2 rounded-sm text-left hover:bg-white/5 transition-precise">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: p.status === "active" ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)" }} />
                              <span className="font-mono text-[9px] text-muted truncate">{p.title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {importedIds.size === result.prompts.length && !savedToProjectId && (
                    <span className="flex items-center gap-1 font-mono text-[9px] text-white/40">
                      <Check size={9} /> All saved
                    </span>
                  )}
                </div>
              </div>

              {/* Prompt cards */}
              <div className="flex flex-col gap-3">
                {result.prompts.map((p, i) => (
                  <PromptCard
                    key={i}
                    p={p}
                    onImport={(pr) => handleImport(pr, i)}
                    imported={importedIds.has(i)}
                    disabled={importingAll}
                  />
                ))}
              </div>

              {/* Suggested recipes */}
              {result.suggested_recipes?.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-1.5">
                    <BookOpen size={9} className="text-dim" />
                    <span className="system-label">{result.suggested_recipes.length} SUGGESTED RECIPES</span>
                  </div>
                  {result.suggested_recipes.map((recipe, i) => (
                    <div key={i} className="flex flex-col gap-3 p-4 rounded-card"
                      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="font-sans text-[12px] font-semibold text-white truncate">{recipe.title}</span>
                          <span className="font-mono text-[9px] text-dim/50">{recipe.description}</span>
                        </div>
                        {savedRecipeIds.has(i) ? (
                          <span className="flex items-center gap-1 font-mono text-[8px] text-white/40 shrink-0">
                            <Check size={8} /> Saved
                          </span>
                        ) : (
                          <button type="button" onClick={() => handleSaveRecipe(recipe, i)}
                            className="flex items-center gap-1 font-mono text-[8px] tracking-widest uppercase text-dim hover:text-white transition-precise px-2 py-1 rounded-sm shrink-0"
                            style={{ border: "var(--border-dim)" }}>
                            <BookOpen size={8} /> Save Recipe
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {recipe.token_sequence.map((token) => (
                          <span key={token}
                            className="font-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm text-dim/60"
                            style={{ border: "var(--border-dim)" }}>
                            {token}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
