import { describe, expect, it } from "vitest";
import { buildTree, flattenTree, diffPromptText, diffMetadata, type VersionNode } from "./lineage";
import type { Prompt } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────

function makeNode(id: string, parentId?: string, version = 1): VersionNode {
  return {
    id,
    title: `Prompt ${id}`,
    provider: "midjourney",
    prompt_text: "test prompt",
    rating: 0,
    ai_look_risk: 0,
    reuse_potential: 0,
    is_recipe: false,
    is_winner: false,
    is_failed: false,
    version,
    parent_id: parentId,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    result_count: 0,
    children: [],
  };
}

function makePrompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: "p1",
    title: "Base",
    provider: "midjourney",
    prompt_text: "hello world",
    rating: 0,
    ai_look_risk: 0,
    reuse_potential: 0,
    is_recipe: false,
    is_winner: false,
    is_failed: false,
    version: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ─── buildTree ────────────────────────────────────────────────

describe("buildTree", () => {
  it("returns null for empty input", () => {
    expect(buildTree([])).toBeNull();
  });

  it("returns single node as root", () => {
    const root = buildTree([makeNode("a")]);
    expect(root?.id).toBe("a");
    expect(root?.children).toHaveLength(0);
  });

  it("links child to parent", () => {
    const root = buildTree([makeNode("a"), makeNode("b", "a")]);
    expect(root?.id).toBe("a");
    expect(root?.children).toHaveLength(1);
    expect(root?.children[0].id).toBe("b");
  });

  it("builds multi-level tree", () => {
    const nodes = [
      makeNode("a"),
      makeNode("b", "a"),
      makeNode("c", "b"),
      makeNode("d", "b"),
    ];
    const root = buildTree(nodes);
    expect(root?.id).toBe("a");
    expect(root?.children[0].id).toBe("b");
    expect(root?.children[0].children).toHaveLength(2);
  });

  it("handles branching — two children from same parent", () => {
    const root = buildTree([makeNode("a"), makeNode("b", "a"), makeNode("c", "a")]);
    expect(root?.children).toHaveLength(2);
    const childIds = root!.children.map((c) => c.id);
    expect(childIds).toContain("b");
    expect(childIds).toContain("c");
  });
});

// ─── flattenTree ──────────────────────────────────────────────

describe("flattenTree", () => {
  it("returns empty array for null", () => {
    expect(flattenTree(null)).toEqual([]);
  });

  it("returns single node", () => {
    const list = flattenTree(makeNode("a"));
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("a");
  });

  it("returns pre-order traversal", () => {
    const nodes = [makeNode("a"), makeNode("b", "a"), makeNode("c", "b")];
    const tree = buildTree(nodes)!;
    const flat = flattenTree(tree);
    expect(flat.map((n) => n.id)).toEqual(["a", "b", "c"]);
  });

  it("visits branches depth-first", () => {
    const nodes = [makeNode("a"), makeNode("b", "a"), makeNode("c", "a"), makeNode("d", "b")];
    const tree = buildTree(nodes)!;
    const flat = flattenTree(tree);
    // pre-order: a, then b+its children, then c
    expect(flat[0].id).toBe("a");
    const bIdx = flat.findIndex((n) => n.id === "b");
    const cIdx = flat.findIndex((n) => n.id === "c");
    const dIdx = flat.findIndex((n) => n.id === "d");
    expect(dIdx).toBeLessThan(cIdx); // d (child of b) before c (sibling of b)
    expect(bIdx).toBeLessThan(dIdx);
  });
});

// ─── diffPromptText ───────────────────────────────────────────

describe("diffPromptText", () => {
  it("returns single equal segment for identical strings", () => {
    const segs = diffPromptText("hello world", "hello world");
    expect(segs).toHaveLength(1);
    expect(segs[0].type).toBe("equal");
    expect(segs[0].text).toBe("hello world");
  });

  it("detects an added word", () => {
    const segs = diffPromptText("hello world", "hello beautiful world");
    const added = segs.filter((s) => s.type === "added");
    expect(added.some((s) => s.text.includes("beautiful"))).toBe(true);
    const removed = segs.filter((s) => s.type === "removed");
    expect(removed).toHaveLength(0);
  });

  it("detects a removed word", () => {
    const segs = diffPromptText("hello beautiful world", "hello world");
    const removed = segs.filter((s) => s.type === "removed");
    expect(removed.some((s) => s.text.includes("beautiful"))).toBe(true);
    const added = segs.filter((s) => s.type === "added");
    expect(added).toHaveLength(0);
  });

  it("detects substitution (removed + added)", () => {
    const segs = diffPromptText("cinematic lighting", "dramatic lighting");
    const removed = segs.filter((s) => s.type === "removed");
    const added = segs.filter((s) => s.type === "added");
    expect(removed.some((s) => s.text.includes("cinematic"))).toBe(true);
    expect(added.some((s) => s.text.includes("dramatic"))).toBe(true);
  });

  it("handles empty inputs — no changed segments", () => {
    const segs = diffPromptText("", "");
    expect(segs.every((s) => s.type === "equal")).toBe(true);
  });

  it("handles one empty side — b-text reconstructs from non-removed segments", () => {
    const b = "hello world";
    const segs = diffPromptText("", b);
    const rebuilt = segs.filter((s) => s.type !== "removed").map((s) => s.text).join("");
    expect(rebuilt).toBe(b);
  });

  it("reconstructed text matches original from equal+added segments", () => {
    const a = "cinematic shot golden hour";
    const b = "cinematic shot at golden hour dramatic";
    const segs = diffPromptText(a, b);
    const bRebuilt = segs
      .filter((s) => s.type !== "removed")
      .map((s) => s.text)
      .join("");
    expect(bRebuilt).toBe(b);
  });
});

// ─── diffMetadata ─────────────────────────────────────────────

describe("diffMetadata", () => {
  it("returns empty array for identical prompts", () => {
    const p = makePrompt({ provider: "midjourney", category: "advertising" });
    expect(diffMetadata(p, p)).toEqual([]);
  });

  it("detects provider change", () => {
    const a = makePrompt({ provider: "midjourney" });
    const b = makePrompt({ provider: "dalle" });
    expect(diffMetadata(a, b)).toContain("provider");
  });

  it("detects category change", () => {
    const a = makePrompt({ category: "advertising" });
    const b = makePrompt({ category: "editorial" });
    expect(diffMetadata(a, b)).toContain("category");
  });

  it("treats undefined and empty string as equal", () => {
    const a = makePrompt({ camera: undefined });
    const b = makePrompt({ camera: "" });
    expect(diffMetadata(a, b)).not.toContain("camera");
  });

  it("detects multiple changes", () => {
    const a = makePrompt({ provider: "midjourney", category: "advertising", lens: "50mm" });
    const b = makePrompt({ provider: "dalle", category: "editorial", lens: "85mm" });
    const changed = diffMetadata(a, b);
    expect(changed).toContain("provider");
    expect(changed).toContain("category");
    expect(changed).toContain("lens");
  });

  it("ignores non-metadata fields like title and rating", () => {
    const a = makePrompt({ title: "Old Title", rating: 1 });
    const b = makePrompt({ title: "New Title", rating: 5 });
    const changed = diffMetadata(a, b);
    expect(changed).not.toContain("title");
    expect(changed).not.toContain("rating");
  });
});
