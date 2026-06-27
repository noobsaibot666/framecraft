import { searchPrompts, searchTokens } from "./db";
import { searchProjects } from "./projects";
import { searchReferences } from "./references";
import { searchCampaigns } from "./campaigns";

export type CommandResultType = "prompt" | "recipe" | "token" | "project" | "reference" | "campaign" | "nav";

export interface CommandResult {
  id: string;
  type: CommandResultType;
  title: string;
  subtitle?: string;
  path: string;
}

const PER_TYPE = 4;

// Static navigation shortcuts — shown when query is empty
export const NAV_SHORTCUTS: CommandResult[] = [
  { id: "nav-craft",      type: "nav", title: "New Prompt",      subtitle: "Open the prompt crafter",     path: "/craft" },
  { id: "nav-recipe",     type: "nav", title: "New Recipe",      subtitle: "Open the recipe editor",      path: "/recipes/new" },
  { id: "nav-library",    type: "nav", title: "Prompt Library",  subtitle: "Browse all prompts",           path: "/library" },
  { id: "nav-queue",      type: "nav", title: "Generation Queue",subtitle: "View and manage the queue",   path: "/queue" },
  { id: "nav-results",    type: "nav", title: "Result Gallery",  subtitle: "Browse all generated results", path: "/results" },
  { id: "nav-references", type: "nav", title: "References",      subtitle: "Browse the reference library", path: "/references" },
];

export async function searchAll(query: string): Promise<CommandResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const [allPrompts, projects, references, campaigns, tokens] = await Promise.all([
    searchPrompts(q).catch(() => []),
    searchProjects(q).catch(() => []),
    searchReferences(q).catch(() => []),
    searchCampaigns(q).catch(() => []),
    searchTokens(q).catch(() => []),
  ]);

  const prompts  = allPrompts.filter((p) => !p.is_recipe);
  const recipes  = allPrompts.filter((p) => p.is_recipe);

  const results: CommandResult[] = [];

  for (const p of prompts.slice(0, PER_TYPE)) {
    results.push({
      id: p.id,
      type: "prompt",
      title: p.title,
      subtitle: p.provider + (p.is_winner ? " · winner" : p.is_failed ? " · failed" : ""),
      path: `/library/${p.id}`,
    });
  }

  for (const r of recipes.slice(0, PER_TYPE)) {
    results.push({
      id: r.id,
      type: "recipe",
      title: r.title,
      subtitle: r.provider + ` · recipe`,
      path: `/recipes/${r.id}/edit`,
    });
  }

  for (const p of projects.slice(0, PER_TYPE)) {
    results.push({
      id: p.id,
      type: "project",
      title: p.title,
      subtitle: [p.client, p.status].filter(Boolean).join(" · "),
      path: `/projects/${p.id}`,
    });
  }

  for (const r of references.slice(0, PER_TYPE)) {
    results.push({
      id: r.id,
      type: "reference",
      title: r.title,
      subtitle: r.kind,
      path: `/references/${r.id}`,
    });
  }

  for (const c of campaigns.slice(0, PER_TYPE)) {
    results.push({
      id: c.id,
      type: "campaign",
      title: c.title,
      subtitle: c.client ?? c.status,
      path: `/campaigns/${c.id}`,
    });
  }

  for (const t of tokens.slice(0, PER_TYPE)) {
    results.push({
      id: t.id,
      type: "token",
      title: t.text,
      subtitle: t.category_name ?? "token",
      path: `/tokens/${t.id}`,
    });
  }

  // Also filter nav shortcuts by query
  const qLower = q.toLowerCase();
  const matchingNav = NAV_SHORTCUTS.filter(
    (n) => n.title.toLowerCase().includes(qLower) || (n.subtitle ?? "").toLowerCase().includes(qLower)
  );
  results.push(...matchingNav);

  return results;
}
