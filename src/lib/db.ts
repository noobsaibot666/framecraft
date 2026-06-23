import type { Prompt, DashboardStats, TokenCategory, Token } from "@/types";

// ─── Environment Detection ───────────────────────────────────
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// ─── DB Connection (Tauri only) ──────────────────────────────
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

// ─── In-Memory Dev Store ─────────────────────────────────────
type MemStore = { prompts: Prompt[] };

function loadMemStore(): MemStore {
  try {
    const raw = localStorage.getItem("framecraft_dev");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { prompts: [] };
}

function saveMemStore(store: MemStore) {
  try {
    localStorage.setItem("framecraft_dev", JSON.stringify(store));
  } catch {}
}

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function now(): string {
  return new Date().toISOString();
}

// ─── Row Mappers ─────────────────────────────────────────────

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

// ─── Public API ──────────────────────────────────────────────

export interface CreatePromptInput {
  title: string;
  description?: string;
  provider: Prompt["provider"];
  category?: Prompt["category"];
  use_case?: string;
  prompt_text: string;
  avoidance_text?: string;
  aspect_ratio?: string;
  model_version?: string;
  camera?: string;
  lens?: string;
  lighting?: string;
  style_ref?: string;
  parameters?: Record<string, string>;
  tags?: string[];
  rating?: number;
  ai_look_risk?: number;
  is_winner?: boolean;
  is_failed?: boolean;
  is_recipe?: boolean;
  failure_notes?: string;
  notes?: string;
  parent_id?: string;
  version?: number;
}

export async function getPrompts(): Promise<Prompt[]> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select(
      "SELECT * FROM prompts ORDER BY created_at DESC"
    )) as Record<string, unknown>[];
    return rows.map(rowToPrompt);
  }
  return loadMemStore().prompts.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function getPromptById(id: string): Promise<Prompt | null> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select(
      "SELECT * FROM prompts WHERE id = $1",
      [id]
    )) as Record<string, unknown>[];
    return rows[0] ? rowToPrompt(rows[0]) : null;
  }
  const store = loadMemStore();
  return store.prompts.find((p) => p.id === id) ?? null;
}

export async function createPrompt(data: CreatePromptInput): Promise<string> {
  const id = generateId();
  const ts = now();

  if (isTauri) {
    const db = await getDb();
    await db.execute(
      `INSERT INTO prompts
        (id, title, description, provider, category, use_case, prompt_text,
         avoidance_text, aspect_ratio, model_version, camera, lens, lighting,
         style_ref, parameters,
         tags, rating, ai_look_risk, reuse_potential, is_recipe, is_winner, is_failed,
         failure_notes, notes, version, parent_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,0,$19,$20,$21,$22,$23,$24,$25,$26,$27)`,
      [
        id,
        data.title,
        data.description ?? null,
        data.provider,
        data.category ?? null,
        data.use_case ?? null,
        data.prompt_text,
        data.avoidance_text ?? null,
        data.aspect_ratio ?? null,
        data.model_version ?? null,
        data.camera ?? null,
        data.lens ?? null,
        data.lighting ?? null,
        data.style_ref ?? null,
        data.parameters ? JSON.stringify(data.parameters) : null,
        data.tags ? JSON.stringify(data.tags) : null,
        data.rating ?? 0,
        data.ai_look_risk ?? 0,
        data.is_recipe ? 1 : 0,
        data.is_winner ? 1 : 0,
        data.is_failed ? 1 : 0,
        data.failure_notes ?? null,
        data.notes ?? null,
        data.version ?? 1,
        data.parent_id ?? null,
        ts,
        ts,
      ]
    );
    return id;
  }

  const store = loadMemStore();
  const prompt: Prompt = {
    id,
    title: data.title,
    description: data.description,
    provider: data.provider,
    category: data.category,
    use_case: data.use_case,
    prompt_text: data.prompt_text,
    avoidance_text: data.avoidance_text,
    aspect_ratio: data.aspect_ratio,
    model_version: data.model_version,
    camera: data.camera,
    lens: data.lens,
    lighting: data.lighting,
    tags: data.tags,
    rating: data.rating ?? 0,
    ai_look_risk: data.ai_look_risk ?? 0,
    reuse_potential: 0,
    is_recipe: data.is_recipe ?? false,
    is_winner: data.is_winner ?? false,
    is_failed: data.is_failed ?? false,
    failure_notes: data.failure_notes,
    notes: data.notes,
    version: data.version ?? 1,
    parent_id: data.parent_id,
    created_at: ts,
    updated_at: ts,
  };
  store.prompts.unshift(prompt);
  saveMemStore(store);
  return id;
}

export async function updatePrompt(
  id: string,
  data: Partial<CreatePromptInput>
): Promise<void> {
  const ts = now();

  if (isTauri) {
    const db = await getDb();
    await db.execute(
      `UPDATE prompts SET
        title = COALESCE($2, title),
        description = $3,
        provider = COALESCE($4, provider),
        category = $5,
        use_case = $6,
        prompt_text = COALESCE($7, prompt_text),
        avoidance_text = $8,
        aspect_ratio = $9,
        model_version = $10,
        camera = $11,
        lens = $12,
        lighting = $13,
        tags = $14,
        rating = COALESCE($15, rating),
        ai_look_risk = COALESCE($16, ai_look_risk),
        is_winner = COALESCE($17, is_winner),
        is_failed = COALESCE($18, is_failed),
        failure_notes = $19,
        notes = $20,
        updated_at = $21
       WHERE id = $1`,
      [
        id,
        data.title ?? null,
        data.description ?? null,
        data.provider ?? null,
        data.category ?? null,
        data.use_case ?? null,
        data.prompt_text ?? null,
        data.avoidance_text ?? null,
        data.aspect_ratio ?? null,
        data.model_version ?? null,
        data.camera ?? null,
        data.lens ?? null,
        data.lighting ?? null,
        data.tags ? JSON.stringify(data.tags) : null,
        data.rating ?? null,
        data.ai_look_risk ?? null,
        data.is_winner != null ? (data.is_winner ? 1 : 0) : null,
        data.is_failed != null ? (data.is_failed ? 1 : 0) : null,
        data.failure_notes ?? null,
        data.notes ?? null,
        ts,
      ]
    );
    return;
  }

  const store = loadMemStore();
  const idx = store.prompts.findIndex((p) => p.id === id);
  if (idx === -1) return;
  store.prompts[idx] = {
    ...store.prompts[idx],
    ...data,
    tags: data.tags ?? store.prompts[idx].tags,
    updated_at: ts,
  };
  saveMemStore(store);
}

export async function deletePrompt(id: string): Promise<void> {
  if (isTauri) {
    const db = await getDb();
    await db.execute("DELETE FROM prompts WHERE id = $1", [id]);
    return;
  }
  const store = loadMemStore();
  store.prompts = store.prompts.filter((p) => p.id !== id);
  saveMemStore(store);
}

export async function searchPrompts(query: string): Promise<Prompt[]> {
  const q = query.toLowerCase().trim();
  if (!q) return getPrompts();

  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select(
      `SELECT * FROM prompts
       WHERE lower(title) LIKE $1
          OR lower(description) LIKE $1
          OR lower(prompt_text) LIKE $1
          OR lower(tags) LIKE $1
       ORDER BY created_at DESC`,
      [`%${q}%`]
    )) as Record<string, unknown>[];
    return rows.map(rowToPrompt);
  }

  const store = loadMemStore();
  return store.prompts.filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.prompt_text.toLowerCase().includes(q) ||
      p.tags?.some((t) => t.toLowerCase().includes(q))
  );
}

export async function getDashboardStats(): Promise<DashboardStats> {
  if (isTauri) {
    const db = await getDb();
    const [totals, recent, topRated] = await Promise.all([
      db.select(
        `SELECT
          (SELECT COUNT(*) FROM prompts) as total,
          (SELECT COUNT(*) FROM prompts WHERE is_winner = 1) as winners,
          (SELECT COUNT(*) FROM prompts WHERE is_recipe = 1) as recipes,
          (SELECT COUNT(*) FROM results) as results`
      ) as Promise<{ total: number; winners: number; recipes: number; results: number }[]>,
      db.select(
        "SELECT * FROM prompts ORDER BY created_at DESC LIMIT 5"
      ) as Promise<Record<string, unknown>[]>,
      db.select(
        "SELECT * FROM prompts WHERE rating > 0 ORDER BY rating DESC LIMIT 5"
      ) as Promise<Record<string, unknown>[]>,
    ]);
    return {
      total_prompts: totals[0]?.total ?? 0,
      total_results: totals[0]?.results ?? 0,
      total_winners: totals[0]?.winners ?? 0,
      total_recipes: totals[0]?.recipes ?? 0,
      recent_prompts: recent.map(rowToPrompt),
      top_rated: topRated.map(rowToPrompt),
    };
  }

  const store = loadMemStore();
  const prompts = store.prompts;
  return {
    total_prompts: prompts.length,
    total_results: 0,
    total_winners: prompts.filter((p) => p.is_winner).length,
    total_recipes: prompts.filter((p) => p.is_recipe).length,
    recent_prompts: prompts.slice(0, 5),
    top_rated: [...prompts].sort((a, b) => b.rating - a.rating).slice(0, 5),
  };
}

export async function clearAllData(): Promise<void> {
  if (isTauri) {
    const db = await getDb();
    await db.execute("DELETE FROM prompts");
    await db.execute("DELETE FROM results");
    await db.execute("DELETE FROM recipes");
    await db.execute("DELETE FROM srefs");
    return;
  }
  localStorage.removeItem("framecraft_dev");
}

// ─── Token Library ────────────────────────────────────────────

const STATIC_CATEGORIES: TokenCategory[] = [
  { id: "subject",     name: "subject",     label: "Subject",              sort_order: 1 },
  { id: "action",      name: "action",      label: "Action",               sort_order: 2 },
  { id: "environment", name: "environment", label: "Environment",          sort_order: 3 },
  { id: "camera",      name: "camera",      label: "Camera",               sort_order: 4 },
  { id: "lens",        name: "lens",        label: "Lens",                 sort_order: 5 },
  { id: "composition", name: "composition", label: "Composition",          sort_order: 6 },
  { id: "lighting",    name: "lighting",    label: "Lighting",             sort_order: 7 },
  { id: "mood",        name: "mood",        label: "Mood",                 sort_order: 8 },
  { id: "material",    name: "material",    label: "Material",             sort_order: 9 },
  { id: "color",       name: "color",       label: "Color",                sort_order: 10 },
  { id: "realism",     name: "realism",     label: "Realism",              sort_order: 11 },
  { id: "brand_tone",  name: "brand_tone",  label: "Brand Tone",           sort_order: 12 },
  { id: "motion",      name: "motion",      label: "Motion",               sort_order: 13 },
  { id: "avoidance",   name: "avoidance",   label: "Avoidance",            sort_order: 14 },
  { id: "parameters",  name: "parameters",  label: "Provider Parameters",  sort_order: 15 },
];

function rowToCategory(row: Record<string, unknown>): TokenCategory {
  return {
    id: row.id as string,
    name: row.name as string,
    label: row.label as string,
    description: row.description as string | undefined,
    sort_order: row.sort_order as number,
  };
}

function rowToToken(row: Record<string, unknown>): Token {
  return {
    id: row.id as string,
    text: row.text as string,
    category_id: row.category_id as string,
    provider: row.provider as Token["provider"] | undefined,
    use_count: (row.use_count as number) ?? 0,
    quality_score: (row.quality_score as number) ?? 0,
    is_builtin: Boolean(row.is_builtin),
  };
}

export async function getTokenCategories(): Promise<TokenCategory[]> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select(
      "SELECT * FROM token_categories ORDER BY sort_order"
    )) as Record<string, unknown>[];
    return rows.map(rowToCategory);
  }
  return STATIC_CATEGORIES;
}

export async function getTokensByCategory(categoryId: string): Promise<Token[]> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select(
      "SELECT * FROM tokens WHERE category_id = $1 ORDER BY use_count DESC, text ASC",
      [categoryId]
    )) as Record<string, unknown>[];
    return rows.map(rowToToken);
  }
  return [];
}
