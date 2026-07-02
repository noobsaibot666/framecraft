// Direction Studio visual references (V2 feedback §4) — up to 5 images per
// project that guide creative direction generation. Stored as regular
// project-linked references tagged `visual-reference`, so they automatically
// surface on the Prompt Craft inspiration board and persist across reloads.

import { getFramecraftDb } from "./dbConnection";
import { deleteReference, updateReference } from "./references";
import { addReferenceToProject, removeReferenceFromProject } from "./projects";
import { importReferenceImage } from "./sharedImport";
import { fileToDataUrl } from "./queueImport";
import { validateImageFile } from "./imageUtils";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const VISUAL_REFERENCE_TAG = "visual-reference";
export const MAX_VISUAL_REFERENCES = 5;
export const MAX_VISUAL_REFERENCE_NOTE = 100;

export interface VisualReference {
  id: string;
  title: string;
  note: string;
  thumbnail_data?: string;
}

export async function getVisualReferences(projectId: string): Promise<VisualReference[]> {
  if (!isTauri) return [];
  const db = await getFramecraftDb();
  const rows = (await db.select(
    `SELECT r.id, r.title, r.notes, r.thumbnail_data
     FROM "references" r
     JOIN project_references pr ON r.id = pr.reference_id
     WHERE pr.project_id = $1 AND r.tags LIKE $2
     ORDER BY r.created_at ASC`,
    [projectId, `%${VISUAL_REFERENCE_TAG}%`]
  )) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    note: (r.notes as string | null) ?? "",
    thumbnail_data: (r.thumbnail_data as string | null) ?? undefined,
  }));
}

/** Upload one image as a project visual reference. Caller enforces the 5-image cap for UX; this re-checks it. */
export async function addVisualReference(projectId: string, file: File): Promise<string> {
  const existing = await getVisualReferences(projectId);
  if (existing.length >= MAX_VISUAL_REFERENCES) {
    throw new Error(`Maximum ${MAX_VISUAL_REFERENCES} visual references per project.`);
  }
  await validateImageFile(file);
  const dataUrl = await fileToDataUrl(file);
  const referenceId = crypto.randomUUID().replace(/-/g, "");
  const title = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim() || "Visual reference";
  const result = await importReferenceImage({
    referenceId,
    dataUrl,
    originalName: file.name,
    reference: {
      title,
      kind: "mood",
      tags: [VISUAL_REFERENCE_TAG],
    },
  });
  await addReferenceToProject(projectId, result.id);
  return result.id;
}

export async function updateVisualReferenceNote(referenceId: string, note: string): Promise<void> {
  await updateReference(referenceId, { notes: note.slice(0, MAX_VISUAL_REFERENCE_NOTE) });
}

export async function removeVisualReference(projectId: string, referenceId: string): Promise<void> {
  await removeReferenceFromProject(projectId, referenceId);
  await deleteReference(referenceId);
}

/**
 * Text block describing the visual references for the Creative Director
 * prompt. Pure — the note defines what each image is a reference for.
 */
export function buildVisualReferenceContext(refs: Pick<VisualReference, "title" | "note">[]): string {
  const lines = refs
    .map((ref) => {
      const note = ref.note.trim();
      return note ? `- ${ref.title}: ${note}` : `- ${ref.title}`;
    })
    .filter(Boolean);
  if (!lines.length) return "";
  return [
    "User-provided visual references (each note defines what the image is a reference for — respect these roles, be creative around them):",
    ...lines,
  ].join("\n");
}
