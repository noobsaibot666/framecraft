import { getProjectById, getPromptsForProject, getResultsForProject, getReferencesForProject } from "./projects";
import { getDeliverablesForProject, isMissingResult } from "./deliverables";
import { getSessions } from "./comparisons";
import { summarizeComparisonIntelligence } from "./comparisonIntelligence";
import { getApiKey, AI_MODELS } from "./aiConfig";
import { fetchProviderJson, requireValidApiKey } from "./aiClient";
import { formatFormulaForAI, getFormulaForProvider } from "./promptFormula";
import { formatStrategyForContext, readStoredStrategy } from "./creativeDirectorMode";
import { getFramecraftDb } from "./dbConnection";
import type {
  AssistantThread, AssistantMessage, AssistantSuggestion, ProjectContextPack, Provider,
} from "@/types";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function getDb() {
  return getFramecraftDb();
}

function generateId() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }

export function appendProjectNote(existing: string | undefined, next: string): string {
  const current = existing?.trim() ?? "";
  const addition = next.trim();
  return current ? `${current}\n\n${addition}` : addition;
}

// ─── Dev fallback stores ──────────────────────────────────────

const _devThreads: AssistantThread[] = [];
const _devMessages: AssistantMessage[] = [];

// ─── Context pack ─────────────────────────────────────────────

export async function buildContextPack(projectId: string): Promise<ProjectContextPack | null> {
  const project = await getProjectById(projectId);
  if (!project) return null;

  const [prompts, results, references, deliverables, comparisonSessions] = await Promise.all([
    getPromptsForProject(projectId),
    getResultsForProject(projectId),
    getReferencesForProject(projectId),
    getDeliverablesForProject(projectId),
    getSessions(projectId),
  ]);

  const avgRating = prompts.length
    ? prompts.reduce((s, p) => s + p.rating, 0) / prompts.length
    : 0;
  const avgScore = results.length
    ? results.reduce((s, r) => s + r.score_overall, 0) / results.length
    : 0;

  const byStatus: Partial<Record<string, number>> = {};
  for (const d of deliverables) {
    byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
  }
  const missingResults = deliverables.filter(isMissingResult).length;

  const kinds = [...new Set(references.map((r) => r.kind))];

  return {
    project: {
      id: project.id,
      title: project.title,
      brief_text: project.brief_text,
      production_goal: project.production_goal,
      category: project.category,
      status: project.status,
      client: project.client,
      notes: project.notes,
      creative_strategy: project.creative_strategy,
    },
    prompts: {
      total: prompts.length,
      winners: prompts.filter((p) => p.is_winner).length,
      failed: prompts.filter((p) => p.is_failed).length,
      avgRating: Math.round(avgRating * 10) / 10,
      top: prompts.slice(0, 5),
      providers: [...new Set(prompts.map((p) => p.provider as Provider))],
    },
    results: {
      total: results.length,
      winners: results.filter((r) => r.is_winner).length,
      failed: results.filter((r) => r.is_failed).length,
      avgScore: Math.round(avgScore * 10) / 10,
    },
    references: { total: references.length, kinds },
    deliverables: { total: deliverables.length, byStatus, missingResults },
    comparisons: summarizeComparisonIntelligence(comparisonSessions),
  };
}

// ─── Deterministic suggestions ────────────────────────────────

export function generateSuggestions(pack: ProjectContextPack): AssistantSuggestion[] {
  const suggestions: AssistantSuggestion[] = [];

  // 1. Next action
  if (pack.prompts.total === 0) {
    suggestions.push({
      kind: "next_action",
      label: "Start crafting",
      body: "This project has no prompts yet. Head to Craft to create your first prompt.",
      action: { label: "Craft prompt", type: "navigate", payload: `/craft?project=${pack.project.id}` },
    });
  } else if (pack.results.total === 0) {
    suggestions.push({
      kind: "next_action",
      label: "Generate results",
      body: `You have ${pack.prompts.total} prompt${pack.prompts.total !== 1 ? "s" : ""} but no results yet. Generate images for your highest-rated prompt first.`,
      action: { label: "View prompts", type: "navigate", payload: `/projects/${pack.project.id}` },
    });
  } else if (pack.results.winners === 0 && pack.results.total >= 3) {
    suggestions.push({
      kind: "next_action",
      label: "Mark your winners",
      body: `You have ${pack.results.total} results but no winners marked. Review them and flag at least one — it unlocks recipe creation and comparison workflows.`,
      action: { label: "View project", type: "navigate", payload: `/projects/${pack.project.id}` },
    });
  } else if (pack.prompts.winners > 0) {
    suggestions.push({
      kind: "next_action",
      label: "Build on your winner",
      body: `Your winning prompt has been identified. Try a controlled variation — change one parameter (lighting, aspect ratio, or style reference) to explore adjacent directions.`,
      action: { label: "Craft variation", type: "craft_prompt" },
    });
  } else {
    suggestions.push({
      kind: "next_action",
      label: "Iterate and score",
      body: `You have ${pack.results.total} result${pack.results.total !== 1 ? "s" : ""} with an average score of ${pack.results.avgScore}/10. Score the unreviewed ones and look for patterns before iterating.`,
    });
  }

  // 2. Avoidance improvement
  if (pack.prompts.failed > 0) {
    suggestions.push({
      kind: "avoidance_improvement",
      label: "Document failures",
      body: `${pack.prompts.failed} failed prompt${pack.prompts.failed !== 1 ? "s" : ""} in this project. Add avoidance notes to capture what went wrong — this informs future generations and trains your avoidance library.`,
      action: { label: "View prompts", type: "navigate", payload: `/projects/${pack.project.id}` },
    });
  }

  // 3. Reference gap
  if (pack.references.total === 0 && pack.prompts.total > 0) {
    const catLabel = pack.project.category ? ` for ${pack.project.category}` : "";
    suggestions.push({
      kind: "reference_gap",
      label: "Add references",
      body: `No references attached to this project yet. Adding style, composition, or product references${catLabel} gives the assistant and your prompts stronger grounding.`,
      action: { label: "Browse references", type: "navigate", payload: `/references` },
    });
  } else if (pack.references.total > 0 && !pack.references.kinds.includes("style")) {
    suggestions.push({
      kind: "reference_gap",
      label: "Add style reference",
      body: `You have ${pack.references.total} reference${pack.references.total !== 1 ? "s" : ""} but no style references. A style reference can anchor the visual language more precisely than text alone.`,
      action: { label: "Browse references", type: "navigate", payload: `/references` },
    });
  }

  // 4. Winner interpretation
  if (pack.results.winners >= 1 && pack.prompts.winners === 0) {
    suggestions.push({
      kind: "winner_interpretation",
      label: "Trace back to prompt",
      body: `You have ${pack.results.winners} winning result${pack.results.winners !== 1 ? "s" : ""} but the source prompt${pack.results.winners !== 1 ? "s are" : " is"} not marked as winner. Mark the prompt so it feeds into recipe and recommendation flows.`,
    });
  }

  // Deliverable gap
  if (pack.deliverables.missingResults > 0) {
    suggestions.push({
      kind: "next_action",
      label: "Deliverables need results",
      body: `${pack.deliverables.missingResults} deliverable${pack.deliverables.missingResults !== 1 ? "s are" : " is"} in generating/review but missing a linked result. Link results in the Pipeline Board to complete those deliverables.`,
      action: { label: "Open board", type: "navigate", payload: `/projects/${pack.project.id}/board` },
    });
  }

  if (pack.comparisons.pending > 0) {
    suggestions.push({
      kind: "next_action",
      label: "Complete comparisons",
      body: `${pack.comparisons.pending} comparison session${pack.comparisons.pending === 1 ? " is" : "s are"} still waiting for a saved decision. Complete the review so its winner, rejection, and notes become project intelligence.`,
      action: { label: "Open Compare", type: "navigate", payload: `/compare/${pack.project.id}` },
    });
  }

  return suggestions;
}

// ─── AI call ──────────────────────────────────────────────────

export function serializePackToSystem(pack: ProjectContextPack): string {
  const lines: string[] = [
    `You are a creative assistant embedded in Framecraft, a local prompt engineering workspace.`,
    `Your role: help the user make grounded decisions about their project based on the data below.`,
    `Rules: cite specific assets by title/id, suggest actions, never execute them, never hallucinate files or results.`,
    ``,
    `## PROJECT: ${pack.project.title}`,
    pack.project.client ? `Client: ${pack.project.client}` : "",
    pack.project.category ? `Category: ${pack.project.category}` : "",
    pack.project.status ? `Status: ${pack.project.status}` : "",
    pack.project.brief_text ? `Brief: ${pack.project.brief_text}` : "",
    pack.project.production_goal ? `Production goal: ${pack.project.production_goal}` : "",
    (() => {
      const strategy = readStoredStrategy(pack.project.creative_strategy);
      return strategy ? formatStrategyForContext(strategy) : "";
    })(),
    ``,
    `## PROMPTS (${pack.prompts.total} total, avg rating ${pack.prompts.avgRating}/5)`,
    `Winners: ${pack.prompts.winners} | Failed: ${pack.prompts.failed}`,
    ...pack.prompts.top.map(
      (p) => `  - "${p.title}" rating:${p.rating}${p.is_winner ? " ★WINNER" : ""}${p.is_failed ? " ✗FAILED" : ""}`
    ),
    ``,
    `## RESULTS (${pack.results.total} total, avg score ${pack.results.avgScore}/5)`,
    `Winners: ${pack.results.winners} | Failed: ${pack.results.failed}`,
    ``,
    `## REFERENCES (${pack.references.total} total)`,
    pack.references.kinds.length ? `Kinds: ${pack.references.kinds.join(", ")}` : "None attached.",
    ``,
    `## DELIVERABLES (${pack.deliverables.total} total)`,
    ...Object.entries(pack.deliverables.byStatus).map(([s, n]) => `  ${s}: ${n}`),
    pack.deliverables.missingResults
      ? `Missing results: ${pack.deliverables.missingResults}`
      : "",
    ``,
    `## COMPARISONS (${pack.comparisons.total} total, ${pack.comparisons.decided} decided, ${pack.comparisons.pending} pending)`,
    ...(pack.comparisons.recentOutcomes.length > 0
      ? pack.comparisons.recentOutcomes.map((outcome) => `  - ${outcome}`)
      : ["No saved comparison outcomes."]),
  ];
  // Provider success formulas (doc 03 §1) — when suggesting prompt changes,
  // the assistant should respect each provider's winning structure.
  const providers = pack.prompts.providers ?? [];
  if (providers.length > 0) {
    lines.push("", "## PROVIDER PROMPT FORMULAS (follow these when suggesting prompt changes)");
    for (const provider of providers.slice(0, 4)) {
      lines.push(`  - ${formatFormulaForAI(getFormulaForProvider(provider), provider)}`);
    }
  }
  return lines.filter(Boolean).join("\n");
}

export async function askAssistant(
  pack: ProjectContextPack,
  messages: { role: "user" | "assistant"; content: string }[],
  modelId: string
): Promise<string> {
  const model = AI_MODELS.find((m) => m.id === modelId);
  if (!model) throw new Error("Unknown model");

  const systemPrompt = serializePackToSystem(pack);
  const apiKey = getApiKey(model.provider);
  requireValidApiKey(model.provider, apiKey);

  if (model.provider === "anthropic") {
    const data = await fetchProviderJson<{ content: { type: string; text: string }[] }>(model.provider, "https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    });
    return data.content.find((c) => c.type === "text")?.text ?? "";
  }

  // OpenAI and DeepSeek both expose an OpenAI-compatible chat completions endpoint.
  const baseUrl = model.provider === "deepseek" ? "https://api.deepseek.com/chat/completions" : "https://api.openai.com/v1/chat/completions";
  const data = await fetchProviderJson<{ choices: { message: { content: string } }[] }>(model.provider, baseUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 1024,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });
  return data.choices[0]?.message?.content ?? "";
}

// ─── Thread CRUD ──────────────────────────────────────────────

export async function createThread(projectId: string, title: string): Promise<string> {
  const id = generateId();
  const ts = now();
  if (isTauri) {
    const db = await getDb();
    await db.execute(
      "INSERT INTO assistant_threads (id, project_id, title, created_at, updated_at) VALUES ($1,$2,$3,$4,$5)",
      [id, projectId, title, ts, ts]
    );
    return id;
  }
  _devThreads.push({ id, project_id: projectId, title, created_at: ts, updated_at: ts });
  return id;
}

export async function getThreadsForProject(projectId: string): Promise<AssistantThread[]> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select(
      "SELECT * FROM assistant_threads WHERE project_id = $1 ORDER BY updated_at DESC",
      [projectId]
    )) as Record<string, unknown>[];
    return rows.map(rowToThread);
  }
  return _devThreads
    .filter((t) => t.project_id === projectId)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getThread(id: string): Promise<AssistantThread | null> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select("SELECT * FROM assistant_threads WHERE id = $1", [id])) as Record<string, unknown>[];
    return rows[0] ? rowToThread(rows[0]) : null;
  }
  return _devThreads.find((t) => t.id === id) ?? null;
}

export async function deleteThread(id: string): Promise<void> {
  if (isTauri) {
    const db = await getDb();
    await db.execute("DELETE FROM assistant_threads WHERE id = $1", [id]);
    return;
  }
  const i = _devThreads.findIndex((t) => t.id === id);
  if (i !== -1) _devThreads.splice(i, 1);
  const toRemove = _devMessages.filter((m) => m.thread_id === id).map((m) => m.id);
  for (const mid of toRemove) {
    const j = _devMessages.findIndex((m) => m.id === mid);
    if (j !== -1) _devMessages.splice(j, 1);
  }
}

// ─── Message CRUD ─────────────────────────────────────────────

export async function addMessage(
  threadId: string,
  role: "user" | "assistant",
  content: string,
  citations?: string[]
): Promise<string> {
  const id = generateId();
  const ts = now();
  if (isTauri) {
    const db = await getDb();
    await db.execute(
      "INSERT INTO assistant_messages (id, thread_id, role, content, citations, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [id, threadId, role, content, citations ? JSON.stringify(citations) : null, ts]
    );
    await db.execute("UPDATE assistant_threads SET updated_at = $1 WHERE id = $2", [ts, threadId]);
    return id;
  }
  _devMessages.push({ id, thread_id: threadId, role, content, citations, created_at: ts });
  const t = _devThreads.find((x) => x.id === threadId);
  if (t) t.updated_at = ts;
  return id;
}

export async function getMessages(threadId: string): Promise<AssistantMessage[]> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select(
      "SELECT * FROM assistant_messages WHERE thread_id = $1 ORDER BY created_at ASC",
      [threadId]
    )) as Record<string, unknown>[];
    return rows.map(rowToMessage);
  }
  return _devMessages
    .filter((m) => m.thread_id === threadId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

// ─── Row mappers ──────────────────────────────────────────────

function rowToThread(r: Record<string, unknown>): AssistantThread {
  return {
    id: r.id as string,
    project_id: r.project_id as string,
    title: r.title as string,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

function rowToMessage(r: Record<string, unknown>): AssistantMessage {
  return {
    id: r.id as string,
    thread_id: r.thread_id as string,
    role: r.role as "user" | "assistant",
    content: r.content as string,
    citations: r.citations ? JSON.parse(r.citations as string) : undefined,
    created_at: r.created_at as string,
  };
}
