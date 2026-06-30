# Project Reset SQL Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Document and regression-test the escaped SQL interpolation required by the atomic native project-reset batch.

**Architecture:** Keep the native single-connection `executeBatch` transaction and the plugin-backed parameterized fallback. Extract only the batch builder into a testable internal function, with the escaping risk documented at its interpolation boundary.

**Tech Stack:** TypeScript 6, Vitest 4, Tauri SQLite adapters

---

### Task 1: Lock down batch escaping behavior

**Files:**
- Modify: `src/lib/projects.test.ts`
- Modify: `src/lib/projects.ts:462-523`

- [ ] **Step 1: Write the failing regression test**

Add `buildProjectResetBatchSql` to the imports and test a project ID containing an apostrophe plus SQL-shaped text:

```ts
it("keeps SQL-shaped project IDs inside escaped batch literals", () => {
  const projectId = "project'; DELETE FROM projects; --";
  const sql = buildProjectResetBatchSql(projectId, "2026-06-30T10:15:00.000Z");

  expect(sql.match(/'project''; DELETE FROM projects; --'/g)).toHaveLength(9);
  expect(sql).toContain("updated_at = '2026-06-30T10:15:00.000Z'");
  expect(sql.trim()).toMatch(/^BEGIN;[\s\S]*COMMIT;$/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/lib/projects.test.ts`

Expected: TypeScript/Vitest fails because `buildProjectResetBatchSql` is not exported.

- [ ] **Step 3: Extract and document the batch builder**

Move the quoted values and batch template from `executeProjectResetTransaction` into:

```ts
export function buildProjectResetBatchSql(projectId: string, updatedAt: string): string {
  // executeBatch has no bind-parameter API. Every interpolated value must pass
  // through sqlQuote; raw interpolation here would create an SQL-injection risk.
  const quotedProjectId = sqlQuote(projectId);
  const quotedUpdatedAt = sqlQuote(updatedAt);
  return `
    BEGIN;
    DELETE FROM project_prompts WHERE project_id = ${quotedProjectId};
    DELETE FROM project_results WHERE project_id = ${quotedProjectId};
    DELETE FROM project_references WHERE project_id = ${quotedProjectId};
    DELETE FROM project_deliverables WHERE project_id = ${quotedProjectId};
    DELETE FROM assistant_threads WHERE project_id = ${quotedProjectId};
    DELETE FROM comparison_sessions WHERE project_id = ${quotedProjectId};
    DELETE FROM creative_directions WHERE project_id = ${quotedProjectId};
    DELETE FROM export_presets WHERE project_id = ${quotedProjectId};
    UPDATE projects
       SET brief_text = NULL,
           production_goal = NULL,
           category = NULL,
           notes = NULL,
           tags = NULL,
           updated_at = ${quotedUpdatedAt}
     WHERE id = ${quotedProjectId};
    COMMIT;
  `;
}
```

Have `executeProjectResetTransaction` call the helper. Do not alter the parameterized fallback.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/lib/projects.test.ts`

Expected: all tests in `projects.test.ts` pass.

- [ ] **Step 5: Verify the phase**

Run:

```bash
npm test
npx tsc --noEmit
npm run build
git diff --check -- src/lib/projects.ts src/lib/projects.test.ts
```

Expected: every command exits 0, with no test failures or TypeScript/build errors.

- [ ] **Step 6: Preserve user-owned work**

Do not commit `src/lib/projects.ts`, because it contained unrelated uncommitted changes before this phase. Report the exact diff and verification evidence for user review.
