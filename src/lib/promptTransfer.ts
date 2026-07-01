import type { Prompt } from "@/types";
import { getFramecraftDb } from "./dbConnection";
import { executeAtomically, type AtomicStatement } from "./dbTransaction";

export interface PromptTransferRecordV2 {
  source_id: string;
  parent_source_id?: string;
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
  rating: number;
  ai_look_risk: number;
  reuse_potential: number;
  is_recipe: boolean;
  recipe_use_count?: number;
  is_winner: boolean;
  is_failed: boolean;
  failure_notes?: string;
  notes?: string;
  best_use?: string;
  risk_notes?: string;
  source_url?: string;
  thumbnail_data?: string;
  builder_state?: string;
}

export interface PromptTransferV2 {
  kind: "framecraft.prompt-transfer";
  version: 2;
  exported_at: string;
  prompts: PromptTransferRecordV2[];
}

export function exportPromptTransfer(prompts: Prompt[]): PromptTransferV2 {
  return {
    kind: "framecraft.prompt-transfer",
    version: 2,
    exported_at: new Date().toISOString(),
    prompts: prompts.map((p) => ({
      source_id: p.id,
      parent_source_id: p.parent_id,
      title: p.title,
      description: p.description,
      provider: p.provider,
      category: p.category,
      use_case: p.use_case,
      prompt_text: p.prompt_text,
      avoidance_text: p.avoidance_text,
      aspect_ratio: p.aspect_ratio,
      model_version: p.model_version,
      camera: p.camera,
      lens: p.lens,
      lighting: p.lighting,
      style_ref: p.style_ref,
      character_ref: p.character_ref,
      image_ref: p.image_ref,
      parameters: p.parameters,
      tags: p.tags,
      rating: p.rating,
      ai_look_risk: p.ai_look_risk,
      reuse_potential: p.reuse_potential,
      is_recipe: p.is_recipe,
      recipe_use_count: p.recipe_use_count,
      is_winner: p.is_winner,
      is_failed: p.is_failed,
      failure_notes: p.failure_notes,
      notes: p.notes,
      best_use: p.best_use,
      risk_notes: p.risk_notes,
      source_url: p.source_url,
      thumbnail_data: p.thumbnail_data,
      builder_state: p.builder_state,
    })),
  };
}

export function parsePromptTransfer(raw: string): PromptTransferV2 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Prompt transfer file is not valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Prompt transfer file is not a JSON object");
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.kind !== "framecraft.prompt-transfer") {
    throw new Error(
      `Unrecognized file kind: expected "framecraft.prompt-transfer", got ${JSON.stringify(obj.kind)}`
    );
  }
  if (obj.version !== 2) {
    throw new Error(
      `Unsupported prompt transfer version: ${String(obj.version)} (only version 2 is supported)`
    );
  }
  if (!Array.isArray(obj.prompts)) {
    throw new Error("Prompt transfer file is missing a prompts array");
  }
  return obj as unknown as PromptTransferV2;
}

const INSERT_SQL = `INSERT INTO prompts (
  id, title, description, provider, category, use_case, prompt_text,
  avoidance_text, aspect_ratio, model_version, camera, lens, lighting,
  style_ref, character_ref, image_ref, parameters, tags,
  rating, ai_look_risk, reuse_potential, is_recipe, recipe_use_count,
  is_winner, is_failed, failure_notes, notes, best_use, risk_notes,
  source_url, thumbnail_data, builder_state, parent_id, version,
  created_at, updated_at
) VALUES (
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
  $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36
)`;

export async function importPromptTransfer(data: PromptTransferV2): Promise<number> {
  const db = await getFramecraftDb();
  const ts = new Date().toISOString();

  // Phase 1: assign new IDs so parent references can be resolved regardless of order
  const idMap = new Map<string, string>();
  for (const p of data.prompts) {
    idMap.set(p.source_id, crypto.randomUUID().replace(/-/g, ""));
  }

  // Phase 2: build one atomic statement per prompt with remapped parent_id
  const statements: AtomicStatement[] = data.prompts.map((p) => ({
    operation: "execute" as const,
    sql: INSERT_SQL,
    bindValues: [
      idMap.get(p.source_id)!,
      p.title,
      p.description ?? null,
      p.provider,
      p.category ?? null,
      p.use_case ?? null,
      p.prompt_text,
      p.avoidance_text ?? null,
      p.aspect_ratio ?? null,
      p.model_version ?? null,
      p.camera ?? null,
      p.lens ?? null,
      p.lighting ?? null,
      p.style_ref ?? null,
      p.character_ref ?? null,
      p.image_ref ?? null,
      p.parameters ? JSON.stringify(p.parameters) : null,
      p.tags ? JSON.stringify(p.tags) : null,
      p.rating,
      p.ai_look_risk,
      p.reuse_potential,
      p.is_recipe ? 1 : 0,
      p.recipe_use_count ?? 0,
      p.is_winner ? 1 : 0,
      p.is_failed ? 1 : 0,
      p.failure_notes ?? null,
      p.notes ?? null,
      p.best_use ?? null,
      p.risk_notes ?? null,
      p.source_url ?? null,
      p.thumbnail_data ?? null,
      p.builder_state ?? null,
      p.parent_source_id ? (idMap.get(p.parent_source_id) ?? null) : null,
      1,
      ts,
      ts,
    ],
  }));

  await executeAtomically(db, statements);
  return data.prompts.length;
}
