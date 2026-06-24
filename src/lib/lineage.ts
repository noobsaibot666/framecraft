import type { Prompt } from "@/types";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;
async function getDb() {
  if (!isTauri) throw new Error("Not in Tauri context");
  if (!_db) {
    const SqlPlugin = await import("@tauri-apps/plugin-sql");
    _db = await SqlPlugin.default.load("sqlite:framecraft.db");
  }
  return _db;
}

function rowToPrompt(row: Record<string, unknown>): Prompt {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string | undefined,
    provider: (row.provider ?? "midjourney") as Prompt["provider"],
    category: row.category as Prompt["category"] | undefined,
    use_case: row.use_case as string | undefined,
    prompt_text: row.prompt_text as string,
    avoidance_text: row.avoidance_text as string | undefined,
    aspect_ratio: row.aspect_ratio as string | undefined,
    model_version: row.model_version as string | undefined,
    camera: row.camera as string | undefined,
    lens: row.lens as string | undefined,
    lighting: row.lighting as string | undefined,
    style_ref: row.style_ref as string | undefined,
    character_ref: row.character_ref as string | undefined,
    image_ref: row.image_ref as string | undefined,
    parameters: row.parameters ? JSON.parse(row.parameters as string) : undefined,
    tags: row.tags ? JSON.parse(row.tags as string) : undefined,
    rating: (row.rating as number) ?? 0,
    ai_look_risk: (row.ai_look_risk as number) ?? 0,
    reuse_potential: (row.reuse_potential as number) ?? 0,
    is_recipe: Boolean(row.is_recipe),
    is_winner: Boolean(row.is_winner),
    is_failed: Boolean(row.is_failed),
    failure_notes: row.failure_notes as string | undefined,
    notes: row.notes as string | undefined,
    version: (row.version as number) ?? 1,
    parent_id: row.parent_id as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ─── Types ────────────────────────────────────────────────────

export interface VersionNode extends Prompt {
  result_count: number;
  children: VersionNode[];
}

// ─── Helpers ──────────────────────────────────────────────────

/** Walk up parent_id chain to find the root prompt id. */
export async function findRoot(promptId: string): Promise<string> {
  if (!isTauri) return promptId;
  const db = await getDb();

  let currentId = promptId;
  const visited = new Set<string>();

  while (true) {
    if (visited.has(currentId)) break; // cycle guard
    visited.add(currentId);

    const rows = (await db.select(
      "SELECT parent_id FROM prompts WHERE id = $1",
      [currentId]
    )) as { parent_id: string | null }[];

    const parentId = rows[0]?.parent_id;
    if (!parentId) break;
    currentId = parentId;
  }

  return currentId;
}

/** Load all versions in a family (root + all descendants). */
export async function loadFamily(rootId: string): Promise<VersionNode[]> {
  if (!isTauri) return [];

  const db = await getDb();

  // Iterative BFS to collect all ids in the family
  const allIds: string[] = [];
  const queue: string[] = [rootId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    allIds.push(currentId);

    const children = (await db.select(
      "SELECT id FROM prompts WHERE parent_id = $1",
      [currentId]
    )) as { id: string }[];

    for (const c of children) queue.push(c.id);
  }

  if (allIds.length === 0) return [];

  // Load all prompts + result counts in one pass
  const placeholders = allIds.map((_, i) => `$${i + 1}`).join(",");
  const rows = (await db.select(
    `SELECT p.*,
       (SELECT COUNT(*) FROM results r WHERE r.prompt_id = p.id) as result_count
     FROM prompts p
     WHERE p.id IN (${placeholders})
     ORDER BY p.version ASC, p.created_at ASC`,
    allIds
  )) as Record<string, unknown>[];

  const nodes: VersionNode[] = rows.map((row) => ({
    ...rowToPrompt(row),
    result_count: (row.result_count as number) ?? 0,
    children: [],
  }));

  return nodes;
}

/** Build the tree from a flat node list. Returns root node. */
export function buildTree(nodes: VersionNode[]): VersionNode | null {
  if (nodes.length === 0) return null;

  const map = new Map<string, VersionNode>();
  for (const n of nodes) map.set(n.id, n);

  let root: VersionNode | null = null;
  for (const n of nodes) {
    if (n.parent_id && map.has(n.parent_id)) {
      map.get(n.parent_id)!.children.push(n);
    } else {
      root = n;
    }
  }

  return root;
}

/** Flatten a tree into version-ordered list for linear display. */
export function flattenTree(node: VersionNode | null): VersionNode[] {
  if (!node) return [];
  const result: VersionNode[] = [node];
  for (const child of node.children) {
    result.push(...flattenTree(child));
  }
  return result;
}

/** Get all direct children (branches) of a prompt. */
export async function getBranches(promptId: string): Promise<Prompt[]> {
  if (!isTauri) return [];
  const db = await getDb();
  const rows = (await db.select(
    "SELECT * FROM prompts WHERE parent_id = $1 ORDER BY version ASC, created_at ASC",
    [promptId]
  )) as Record<string, unknown>[];
  return rows.map(rowToPrompt);
}

/** Build the ancestor chain from a prompt up to the root (oldest first). */
export async function getAncestorChain(promptId: string): Promise<Prompt[]> {
  if (!isTauri) return [];
  const db = await getDb();

  const chain: Prompt[] = [];
  let currentId: string | undefined = promptId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const rows = (await db.select(
      "SELECT * FROM prompts WHERE id = $1",
      [currentId]
    )) as Record<string, unknown>[];

    if (!rows[0]) break;
    const prompt = rowToPrompt(rows[0]);
    chain.unshift(prompt); // oldest first
    currentId = prompt.parent_id;
  }

  return chain;
}

/** Diff two prompt texts — returns an array of change segments. */
export interface DiffSegment {
  type: "equal" | "removed" | "added";
  text: string;
}

export function diffPromptText(a: string, b: string): DiffSegment[] {
  // Word-level diff using simple LCS
  const aWords = a.split(/(\s+)/);
  const bWords = b.split(/(\s+)/);

  const m = aWords.length;
  const n = bWords.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = aWords[i - 1] === bWords[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack
  const segments: DiffSegment[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aWords[i - 1] === bWords[j - 1]) {
      segments.unshift({ type: "equal", text: aWords[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      segments.unshift({ type: "added", text: bWords[j - 1] });
      j--;
    } else {
      segments.unshift({ type: "removed", text: aWords[i - 1] });
      i--;
    }
  }

  // Merge consecutive same-type segments
  const merged: DiffSegment[] = [];
  for (const seg of segments) {
    const prev = merged[merged.length - 1];
    if (prev && prev.type === seg.type) {
      prev.text += seg.text;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}

/** Compare metadata fields between two prompts. Returns changed field names. */
export function diffMetadata(a: Prompt, b: Prompt): string[] {
  const fields: (keyof Prompt)[] = [
    "provider", "aspect_ratio", "model_version",
    "camera", "lens", "lighting",
    "style_ref", "character_ref", "image_ref",
    "avoidance_text", "category", "use_case",
  ];
  return fields.filter((f) => {
    const av = a[f] ?? "";
    const bv = b[f] ?? "";
    return String(av) !== String(bv);
  });
}
