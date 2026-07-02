// Storytelling (V2 feedback §5, planned in review/02a) — sequential shot
// lists ("storyboards") generated per creative direction. Approved shots
// become named prompt variations wired back to the project. Plan document:
// review/02a_storytelling_future_sprint_plan.md.

import type { CreativeDirection, DirectionStoryboard, Project } from "@/types";
import { callDirectionModel, extractJson } from "./creativeDirectionGeneration";
import type { AIModel } from "./aiConfig";
import { buildConsistencySuffix, suggestConsistencyFactors } from "./consistencyFactors";
import { createPrompt, type CreatePromptInput } from "./db";
import { addPromptToProject } from "./projects";
import { getFramecraftDb } from "./dbConnection";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const developmentStoryboards: DirectionStoryboard[] = [];

export const MIN_SHOT_COUNT = 3;
export const MAX_SHOT_COUNT = 12;
export const SHOT_COUNT_PRESETS = [3, 5, 7] as const;

/** Fixed accent set for shot rows and their converted variation cards — red is excluded (signal only). */
export const ACCENT_COLORS = ["#38B7C8", "#DFA83A", "#B794F4", "rgba(247,247,242,0.6)", "#7FA6D9"];
export const ACCENT_COUNT = ACCENT_COLORS.length;

const CANONICAL_ARC = ["Setup", "Movement", "Detail", "Emotional shift", "Final image"];

export interface GeneratedShot {
  shot_label: string;
  description: string;
}

function now() {
  return new Date().toISOString();
}

/** Clamp a requested shot count into the supported range, defaulting invalid input to the smallest preset. */
export function clampShotCount(count: number): number {
  if (!Number.isFinite(count)) return MIN_SHOT_COUNT;
  return Math.min(MAX_SHOT_COUNT, Math.max(MIN_SHOT_COUNT, Math.round(count)));
}

/** Stable accent slot for a shot at a given position in the sequence. */
export function accentIndexForSortOrder(sortOrder: number): number {
  return ((sortOrder % ACCENT_COUNT) + ACCENT_COUNT) % ACCENT_COUNT;
}

export function accentColorForIndex(accentIndex: number): string {
  return ACCENT_COLORS[((accentIndex % ACCENT_COUNT) + ACCENT_COUNT) % ACCENT_COUNT];
}

/**
 * Accent color for a prompt variation card, derived from its `variant_label`
 * alone (e.g. "Shot 03 — Detail") — no join back to the storyboard row
 * needed, since the shot number maps deterministically onto the same accent
 * cycle used when the storyboard was generated (`accentIndexForSortOrder`).
 */
export function accentColorForVariantLabel(variantLabel?: string): string | undefined {
  if (!variantLabel) return undefined;
  const match = variantLabel.trim().match(/^shot\s+(\d+)/i);
  if (!match) return undefined;
  const shotNumber = parseInt(match[1], 10);
  return accentColorForIndex(accentIndexForSortOrder(shotNumber - 1));
}

/**
 * Which narrative arc stage a shot at `index` (0-based) falls into, out of
 * `count` total shots — proportionally maps the sequence onto the 5-stage
 * canonical arc (Setup → Movement → Detail → Emotional shift → Final image).
 */
export function arcStageForIndex(index: number, count: number): string {
  if (count <= 1) return CANONICAL_ARC[0];
  const clampedIndex = Math.min(Math.max(index, 0), count - 1);
  const stage = Math.floor((clampedIndex / (count - 1)) * (CANONICAL_ARC.length - 1));
  return CANONICAL_ARC[stage];
}

function buildArcGuidance(count: number): string {
  return Array.from({ length: count }, (_, index) => `${index + 1}) ${arcStageForIndex(index, count)}`).join(", ");
}

const SHOT_JSON_SHAPE = `{
  "shots": [
    { "shot_label": "Shot 01 — Setup", "description": "production-ready shot description" }
  ]
}`;

function buildStoryboardPrompt(
  project: Project,
  direction: CreativeDirection,
  count: number,
  visualRefContext?: string
): string {
  const context = [
    `Project: ${project.title}`,
    project.client ? `Client: ${project.client}` : "",
    direction.title ? `Selected direction: ${direction.title}` : "",
    direction.campaign_idea ? `Campaign idea: ${direction.campaign_idea}` : "",
    direction.visual_aesthetic ? `Visual aesthetic: ${direction.visual_aesthetic}` : "",
    direction.tone ? `Tone: ${direction.tone}` : "",
    direction.prompt_direction ? `Prompt direction: ${direction.prompt_direction}` : "",
    project.aspect_ratios?.length ? `Aspect ratios: ${project.aspect_ratios.join(", ")}` : "",
    visualRefContext?.trim() ? visualRefContext.trim() : "",
  ].filter(Boolean).join("\n");

  return `You are a senior creative director storyboarding a sequential shot list for one approved creative direction.

Develop exactly ${count} sequential shots that tell this direction's narrative arc, in shooting order. Scale the arc across the shots (roughly: ${buildArcGuidance(count)}). Each shot must be a materially different, production-ready image description — not a cosmetic variation of the last shot.

${context}

Return ONLY valid JSON in this exact structure, with exactly ${count} shots in order:
${SHOT_JSON_SHAPE}`;
}

export function parseStoryboardShots(raw: string, expectedCount: number): GeneratedShot[] {
  const parsed = extractJson(raw) as { shots?: unknown };
  if (!Array.isArray(parsed?.shots) || parsed.shots.length !== expectedCount) {
    throw new Error(`Storyboard must return exactly ${expectedCount} shots.`);
  }
  return parsed.shots.map((candidate, index) => {
    if (!candidate || typeof candidate !== "object") {
      throw new Error(`Shot ${index + 1} is invalid.`);
    }
    const record = candidate as Record<string, unknown>;
    const shot_label = typeof record.shot_label === "string" ? record.shot_label.trim() : "";
    const description = typeof record.description === "string" ? record.description.trim() : "";
    if (!shot_label) throw new Error(`Shot ${index + 1} is missing shot_label.`);
    if (!description) throw new Error(`Shot ${index + 1} is missing description.`);
    return { shot_label, description };
  });
}

export async function generateStoryboard(
  project: Project,
  direction: CreativeDirection,
  model: AIModel,
  count: number,
  visualRefContext?: string
): Promise<GeneratedShot[]> {
  const clamped = clampShotCount(count);
  const prompt = buildStoryboardPrompt(project, direction, clamped, visualRefContext);
  const raw = await callDirectionModel(model, prompt);
  return parseStoryboardShots(raw, clamped);
}

// ─── CRUD ────────────────────────────────────────────────────

function rowToShot(row: Record<string, unknown>): DirectionStoryboard {
  return {
    id: row.id as string,
    direction_id: row.direction_id as string,
    project_id: row.project_id as string,
    sort_order: row.sort_order as number,
    shot_label: row.shot_label as string,
    description: row.description as string,
    is_approved: Boolean(row.is_approved),
    prompt_id: (row.prompt_id as string) || undefined,
    accent_index: (row.accent_index as number) ?? 0,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getStoryboard(directionId: string): Promise<DirectionStoryboard[]> {
  if (isTauri) {
    const db = await getFramecraftDb();
    const rows = await db.select(
      "SELECT * FROM direction_storyboards WHERE direction_id = $1 ORDER BY sort_order ASC",
      [directionId]
    ) as Record<string, unknown>[];
    return rows.map(rowToShot);
  }
  return developmentStoryboards
    .filter((shot) => shot.direction_id === directionId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

/** Replaces any existing storyboard for this direction with the freshly generated shot list. */
export async function saveStoryboard(
  directionId: string,
  projectId: string,
  shots: GeneratedShot[]
): Promise<void> {
  await clearStoryboard(directionId);
  const timestamp = now();

  if (isTauri) {
    const db = await getFramecraftDb();
    for (let index = 0; index < shots.length; index += 1) {
      const shot = shots[index];
      await db.execute(
        `INSERT INTO direction_storyboards
         (id, direction_id, project_id, sort_order, shot_label, description, is_approved, prompt_id, accent_index, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,0,NULL,$7,$8,$9)`,
        [
          crypto.randomUUID(), directionId, projectId, index,
          shot.shot_label, shot.description, accentIndexForSortOrder(index),
          timestamp, timestamp,
        ]
      );
    }
  } else {
    shots.forEach((shot, index) => {
      developmentStoryboards.push({
        id: crypto.randomUUID(),
        direction_id: directionId,
        project_id: projectId,
        sort_order: index,
        shot_label: shot.shot_label,
        description: shot.description,
        is_approved: false,
        accent_index: accentIndexForSortOrder(index),
        created_at: timestamp,
        updated_at: timestamp,
      });
    });
  }
}

export async function toggleShotApproval(id: string): Promise<void> {
  const timestamp = now();
  if (isTauri) {
    const db = await getFramecraftDb();
    await db.execute(
      "UPDATE direction_storyboards SET is_approved = CASE WHEN is_approved = 1 THEN 0 ELSE 1 END, updated_at = $1 WHERE id = $2",
      [timestamp, id]
    );
  } else {
    const shot = developmentStoryboards.find((s) => s.id === id);
    if (shot) {
      shot.is_approved = !shot.is_approved;
      shot.updated_at = timestamp;
    }
  }
}

export async function clearStoryboard(directionId: string): Promise<void> {
  if (isTauri) {
    const db = await getFramecraftDb();
    await db.execute("DELETE FROM direction_storyboards WHERE direction_id = $1", [directionId]);
  } else {
    for (let i = developmentStoryboards.length - 1; i >= 0; i -= 1) {
      if (developmentStoryboards[i].direction_id === directionId) developmentStoryboards.splice(i, 1);
    }
  }
}

async function setShotPromptId(id: string, promptId: string): Promise<void> {
  const timestamp = now();
  if (isTauri) {
    const db = await getFramecraftDb();
    await db.execute(
      "UPDATE direction_storyboards SET prompt_id = $1, updated_at = $2 WHERE id = $3",
      [promptId, timestamp, id]
    );
  } else {
    const shot = developmentStoryboards.find((s) => s.id === id);
    if (shot) {
      shot.prompt_id = promptId;
      shot.updated_at = timestamp;
    }
  }
}

// ─── Apply to Project ───────────────────────────────────────

/**
 * Pure builder: maps an approved shot to a prompt variation. `prompt_text`
 * carries the direction's base prompt guidance; the shot description rides
 * as the `variation` builder-state field (mirrors CraftPrompt's "Create
 * Variation" delta, so the SEQUENCE VARIATION section is pre-filled on open).
 */
export function shotToVariationInput(
  shot: Pick<DirectionStoryboard, "shot_label" | "description">,
  direction: CreativeDirection,
  project: Project
): CreatePromptInput {
  const consistencyFactors = suggestConsistencyFactors({
    promptText: shot.description,
    projectDirection: direction.prompt_direction,
  });
  const consistencySuffix = buildConsistencySuffix(consistencyFactors);

  return {
    title: `${direction.title} — ${shot.shot_label}`,
    provider: (project.provider_targets?.[0] as CreatePromptInput["provider"]) ?? "midjourney",
    category: project.category,
    prompt_text: direction.prompt_direction,
    aspect_ratio: project.aspect_ratios?.[0],
    variant_label: shot.shot_label,
    builder_state: JSON.stringify({
      mode: "manual",
      variation: shot.description,
      consistencyFactors,
    }),
    notes: consistencySuffix || undefined,
  };
}

/** Converts one approved shot into a linked prompt variation and records the link back on the storyboard row. */
export async function applyStoryboardShot(
  shot: DirectionStoryboard,
  direction: CreativeDirection,
  project: Project
): Promise<string> {
  const input = shotToVariationInput(shot, direction, project);
  const promptId = await createPrompt(input);
  await addPromptToProject(project.id, promptId);
  await setShotPromptId(shot.id, promptId);
  return promptId;
}
