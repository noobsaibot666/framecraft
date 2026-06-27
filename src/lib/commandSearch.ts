import { searchPrompts } from "./db";
import { searchProjects } from "./projects";
import { searchReferences } from "./references";
import { searchCampaigns } from "./campaigns";

export type CommandResultType = "prompt" | "project" | "reference" | "campaign";

export interface CommandResult {
  id: string;
  type: CommandResultType;
  title: string;
  subtitle?: string;
  path: string;
}

const PER_TYPE = 5;

export async function searchAll(query: string): Promise<CommandResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const [prompts, projects, references, campaigns] = await Promise.all([
    searchPrompts(q).catch(() => []),
    searchProjects(q).catch(() => []),
    searchReferences(q).catch(() => []),
    searchCampaigns(q).catch(() => []),
  ]);

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

  return results;
}
