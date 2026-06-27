# Visual Comparison Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Compare into a typed, decision-oriented workflow that stores clear visual comparison outcomes as project intelligence.

**Architecture:** Add compatible SQLite metadata columns for session type, item role, and outcome text. Keep comparison semantics and deterministic outcome generation in a pure helper, then connect the existing Compare page and CRUD layer to those fields without changing result synchronization.

**Tech Stack:** React, TypeScript, Vitest, Tauri, SQLite.

---

### Task 1: Comparison semantics

**Files:**
- Create: `src/lib/comparisonWorkflow.ts`
- Create: `src/lib/comparisonWorkflow.test.ts`

- [ ] Write failing tests for the four comparison types, slot-role assignment, and outcome generation.
- [ ] Run `npm test -- src/lib/comparisonWorkflow.test.ts` and confirm failure because the helper is missing.
- [ ] Implement typed comparison definitions, role assignment, and deterministic outcome generation.
- [ ] Run the focused test and confirm it passes.

### Task 2: Durable comparison metadata

**Files:**
- Create: `src-tauri/migrations/015_comparison_workflow.sql`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/types/index.ts`
- Modify: `src/lib/comparisons.ts`
- Modify: `src/lib/comparisons.test.ts`

- [ ] Write failing CRUD tests proving type, role, and outcome survive session/item reads.
- [ ] Run `npm test -- src/lib/comparisons.test.ts` and confirm the new assertions fail.
- [ ] Add the migration, types, row mapping, and CRUD fields with legacy-safe defaults.
- [ ] Run focused comparison tests and confirm they pass.

### Task 3: Typed Compare workflow UI

**Files:**
- Modify: `src/pages/ComparisonLab.tsx`

- [ ] Add comparison-type selection to session creation.
- [ ] Show the active type and its purpose in the comparison workspace.
- [ ] Assign and display source roles and source metadata per slot.
- [ ] Generate and persist the outcome when decisions are applied.
- [ ] Display the saved outcome in the active workspace and session gallery.

### Task 4: Verification and documentation

**Files:**
- Modify: `sprint_2/docs/02_sprint_2_completion_checklist.md` outside the app repository.

- [ ] Run `npm test` and confirm all frontend tests pass.
- [ ] Run `npx tsc --noEmit` and confirm TypeScript passes.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml` and confirm native tests pass.
- [ ] Run `npm run build` and confirm the production build passes.
- [ ] Run `git diff --check` and inspect `git status --short`.
- [ ] Record the completed Phase 52 follow-up and verification counts in the Sprint 2 checklist.
- [ ] Commit and push the verified implementation.

