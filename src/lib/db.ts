import type { Prompt, DashboardStats, TokenCategory, Token, AvoidancePattern, Result, SREF, Profile } from "@/types";
import { summarizePromptFromResults } from "@/lib/resultMemory";
import { getFramecraftDb } from "./dbConnection";
import { selectPaged, type PageResult, type PageOptions } from "./pagination";

// ─── Environment Detection ───────────────────────────────────
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function getDb() {
  return getFramecraftDb();
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
  character_ref?: string;
  image_ref?: string;
  parameters?: Record<string, string | boolean | number>;
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

export type CreateRecipeInput = Omit<CreatePromptInput, "is_recipe">;

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

export async function getPromptsPaged(opts: PageOptions = {}): Promise<PageResult<Prompt>> {
  return selectPaged(
    "SELECT * FROM prompts ORDER BY created_at DESC",
    [],
    rowToPrompt,
    "SELECT COUNT(*) as n FROM prompts",
    [],
    opts
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
    style_ref: data.style_ref,
    character_ref: data.character_ref,
    image_ref: data.image_ref,
    parameters: data.parameters,
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

export async function createRecipe(data: CreateRecipeInput): Promise<string> {
  return createPrompt({ ...data, is_recipe: true });
}

export async function updatePrompt(
  id: string,
  data: Partial<CreatePromptInput>
): Promise<void> {
  const ts = now();

  if (isTauri) {
    const db = await getDb();
    const sets: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length + 1}`);
    };

    if ("title" in data && data.title != null) add("title", data.title);
    if ("description" in data) add("description", data.description ?? null);
    if ("provider" in data && data.provider != null) add("provider", data.provider);
    if ("category" in data) add("category", data.category ?? null);
    if ("use_case" in data) add("use_case", data.use_case ?? null);
    if ("prompt_text" in data && data.prompt_text != null) add("prompt_text", data.prompt_text);
    if ("avoidance_text" in data) add("avoidance_text", data.avoidance_text ?? null);
    if ("aspect_ratio" in data) add("aspect_ratio", data.aspect_ratio ?? null);
    if ("model_version" in data) add("model_version", data.model_version ?? null);
    if ("camera" in data) add("camera", data.camera ?? null);
    if ("lens" in data) add("lens", data.lens ?? null);
    if ("lighting" in data) add("lighting", data.lighting ?? null);
    if ("style_ref" in data) add("style_ref", data.style_ref ?? null);
    if ("character_ref" in data) add("character_ref", data.character_ref ?? null);
    if ("image_ref" in data) add("image_ref", data.image_ref ?? null);
    if ("parameters" in data) add("parameters", data.parameters ? JSON.stringify(data.parameters) : null);
    if ("tags" in data) add("tags", data.tags ? JSON.stringify(data.tags) : null);
    if ("rating" in data && data.rating != null) add("rating", data.rating);
    if ("ai_look_risk" in data && data.ai_look_risk != null) add("ai_look_risk", data.ai_look_risk);
    if ("is_winner" in data && data.is_winner != null) add("is_winner", data.is_winner ? 1 : 0);
    if ("is_failed" in data && data.is_failed != null) add("is_failed", data.is_failed ? 1 : 0);
    if ("failure_notes" in data) add("failure_notes", data.failure_notes ?? null);
    if ("notes" in data) add("notes", data.notes ?? null);
    add("updated_at", ts);

    await db.execute(`UPDATE prompts SET ${sets.join(", ")} WHERE id = $1`, [id, ...values]);
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

export async function batchUpdatePrompts(ids: string[], patch: Partial<Pick<CreatePromptInput, "rating" | "is_winner" | "is_failed" | "tags">>): Promise<void> {
  if (ids.length === 0) return;
  for (const id of ids) await updatePrompt(id, patch);
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
    is_favorite: Boolean(row.is_favorite),
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

export async function getAllTokens(sort: "quality" | "use" | "alpha" | "rating" = "quality"): Promise<Token[]> {
  if (!isTauri) return [];
  const db = await getDb();
  const orderBy = {
    quality: "quality_score DESC, use_count DESC, text ASC",
    use: "use_count DESC, quality_score DESC, text ASC",
    alpha: "text ASC",
    rating: "avg_rating DESC, use_count DESC, text ASC",
  }[sort];
  const rows = (await db.select(
    `SELECT * FROM tokens ORDER BY ${orderBy}`
  )) as Record<string, unknown>[];
  return rows.map(rowToToken);
}

export async function searchTokens(query: string, categoryId?: string): Promise<Token[]> {
  if (!isTauri) return [];
  const q = query.toLowerCase().trim();
  if (!q && !categoryId) return getAllTokens();
  const db = await getDb();
  const params: unknown[] = [];
  const conditions: string[] = [];
  if (q) { conditions.push(`lower(text) LIKE $${params.length + 1}`); params.push(`%${q}%`); }
  if (categoryId) { conditions.push(`category_id = $${params.length + 1}`); params.push(categoryId); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = (await db.select(
    `SELECT * FROM tokens ${where} ORDER BY quality_score DESC, use_count DESC, text ASC LIMIT 200`,
    params
  )) as Record<string, unknown>[];
  return rows.map(rowToToken);
}

export async function getTokensByCategory(categoryId: string): Promise<Token[]> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select(
      "SELECT * FROM tokens WHERE category_id = $1 ORDER BY use_count DESC, quality_score DESC, text ASC",
      [categoryId]
    )) as Record<string, unknown>[];
    return rows.map(rowToToken);
  }
  return [];
}

export async function createToken(text: string, categoryId: string): Promise<Token> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Token text cannot be empty");
  if (isTauri) {
    const db = await getDb();
    await db.execute(
      "INSERT INTO tokens (text, category_id, is_builtin) VALUES ($1, $2, 0)",
      [trimmed, categoryId]
    );
    const rows = (await db.select(
      "SELECT * FROM tokens WHERE text = $1 AND category_id = $2 ORDER BY rowid DESC LIMIT 1",
      [trimmed, categoryId]
    )) as Record<string, unknown>[];
    return rowToToken(rows[0]);
  }
  // Dev mode: return a synthetic token
  return {
    id: `dev_${Date.now()}`,
    text: trimmed,
    category_id: categoryId,
    use_count: 0,
    quality_score: 0,
    is_builtin: false,
    is_favorite: false,
  };
}

export async function toggleTokenFavorite(id: string, isFavorite: boolean): Promise<void> {
  if (isTauri) {
    const db = await getDb();
    await db.execute("UPDATE tokens SET is_favorite = $1 WHERE id = $2", [isFavorite ? 1 : 0, id]);
    return;
  }
  // dev mode: no-op (tokens are stateless in dev)
}

// ─── Avoidance Patterns ──────────────────────────────────────

function rowToAvoidancePattern(row: Record<string, unknown>): AvoidancePattern {
  return {
    id: row.id as string,
    artifact_type: row.artifact_type as string,
    label: row.label as string,
    category: row.category as string,
    description: row.description as string | undefined,
    correction_prompt: row.correction_prompt as string | undefined,
    severity: row.severity as AvoidancePattern["severity"],
    provider: row.provider as AvoidancePattern["provider"] | undefined,
    is_builtin: Boolean(row.is_builtin),
  };
}

const STATIC_AVOIDANCE_PATTERNS: AvoidancePattern[] = [
  { id: "bad_hands", artifact_type: "bad_hands", label: "Bad Hands / Fingers", category: "all", severity: "critical", correction_prompt: "anatomically correct hands, natural finger joints", is_builtin: true },
  { id: "plastic_skin", artifact_type: "plastic_skin", label: "Plastic Skin / Waxy Texture", category: "portrait", severity: "high", correction_prompt: "authentic skin texture, real pore detail", is_builtin: true },
  { id: "gibberish_text", artifact_type: "gibberish_text", label: "Gibberish Text / Fake Signage", category: "all", severity: "high", correction_prompt: "avoid visible text in frame", is_builtin: true },
  { id: "eye_inconsistency", artifact_type: "eye_inconsistency", label: "Eye / Pupil Inconsistency", category: "portrait", severity: "high", correction_prompt: "consistent pupil size, natural iris detail", is_builtin: true },
  { id: "ai_glow", artifact_type: "ai_glow", label: "AI Glow / Fake Luminance", category: "all", severity: "medium", correction_prompt: "no artificial glow, practical light sources only", is_builtin: true },
  { id: "jewelry_mismatch", artifact_type: "jewelry_mismatch", label: "Jewelry Mismatch", category: "portrait", severity: "medium", correction_prompt: "physically attached jewelry, symmetric earrings", is_builtin: true },
  { id: "background_melting", artifact_type: "background_melting", label: "Background Melting", category: "all", severity: "medium", correction_prompt: "clear subject-background separation", is_builtin: true },
  { id: "floating_objects", artifact_type: "floating_objects", label: "Floating Objects", category: "product", severity: "medium", correction_prompt: "grounded objects, correct shadow casting", is_builtin: true },
  { id: "texture_blending", artifact_type: "texture_blending", label: "Texture Blending", category: "all", severity: "medium", correction_prompt: "distinct material boundaries", is_builtin: true },
  { id: "impossible_architecture", artifact_type: "impossible_architecture", label: "Impossible Architecture", category: "architecture", severity: "medium", correction_prompt: "structurally plausible design", is_builtin: true },
  { id: "unreal_reflections", artifact_type: "unreal_reflections", label: "Unreal Reflections", category: "all", severity: "low", correction_prompt: "accurate surface reflections", is_builtin: true },
  { id: "fake_dof", artifact_type: "fake_dof", label: "Fake Depth of Field", category: "all", severity: "low", correction_prompt: "consistent focal plane, natural lens blur falloff", is_builtin: true },
  { id: "over_sharpened", artifact_type: "over_sharpened", label: "Over-Sharpened Detail", category: "all", severity: "low", correction_prompt: "natural sharpness level, realistic detail density", is_builtin: true },
  { id: "perfect_symmetry", artifact_type: "perfect_symmetry", label: "Perfect Symmetry (Unnatural)", category: "portrait", severity: "low", correction_prompt: "natural asymmetry, slightly off-center composition", is_builtin: true },
  { id: "generic_luxury_mood", artifact_type: "generic_luxury_mood", label: "Generic Luxury Mood", category: "advertising", severity: "low", correction_prompt: "specific brand visual language, intentional mood", is_builtin: true },
  { id: "fake_cinematic_sheen", artifact_type: "fake_cinematic_sheen", label: "Fake Cinematic Sheen", category: "all", severity: "low", correction_prompt: "motivated camera style, specific film reference", is_builtin: true },
];

export async function getAvoidancePatterns(): Promise<AvoidancePattern[]> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select(
      "SELECT * FROM avoidance_patterns ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, label ASC"
    )) as Record<string, unknown>[];
    return rows.map(rowToAvoidancePattern);
  }
  return STATIC_AVOIDANCE_PATTERNS;
}

export async function createAvoidancePattern(data: {
  label: string;
  artifact_type: string;
  severity: "critical" | "high" | "medium" | "low";
  description?: string;
  correction_prompt?: string;
  triggers?: string[];
}): Promise<AvoidancePattern> {
  const pattern: AvoidancePattern = {
    id: crypto.randomUUID(),
    artifact_type: data.artifact_type,
    label: data.label,
    category: "all",
    description: data.description,
    correction_prompt: data.correction_prompt,
    severity: data.severity,
    is_builtin: false,
  };
  if (isTauri) {
    const db = await getDb();
    await db.execute(
      `INSERT INTO avoidance_patterns (id, artifact_type, label, category, description, correction_prompt, severity, is_builtin)
       VALUES ($1, $2, $3, 'all', $4, $5, $6, 0)`,
      [pattern.id, pattern.artifact_type, pattern.label, pattern.description ?? null, pattern.correction_prompt ?? null, pattern.severity]
    );
  }
  return pattern;
}

export async function deleteAvoidancePattern(id: string): Promise<void> {
  if (!isTauri) return;
  const db = await getDb();
  await db.execute("DELETE FROM avoidance_patterns WHERE id = $1 AND is_builtin = 0", [id]);
}

// ─── Results ─────────────────────────────────────────────────

export interface CreateResultInput {
  id?: string;
  prompt_id: string;
  file_path?: string;
  thumbnail_path?: string;
  provider?: string;
  score_overall?: number;
  score_realism?: number;
  score_brand_fit?: number;
  score_composition?: number;
  score_lighting?: number;
  score_ai_risk?: number;
  reuse_potential?: number;
  is_winner?: boolean;
  is_failed?: boolean;
  artifacts?: string[];
  notes?: string;
}

function rowToResult(row: Record<string, unknown>): Result {
  return {
    id: row.id as string,
    prompt_id: row.prompt_id as string,
    file_path: row.file_path as string | undefined,
    thumbnail_path: row.thumbnail_path as string | undefined,
    provider: row.provider as Result["provider"] | undefined,
    score_overall: (row.score_overall as number) ?? 0,
    score_realism: (row.score_realism as number) ?? 0,
    score_brand_fit: (row.score_brand_fit as number) ?? 0,
    score_composition: (row.score_composition as number) ?? 0,
    score_lighting: (row.score_lighting as number) ?? 0,
    score_ai_risk: (row.score_ai_risk as number) ?? 0,
    reuse_potential: (row.reuse_potential as number) ?? 0,
    is_winner: Boolean(row.is_winner),
    is_failed: Boolean(row.is_failed),
    artifacts: row.artifacts ? JSON.parse(row.artifacts as string) : [],
    notes: row.notes as string | undefined,
    created_at: row.created_at as string,
  };
}

const _devResults: (Result & { prompt_title?: string })[] = [];

export async function createResult(data: CreateResultInput): Promise<string> {
  if (isTauri) {
    const db = await getDb();
    const id = data.id ?? crypto.randomUUID().replace(/-/g, "");
    await db.execute(
      `INSERT INTO results
        (id, prompt_id, file_path, thumbnail_path, provider,
         score_overall, score_realism, score_brand_fit, score_composition,
         score_lighting, score_ai_risk, reuse_potential,
         is_winner, is_failed, artifacts, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        id,
        data.prompt_id,
        data.file_path ?? null,
        data.thumbnail_path ?? null,
        data.provider ?? null,
        data.score_overall ?? 0,
        data.score_realism ?? 0,
        data.score_brand_fit ?? 0,
        data.score_composition ?? 0,
        data.score_lighting ?? 0,
        data.score_ai_risk ?? 0,
        data.reuse_potential ?? 0,
        data.is_winner ? 1 : 0,
        data.is_failed ? 1 : 0,
        data.artifacts ? JSON.stringify(data.artifacts) : null,
        data.notes ?? null,
      ]
    );
    return id;
  }
  const id = data.id ?? `dev_result_${Date.now()}`;
  _devResults.push({
    id,
    prompt_id: data.prompt_id,
    file_path: data.file_path,
    thumbnail_path: data.thumbnail_path,
    provider: data.provider as Result["provider"],
    score_overall: data.score_overall ?? 0,
    score_realism: data.score_realism ?? 0,
    score_brand_fit: data.score_brand_fit ?? 0,
    score_composition: data.score_composition ?? 0,
    score_lighting: data.score_lighting ?? 0,
    score_ai_risk: data.score_ai_risk ?? 0,
    reuse_potential: data.reuse_potential ?? 0,
    is_winner: data.is_winner ?? false,
    is_failed: data.is_failed ?? false,
    artifacts: data.artifacts ?? [],
    notes: data.notes,
    created_at: new Date().toISOString(),
  });
  return id;
}

export async function getResultsForPrompt(promptId: string): Promise<Result[]> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select(
      "SELECT * FROM results WHERE prompt_id = $1 ORDER BY created_at DESC",
      [promptId]
    )) as Record<string, unknown>[];
    return rows.map(rowToResult);
  }
  return _devResults.filter((r) => r.prompt_id === promptId);
}

export async function recomputePromptResultSummary(promptId: string): Promise<void> {
  const results = await getResultsForPrompt(promptId);
  const summary = summarizePromptFromResults(results);
  await updatePrompt(promptId, summary);
}

export async function updateResult(id: string, data: Partial<CreateResultInput>): Promise<void> {
  if (isTauri) {
    const db = await getDb();
    await db.execute(
      `UPDATE results SET
        score_overall = COALESCE($1, score_overall),
        score_realism = COALESCE($2, score_realism),
        score_brand_fit = COALESCE($3, score_brand_fit),
        score_composition = COALESCE($4, score_composition),
        score_lighting = COALESCE($5, score_lighting),
        score_ai_risk = COALESCE($6, score_ai_risk),
        reuse_potential = COALESCE($7, reuse_potential),
        is_winner = COALESCE($8, is_winner),
        is_failed = COALESCE($9, is_failed),
        artifacts = COALESCE($10, artifacts),
        notes = COALESCE($11, notes)
       WHERE id = $12`,
      [
        data.score_overall ?? null,
        data.score_realism ?? null,
        data.score_brand_fit ?? null,
        data.score_composition ?? null,
        data.score_lighting ?? null,
        data.score_ai_risk ?? null,
        data.reuse_potential ?? null,
        data.is_winner !== undefined ? (data.is_winner ? 1 : 0) : null,
        data.is_failed !== undefined ? (data.is_failed ? 1 : 0) : null,
        data.artifacts ? JSON.stringify(data.artifacts) : null,
        data.notes ?? null,
        id,
      ]
    );
    return;
  }
  const idx = _devResults.findIndex((r) => r.id === id);
  if (idx !== -1) Object.assign(_devResults[idx], data);
}

export async function deleteResult(id: string): Promise<void> {
  if (isTauri) {
    const db = await getDb();
    await db.execute("DELETE FROM results WHERE id = $1", [id]);
    return;
  }
  const idx = _devResults.findIndex((r) => r.id === id);
  if (idx !== -1) _devResults.splice(idx, 1);
}

export async function getResultSummaryMap(): Promise<Record<string, { count: number; avg_score: number }>> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select(
      "SELECT prompt_id, COUNT(*) as count, AVG(score_overall) as avg_score FROM results GROUP BY prompt_id"
    )) as Record<string, unknown>[];
    return Object.fromEntries(
      rows.map((r) => [r.prompt_id as string, { count: r.count as number, avg_score: r.avg_score as number }])
    );
  }
  const map: Record<string, { count: number; avg_score: number }> = {};
  for (const r of _devResults) {
    if (!map[r.prompt_id]) map[r.prompt_id] = { count: 0, avg_score: 0 };
    map[r.prompt_id].count++;
    map[r.prompt_id].avg_score += r.score_overall;
  }
  for (const id in map) map[id].avg_score = map[id].avg_score / map[id].count;
  return map;
}

export async function getRecentResults(limit = 10): Promise<(Result & { prompt_title: string })[]> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select(
      `SELECT r.*, p.title as prompt_title
       FROM results r
       LEFT JOIN prompts p ON r.prompt_id = p.id
       ORDER BY r.created_at DESC LIMIT $1`,
      [limit]
    )) as Record<string, unknown>[];
    return rows.map((row) => ({ ...rowToResult(row), prompt_title: (row.prompt_title as string) ?? "" }));
  }
  return _devResults.slice(-limit).reverse().map((r) => ({ ...r, prompt_title: r.prompt_title ?? "" }));
}

// ─── Production Memory (Phase 06) ────────────────────────────

export async function updateTokenQualityFromResult(
  promptText: string,
  delta: number
): Promise<void> {
  if (!isTauri || Math.abs(delta) < 0.001) return;
  const db = await getDb();
  // Clamp quality_score to [-0.5, 1.0] range; use_count always increments on positive delta
  const clampedDelta = Math.max(-0.5, Math.min(1.0, delta));
  await db.execute(
    `UPDATE tokens
     SET quality_score = MAX(-0.5, MIN(1.0, quality_score + $1)),
         use_count = use_count + CASE WHEN $1 > 0 THEN 1 ELSE 0 END
     WHERE length(text) > 2
       AND instr(lower($2), lower(text)) > 0`,
    [clampedDelta, promptText]
  );
}

export async function getFailedResultArtifacts(
  category?: string,
  provider?: string
): Promise<string[]> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select(
      `SELECT r.artifacts
       FROM results r
       LEFT JOIN prompts p ON r.prompt_id = p.id
       WHERE r.is_failed = 1
         AND r.artifacts IS NOT NULL
         AND r.artifacts != '[]'
         AND ($1 IS NULL OR p.category = $1)
         AND ($2 IS NULL OR p.provider = $2)
       ORDER BY r.created_at DESC
       LIMIT 20`,
      [category ?? null, provider ?? null]
    )) as Record<string, unknown>[];
    const all: string[] = [];
    for (const row of rows) {
      try { all.push(...(JSON.parse(row.artifacts as string) as string[])); } catch {}
    }
    // Return deduplicated, most common first
    const freq: Record<string, number> = {};
    for (const a of all) freq[a] = (freq[a] ?? 0) + 1;
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([label]) => label);
  }
  return _devResults
    .filter((r) => r.is_failed && r.artifacts?.length)
    .flatMap((r) => r.artifacts ?? []);
}

// ─── SREF / Profile Library (Phase 08) ───────────────────────

function rowToSREF(row: Record<string, unknown>): SREF {
  return {
    id: row.id as string,
    code: row.code as string,
    title: row.title as string | undefined,
    description: row.description as string | undefined,
    provider: (row.provider as string ?? "midjourney") as SREF["provider"],
    category: row.category as SREF["category"] | undefined,
    best_use: row.best_use as string | undefined,
    risk_notes: row.risk_notes as string | undefined,
    example_path: row.example_path as string | undefined,
    rating: Number(row.rating ?? 0),
    tags: row.tags ? tryParseJson<string[]>(row.tags as string, []) : undefined,
    notes: row.notes as string | undefined,
    created_at: row.created_at as string,
  };
}

function rowToProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    code: row.code as string,
    title: row.title as string | undefined,
    description: row.description as string | undefined,
    provider: (row.provider as string ?? "midjourney") as Profile["provider"],
    best_use: row.best_use as string | undefined,
    risk_notes: row.risk_notes as string | undefined,
    example_path: row.example_path as string | undefined,
    rating: Number(row.rating ?? 0),
    tags: row.tags ? tryParseJson<string[]>(row.tags as string, []) : undefined,
    notes: row.notes as string | undefined,
    created_at: row.created_at as string,
  };
}

function tryParseJson<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export async function getSREFByCode(code: string): Promise<SREF | null> {
  if (!isTauri) return null;
  const db = await getDb();
  const rows = (await db.select("SELECT * FROM srefs WHERE code = $1 LIMIT 1", [code])) as Record<string, unknown>[];
  return rows.length ? rowToSREF(rows[0]) : null;
}

export async function getSREFs(): Promise<SREF[]> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select("SELECT * FROM srefs ORDER BY rating DESC, created_at ASC")) as Record<string, unknown>[];
    return rows.map(rowToSREF);
  }
  return [];
}

export async function updateSREFRating(id: string, rating: number): Promise<void> {
  if (!isTauri) return;
  const db = await getDb();
  await db.execute("UPDATE srefs SET rating = $1, updated_at = datetime('now') WHERE id = $2", [rating, id]);
}

export async function createSREF(data: { code: string; title?: string; description?: string; category?: string; best_use?: string; risk_notes?: string; notes?: string; tags?: string[] }): Promise<string> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select(
      `INSERT INTO srefs (code, title, description, provider, category, best_use, risk_notes, notes, tags)
       VALUES ($1, $2, $3, 'midjourney', $4, $5, $6, $7, $8)
       RETURNING id`,
      [data.code, data.title ?? null, data.description ?? null, data.category ?? null, data.best_use ?? null, data.risk_notes ?? null, data.notes ?? null, data.tags ? JSON.stringify(data.tags) : null]
    )) as { id: string }[];
    return rows[0].id;
  }
  return crypto.randomUUID();
}

export async function deleteSREF(id: string): Promise<void> {
  if (!isTauri) return;
  const db = await getDb();
  await db.execute("DELETE FROM srefs WHERE id = $1", [id]);
}

export async function getProfiles(): Promise<Profile[]> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select("SELECT * FROM profiles ORDER BY rating DESC, created_at ASC")) as Record<string, unknown>[];
    return rows.map(rowToProfile);
  }
  return [];
}

export async function updateProfileRating(id: string, rating: number): Promise<void> {
  if (!isTauri) return;
  const db = await getDb();
  await db.execute("UPDATE profiles SET rating = $1 WHERE id = $2", [rating, id]);
}

export async function createProfile(data: { code: string; title?: string; description?: string; best_use?: string; risk_notes?: string; notes?: string; tags?: string[] }): Promise<string> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select(
      `INSERT INTO profiles (code, title, description, provider, best_use, risk_notes, notes, tags)
       VALUES ($1, $2, $3, 'midjourney', $4, $5, $6, $7)
       RETURNING id`,
      [data.code, data.title ?? null, data.description ?? null, data.best_use ?? null, data.risk_notes ?? null, data.notes ?? null, data.tags ? JSON.stringify(data.tags) : null]
    )) as { id: string }[];
    return rows[0].id;
  }
  return crypto.randomUUID();
}

export async function deleteProfile(id: string): Promise<void> {
  if (!isTauri) return;
  const db = await getDb();
  await db.execute("DELETE FROM profiles WHERE id = $1", [id]);
}
