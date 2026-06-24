import { describe, expect, it } from "vitest";
import {
  createReference,
  getReferences,
  getReferenceById,
  searchReferences,
  updateReference,
  deleteReference,
} from "./references";
import type { ReferenceKind } from "@/types";

// isTauri is false in Vitest — all calls use the in-memory _devStore

function ref(overrides: { title?: string; kind?: ReferenceKind; category?: string; rating?: number; tags?: string[] } = {}) {
  return {
    title: overrides.title ?? "Test ref",
    kind: overrides.kind ?? ("moodboard" as ReferenceKind),
    category: overrides.category,
    rating: overrides.rating ?? 0,
    tags: overrides.tags,
  };
}

describe("references in-memory CRUD", () => {
  it("createReference returns a non-empty id", async () => {
    const id = await createReference(ref());
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  it("getReferenceById returns created reference", async () => {
    const id = await createReference(ref({ title: "Unique Moodboard A" }));
    const found = await getReferenceById(id);
    expect(found).not.toBeNull();
    expect(found!.title).toBe("Unique Moodboard A");
    expect(found!.id).toBe(id);
  });

  it("getReferenceById returns null for unknown id", async () => {
    const found = await getReferenceById("nonexistent-xyz-999");
    expect(found).toBeNull();
  });

  it("getReferences returns all stored references", async () => {
    const beforeCount = (await getReferences()).length;
    await createReference(ref({ title: "RefList A" }));
    await createReference(ref({ title: "RefList B" }));
    const afterCount = (await getReferences()).length;
    expect(afterCount).toBe(beforeCount + 2);
  });

  it("getReferences filters by kind", async () => {
    await createReference(ref({ title: "Frame ref", kind: "frame" }));
    await createReference(ref({ title: "Style ref", kind: "style" }));
    const frames = await getReferences({ kind: "frame" });
    expect(frames.every((r) => r.kind === "frame")).toBe(true);
    const styles = await getReferences({ kind: "style" });
    expect(styles.every((r) => r.kind === "style")).toBe(true);
  });

  it("getReferences filters by minRating", async () => {
    await createReference(ref({ title: "Low rated", rating: 1 }));
    await createReference(ref({ title: "High rated", rating: 4 }));
    const highOnly = await getReferences({ minRating: 4 });
    expect(highOnly.every((r) => r.rating >= 4)).toBe(true);
  });

  it("updateReference changes title", async () => {
    const id = await createReference(ref({ title: "Before Update" }));
    await updateReference(id, { title: "After Update" });
    const found = await getReferenceById(id);
    expect(found!.title).toBe("After Update");
  });

  it("updateReference changes rating", async () => {
    const id = await createReference(ref({ title: "Ratable ref", rating: 0 }));
    await updateReference(id, { rating: 5 });
    const found = await getReferenceById(id);
    expect(found!.rating).toBe(5);
  });

  it("deleteReference removes the reference", async () => {
    const id = await createReference(ref({ title: "Will Be Deleted" }));
    expect(await getReferenceById(id)).not.toBeNull();
    await deleteReference(id);
    expect(await getReferenceById(id)).toBeNull();
  });

  it("searchReferences matches by title substring", async () => {
    await createReference(ref({ title: "XZQ_search_target moody" }));
    const results = await searchReferences("XZQ_search_target");
    expect(results.some((r) => r.title.includes("XZQ_search_target"))).toBe(true);
  });

  it("searchReferences with empty query returns all", async () => {
    const all = await getReferences();
    const searched = await searchReferences("");
    expect(searched.length).toBe(all.length);
  });
});
