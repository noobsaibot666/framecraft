import { describe, expect, it } from "vitest";
import {
  createShot,
  deleteShot,
  getProjectShots,
  reorderShots,
  updateShot,
} from "./shotSequence";

describe("shot sequence development store", () => {
  it("creates and returns project-scoped shots", async () => {
    const id = await createShot({
      project_id: "shot-project-a",
      sort_order: 0,
      shot_type: "establishing",
      label: "Wide city skyline",
    });

    const shots = await getProjectShots("shot-project-a");
    expect(shots.some((shot) => shot.id === id)).toBe(true);

    const shot = shots.find((shot) => shot.id === id)!;
    expect(shot.shot_type).toBe("establishing");
    expect(shot.label).toBe("Wide city skyline");
    expect(shot.prompt_id).toBeUndefined();
    expect(shot.result_id).toBeUndefined();

    const other = await getProjectShots("shot-project-b");
    expect(other.some((shot) => shot.id === id)).toBe(false);
  });

  it("returns shots ordered by sort_order", async () => {
    const projectId = "shot-order";
    const first = await createShot({ project_id: projectId, sort_order: 0, shot_type: "hero", label: "Hero" });
    const second = await createShot({ project_id: projectId, sort_order: 1, shot_type: "detail", label: "Detail" });
    const third = await createShot({ project_id: projectId, sort_order: 2, shot_type: "cutaway", label: "Cutaway" });

    const shots = await getProjectShots(projectId);
    const ids = shots.filter((s) => [first, second, third].includes(s.id)).map((s) => s.id);
    expect(ids).toEqual([first, second, third]);
  });

  it("updates shot fields including prompt and result links", async () => {
    const id = await createShot({
      project_id: "shot-update",
      sort_order: 0,
      shot_type: "wide",
      label: "Original",
    });

    await updateShot(id, {
      shot_type: "medium",
      label: "Updated",
      prompt_id: "prompt-abc",
      result_id: "result-xyz",
      notes: "This is a note",
    });

    const shot = (await getProjectShots("shot-update")).find((s) => s.id === id)!;
    expect(shot.shot_type).toBe("medium");
    expect(shot.label).toBe("Updated");
    expect(shot.prompt_id).toBe("prompt-abc");
    expect(shot.result_id).toBe("result-xyz");
    expect(shot.notes).toBe("This is a note");
  });

  it("clears optional fields when set to null", async () => {
    const id = await createShot({
      project_id: "shot-clear",
      sort_order: 0,
      shot_type: "product",
      label: "Product shot",
      prompt_id: "p1",
      result_id: "r1",
      notes: "Some note",
    });

    await updateShot(id, { prompt_id: null, result_id: null, notes: null });

    const shot = (await getProjectShots("shot-clear")).find((s) => s.id === id)!;
    expect(shot.prompt_id).toBeUndefined();
    expect(shot.result_id).toBeUndefined();
    expect(shot.notes).toBeUndefined();
  });

  it("reorders shots by reassigning sort_order", async () => {
    const projectId = "shot-reorder";
    const a = await createShot({ project_id: projectId, sort_order: 0, shot_type: "hero", label: "A" });
    const b = await createShot({ project_id: projectId, sort_order: 1, shot_type: "wide", label: "B" });
    const c = await createShot({ project_id: projectId, sort_order: 2, shot_type: "detail", label: "C" });

    await reorderShots(projectId, [c, a, b]);

    const shots = await getProjectShots(projectId);
    const reordered = shots.filter((s) => [a, b, c].includes(s.id));
    expect(reordered[0].id).toBe(c);
    expect(reordered[1].id).toBe(a);
    expect(reordered[2].id).toBe(b);
  });

  it("deletes a shot", async () => {
    const id = await createShot({
      project_id: "shot-delete",
      sort_order: 0,
      shot_type: "close_up",
      label: "Delete me",
    });

    await deleteShot(id);
    const shots = await getProjectShots("shot-delete");
    expect(shots.some((s) => s.id === id)).toBe(false);
  });
});
