import { getProjectById, getReferencesForProject } from "./projects";
import { getDeliverablesForProject } from "./deliverables";
import { buildContextPack, generateSuggestions } from "./assistant";
import { getFramecraftDb } from "./dbConnection";
import type { Project, Deliverable } from "@/types";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function getDb() {
  return getFramecraftDb();
}

// ─── Report data types ────────────────────────────────────────

export interface ReportPrompt {
  id: string;
  title: string;
  provider: string;
  rating: number;
  is_winner: boolean;
  is_failed: boolean;
  prompt_text: string;
  avoidance_text?: string;
  failure_notes?: string;
  notes?: string;
  ai_look_risk: number;
  version: number;
  parent_id?: string;
  created_at: string;
}

export interface ReportResult {
  id: string;
  score_overall: number;
  score_realism: number;
  score_brand_fit: number;
  score_composition: number;
  score_lighting: number;
  score_ai_risk: number;
  is_winner: boolean;
  is_failed: boolean;
  notes?: string;
  created_at: string;
}

export interface ExportReport {
  generated_at: string;
  project: Project;
  prompts: ReportPrompt[];
  results: ReportResult[];
  references: { id: string; title: string; kind: string; rating: number }[];
  deliverables: Deliverable[];
  suggestions: string[];
}

export type ExportFormat = "markdown" | "json" | "html";

// ─── Report builder ───────────────────────────────────────────

async function getFullPromptsForProject(projectId: string): Promise<ReportPrompt[]> {
  if (!isTauri) return [];
  const db = await getDb();
  const rows = (await db.select(
    `SELECT p.id, p.title, p.provider, p.rating, p.is_winner, p.is_failed,
            p.prompt_text, p.avoidance_text, p.failure_notes, p.notes,
            p.ai_look_risk, p.version, p.parent_id, p.created_at
     FROM prompts p
     JOIN project_prompts pp ON p.id = pp.prompt_id
     WHERE pp.project_id = $1
     ORDER BY p.rating DESC, p.created_at DESC`,
    [projectId]
  )) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    provider: r.provider as string,
    rating: (r.rating as number) ?? 0,
    is_winner: Boolean(r.is_winner),
    is_failed: Boolean(r.is_failed),
    prompt_text: r.prompt_text as string,
    avoidance_text: r.avoidance_text as string | undefined,
    failure_notes: r.failure_notes as string | undefined,
    notes: r.notes as string | undefined,
    ai_look_risk: (r.ai_look_risk as number) ?? 0,
    version: (r.version as number) ?? 1,
    parent_id: r.parent_id as string | undefined,
    created_at: r.created_at as string,
  }));
}

async function getFullResultsForProject(projectId: string): Promise<ReportResult[]> {
  if (!isTauri) return [];
  const db = await getDb();
  const rows = (await db.select(
    `SELECT r.id, r.score_overall, r.score_realism, r.score_brand_fit,
            r.score_composition, r.score_lighting, r.score_ai_risk,
            r.is_winner, r.is_failed, r.notes, r.created_at
     FROM results r
     JOIN project_results pr ON r.id = pr.result_id
     WHERE pr.project_id = $1
     ORDER BY r.created_at DESC`,
    [projectId]
  )) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    score_overall: (r.score_overall as number) ?? 0,
    score_realism: (r.score_realism as number) ?? 0,
    score_brand_fit: (r.score_brand_fit as number) ?? 0,
    score_composition: (r.score_composition as number) ?? 0,
    score_lighting: (r.score_lighting as number) ?? 0,
    score_ai_risk: (r.score_ai_risk as number) ?? 0,
    is_winner: Boolean(r.is_winner),
    is_failed: Boolean(r.is_failed),
    notes: r.notes as string | undefined,
    created_at: r.created_at as string,
  }));
}

export async function buildReport(projectId: string): Promise<ExportReport | null> {
  const project = await getProjectById(projectId);
  if (!project) return null;

  const [prompts, results, references, deliverables, pack] = await Promise.all([
    getFullPromptsForProject(projectId),
    getFullResultsForProject(projectId),
    getReferencesForProject(projectId),
    getDeliverablesForProject(projectId),
    buildContextPack(projectId),
  ]);

  const suggestions = pack
    ? generateSuggestions(pack).map((s) => `${s.label}: ${s.body}`)
    : [];

  return {
    generated_at: new Date().toISOString(),
    project,
    prompts,
    results,
    references: references.map((r) => ({ id: r.id, title: r.title, kind: r.kind, rating: r.rating })),
    deliverables,
    suggestions,
  };
}

// ─── Serializers ──────────────────────────────────────────────

export function reportToJSON(report: ExportReport): string {
  return JSON.stringify(report, null, 2);
}

function stars(n: number) { return "★".repeat(Math.round(n / 2)) + "☆".repeat(5 - Math.round(n / 2)); }
function score(n: number) { return `${n}/10`; }
function date(s: string) { return new Date(s).toLocaleDateString(); }

export function reportToMarkdown(report: ExportReport): string {
  const { project: p, prompts, results, references, deliverables, suggestions } = report;
  const lines: string[] = [];

  lines.push(`# ${p.title}`);
  lines.push(`*Exported ${date(report.generated_at)} by Framecraft*`);
  lines.push("");

  // Project summary
  lines.push("## Project Summary");
  if (p.client)           lines.push(`**Client:** ${p.client}`);
  if (p.category)         lines.push(`**Category:** ${p.category}`);
  lines.push(`**Status:** ${p.status}`);
  if (p.brief_text)       lines.push(`\n**Brief:**\n> ${p.brief_text}`);
  if (p.production_goal)  lines.push(`\n**Production goal:**\n> ${p.production_goal}`);
  lines.push("");

  // Deliverables
  if (deliverables.length > 0) {
    lines.push("## Deliverables");
    lines.push("| Title | Format | Ratio | Status |");
    lines.push("|---|---|---|---|");
    for (const d of deliverables) {
      lines.push(`| ${d.title} | ${d.target_format ?? "—"} | ${d.aspect_ratio ?? "—"} | ${d.status.toUpperCase()} |`);
    }
    lines.push("");
  }

  // Winning prompts
  const winners = prompts.filter((pr) => pr.is_winner);
  if (winners.length > 0) {
    lines.push("## Winning Prompts");
    for (const pr of winners) {
      lines.push(`### ${pr.title}`);
      lines.push(`*${pr.provider} · v${pr.version} · ${stars(pr.rating)} (${pr.rating}/10)*`);
      lines.push("");
      lines.push("```");
      lines.push(pr.prompt_text);
      lines.push("```");
      if (pr.avoidance_text) lines.push(`\n**Avoidance:** ${pr.avoidance_text}`);
      if (pr.notes) lines.push(`\n*Notes: ${pr.notes}*`);
      lines.push("");
    }
  }

  // All prompts summary
  lines.push("## All Prompts");
  lines.push("| Title | Provider | Rating | Status |");
  lines.push("|---|---|---|---|");
  for (const pr of prompts) {
    const status = pr.is_winner ? "★ Winner" : pr.is_failed ? "✗ Failed" : "—";
    lines.push(`| ${pr.title} | ${pr.provider} | ${pr.rating}/10 | ${status} |`);
  }
  lines.push("");

  // Selected results
  const selectedResults = results.filter((r) => r.is_winner);
  if (selectedResults.length > 0) {
    lines.push("## Selected Results");
    lines.push("| ID | Overall | Realism | Brand Fit | Composition | Lighting |");
    lines.push("|---|---|---|---|---|---|");
    for (const r of selectedResults) {
      lines.push(`| ${r.id.slice(0, 8)}… | ${score(r.score_overall)} | ${score(r.score_realism)} | ${score(r.score_brand_fit)} | ${score(r.score_composition)} | ${score(r.score_lighting)} |`);
    }
    lines.push("");
  }

  // Reference board
  if (references.length > 0) {
    lines.push("## Reference Board");
    lines.push("| Title | Kind | Rating |");
    lines.push("|---|---|---|");
    for (const r of references) {
      lines.push(`| ${r.title} | ${r.kind} | ${r.rating}/10 |`);
    }
    lines.push("");
  }

  // AI risks
  const highRisk = prompts.filter((pr) => pr.ai_look_risk >= 7);
  if (highRisk.length > 0) {
    lines.push("## AI-Look Risk Notes");
    for (const pr of highRisk) {
      lines.push(`- **${pr.title}** (risk: ${pr.ai_look_risk}/10)${pr.avoidance_text ? ` — avoidance: ${pr.avoidance_text}` : " — no avoidance text"}`);
    }
    lines.push("");
  }

  // Failed directions
  const failed = prompts.filter((pr) => pr.is_failed);
  if (failed.length > 0) {
    lines.push("## Failed Directions");
    for (const pr of failed) {
      lines.push(`- **${pr.title}**${pr.failure_notes ? `: ${pr.failure_notes}` : ""}`);
    }
    lines.push("");
  }

  // Recommendations
  if (suggestions.length > 0) {
    lines.push("## Recommendations");
    for (const s of suggestions) {
      lines.push(`- ${s}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(`*Generated by Framecraft on ${date(report.generated_at)}*`);

  return lines.join("\n");
}

export function reportToHTML(report: ExportReport): string {
  const { project: p, prompts, results, references, deliverables, suggestions } = report;

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; line-height: 1.6; color: #111; background: #fff; padding: 40px; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 22px; font-weight: 700; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 4px; }
    h2 { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #666; margin: 32px 0 12px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    h3 { font-size: 13px; font-weight: 600; margin: 16px 0 6px; }
    p { margin-bottom: 8px; color: #333; }
    .meta { font-size: 11px; color: #888; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; border-bottom: 1px solid #ddd; padding: 4px 8px; }
    td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    .badge { display: inline-block; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 6px; border-radius: 3px; }
    .winner { background: #f0fdf4; color: #166534; }
    .failed { background: #fef2f2; color: #991b1b; }
    .risk-high { background: #fff7ed; color: #9a3412; }
    pre { background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 4px; padding: 12px; font-size: 11px; font-family: 'Menlo', monospace; white-space: pre-wrap; margin: 8px 0; }
    blockquote { border-left: 3px solid #ddd; padding-left: 12px; color: #555; margin: 8px 0; }
    ul { padding-left: 20px; }
    li { margin-bottom: 4px; color: #333; }
    .section-empty { color: #aaa; font-style: italic; font-size: 12px; }
    .score-bar { display: inline-block; width: 40px; height: 4px; background: #eee; border-radius: 2px; vertical-align: middle; position: relative; }
    .score-fill { height: 100%; background: #111; border-radius: 2px; }
    @media print { body { padding: 20px; } }
  `;

  const badge = (text: string, cls: string) => `<span class="badge ${cls}">${text}</span>`;

  const scoreBar = (n: number) =>
    `<span class="score-bar"><span class="score-fill" style="width:${n * 10}%"></span></span> ${n}/10`;

  const rows = (headers: string[], rowData: string[][]): string => `
    <table>
      <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rowData.map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>`;

  let html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(p.title)} — Export</title><style>${css}</style></head><body>`;

  html += `<h1>${esc(p.title)}</h1>`;
  html += `<p class="meta">`;
  if (p.client) html += `Client: <strong>${esc(p.client)}</strong> &nbsp;·&nbsp; `;
  if (p.category) html += `Category: <strong>${esc(p.category)}</strong> &nbsp;·&nbsp; `;
  html += `Status: <strong>${p.status}</strong> &nbsp;·&nbsp; `;
  html += `Exported ${new Date(report.generated_at).toLocaleDateString()}</p>`;

  if (p.brief_text || p.production_goal) {
    html += `<h2>Brief</h2>`;
    if (p.brief_text) html += `<blockquote>${esc(p.brief_text)}</blockquote>`;
    if (p.production_goal) html += `<p><strong>Goal:</strong> ${esc(p.production_goal)}</p>`;
  }

  if (deliverables.length > 0) {
    html += `<h2>Deliverables</h2>`;
    html += rows(
      ["Title", "Format", "Ratio", "Status"],
      deliverables.map((d) => [
        esc(d.title),
        d.target_format ? esc(d.target_format) : "—",
        d.aspect_ratio ?? "—",
        `<span class="badge">${d.status.toUpperCase()}</span>`,
      ])
    );
  }

  const winners = prompts.filter((pr) => pr.is_winner);
  if (winners.length > 0) {
    html += `<h2>Winning Prompts</h2>`;
    for (const pr of winners) {
      html += `<h3>${esc(pr.title)} ${badge("Winner", "winner")}</h3>`;
      html += `<p style="font-size:11px;color:#888">${pr.provider} · v${pr.version} · Rating ${pr.rating}/10</p>`;
      html += `<pre>${esc(pr.prompt_text)}</pre>`;
      if (pr.avoidance_text) html += `<p><strong>Avoidance:</strong> ${esc(pr.avoidance_text)}</p>`;
      if (pr.notes) html += `<p style="color:#666;font-size:12px">${esc(pr.notes)}</p>`;
    }
  }

  html += `<h2>All Prompts (${prompts.length})</h2>`;
  if (prompts.length === 0) {
    html += `<p class="section-empty">No prompts in this project.</p>`;
  } else {
    html += rows(
      ["Title", "Provider", "Rating", "AI Risk", "Status"],
      prompts.map((pr) => [
        esc(pr.title),
        pr.provider,
        `${pr.rating}/10`,
        pr.ai_look_risk >= 7 ? `<span class="badge risk-high">${pr.ai_look_risk}/10</span>` : `${pr.ai_look_risk}/10`,
        pr.is_winner ? badge("Winner", "winner") : pr.is_failed ? badge("Failed", "failed") : "—",
      ])
    );
  }

  const selectedResults = results.filter((r) => r.is_winner);
  if (selectedResults.length > 0) {
    html += `<h2>Selected Results (${selectedResults.length})</h2>`;
    html += rows(
      ["Overall", "Realism", "Brand Fit", "Composition", "Lighting"],
      selectedResults.map((r) => [
        scoreBar(r.score_overall),
        scoreBar(r.score_realism),
        scoreBar(r.score_brand_fit),
        scoreBar(r.score_composition),
        scoreBar(r.score_lighting),
      ])
    );
  }

  if (references.length > 0) {
    html += `<h2>Reference Board (${references.length})</h2>`;
    html += rows(
      ["Title", "Kind", "Rating"],
      references.map((r) => [esc(r.title), r.kind, `${r.rating}/10`])
    );
  }

  const failed = prompts.filter((pr) => pr.is_failed);
  if (failed.length > 0) {
    html += `<h2>Failed Directions</h2><ul>`;
    for (const pr of failed) {
      html += `<li><strong>${esc(pr.title)}</strong>${pr.failure_notes ? `: ${esc(pr.failure_notes)}` : ""}</li>`;
    }
    html += `</ul>`;
  }

  if (suggestions.length > 0) {
    html += `<h2>Recommendations</h2><ul>`;
    for (const s of suggestions) {
      html += `<li>${esc(s)}</li>`;
    }
    html += `</ul>`;
  }

  html += `<hr style="margin:40px 0 16px;border:none;border-top:1px solid #eee">`;
  html += `<p class="meta">Generated by Framecraft · ${new Date(report.generated_at).toLocaleString()}</p>`;
  html += `</body></html>`;

  return html;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Download helpers ─────────────────────────────────────────

export function downloadText(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
