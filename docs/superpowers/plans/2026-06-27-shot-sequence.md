# Shot Sequence Implementation Plan — Phase 55

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an ordered shot sequence to projects. Each shot has a type, label, optional prompt and result references, and notes. Users drag-to-reorder shots to define their production narrative.

**Architecture:** New migration 017, focused CRUD module, standalone ProjectSequence page with @dnd-kit reorder, and a compact summary in ProjectWorkspace.

**Tech Stack:** React, TypeScript, Vitest, Tauri, SQLite, @dnd-kit.

---

### Task 1: Migration and Rust registration

**Files:**
- Create: `src-tauri/migrations/017_shot_sequence.sql`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/library_package.rs`

- [ ] Write `017_shot_sequence.sql` creating the `shot_sequence` table with index.
- [ ] Register migration 017 in `lib.rs` migrations vector.
- [ ] Add `"shot_sequence"` to `REQUIRED_RELEASE_TABLES` in `library_package.rs` (size 27 → 28).
- [ ] Add migration 017 to `migration_sql()` array (size 16 → 17).
- [ ] Add `execute_batch(017 sql)` to `upgrade_previous_release_schema()`.
- [ ] Update test assertions in `created_package_includes_recent_workflow_schema` and `repair_upgrades_previous_release_schema` to check for `shot_sequence`.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml`.

### Task 2: Types and data layer

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/lib/shotSequence.ts`
- Create: `src/lib/shotSequence.test.ts`

- [ ] Add `ShotType`, `Shot`, `CreateShotInput`, `UpdateShotInput` to `src/types/index.ts`.
- [ ] Implement `shotSequence.ts` with dev and native paths: `getProjectShots`, `createShot`, `updateShot`, `deleteShot`, `reorderShots`.
- [ ] Write dev-mode tests for CRUD and reorder in `shotSequence.test.ts`.
- [ ] Run `npm test -- src/lib/shotSequence.test.ts --run`.

### Task 3: ProjectSequence page

**Files:**
- Create: `src/pages/ProjectSequence.tsx`
- Modify: `src/App.tsx`

- [ ] Build `ProjectSequence.tsx` with DnD vertical reorder, Add Shot inline form, shot cards (type badge, label, thumbnail, prompt title, notes, connect/remove actions).
- [ ] Add connect prompt picker (searchable project prompts).
- [ ] Add connect result picker (project result thumbnails).
- [ ] Add back-to-project breadcrumb.
- [ ] Register route `/projects/:id/sequence` in `App.tsx`.
- [ ] Run `npx tsc --noEmit`.

### Task 4: Workspace integration

**Files:**
- Modify: `src/pages/ProjectWorkspace.tsx`

- [ ] Add "Sequence" summary row in the Craft section showing shot count.
- [ ] Link to `/projects/:id/sequence`.
- [ ] Run `npx tsc --noEmit`.

### Task 5: Verification and release

**Files:**
- Modify: `sprint_2/docs/02_sprint_2_completion_checklist.md` (outside the app repo)

- [ ] Run `npm test`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml`.
- [ ] Run `npm run build`.
- [ ] Update Sprint 2 checklist with Phase 55 section.
- [ ] Commit.
