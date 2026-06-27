# Project Direction Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add project-scoped creative direction alternatives that can be generated, edited, selected, and applied directly to Project Craft context.

**Architecture:** Store alternatives in a new SQLite table accessed through a focused CRUD module. Keep AI parsing and project-field assembly in independently tested helpers, and embed a self-contained Direction Studio component in Project Workspace.

**Tech Stack:** React, TypeScript, Vitest, Tauri, SQLite, existing Anthropic/OpenAI client layer.

---

### Task 1: Direction model and persistence

**Files:**
- Create: `src-tauri/migrations/016_creative_directions.sql`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/types/index.ts`
- Create: `src/lib/creativeDirections.ts`
- Create: `src/lib/creativeDirections.test.ts`

- [ ] Write failing CRUD and exclusive-selection tests.
- [ ] Add the migration, types, native CRUD, and development fallback.
- [ ] Run focused persistence tests.

### Task 2: Direction generation and project mapping

**Files:**
- Create: `src/lib/creativeDirectionGeneration.ts`
- Create: `src/lib/creativeDirectionGeneration.test.ts`

- [ ] Write failing tests for valid/invalid JSON and project-field assembly.
- [ ] Implement strict response parsing and deterministic project-field assembly.
- [ ] Add Anthropic/OpenAI generation using existing API helpers.
- [ ] Run focused generation tests.

### Task 3: Embedded Direction Studio

**Files:**
- Create: `src/components/projects/DirectionStudio.tsx`
- Modify: `src/pages/ProjectWorkspace.tsx`

- [ ] Add project-context generation controls and copyable errors.
- [ ] Add editable responsive direction items and manual creation.
- [ ] Add select/apply/delete actions.
- [ ] Apply selected direction into Project Workspace state and persisted project fields.
- [ ] Verify TypeScript compilation.

### Task 4: Verification and release

**Files:**
- Modify: `sprint_2/docs/02_sprint_2_completion_checklist.md` outside the app repository.

- [ ] Run all frontend tests.
- [ ] Run TypeScript compilation.
- [ ] Run Rust tests.
- [ ] Run the production build.
- [ ] Review migration safety and project update behavior.
- [ ] Update the Sprint 2 checklist.
- [ ] Commit, merge, push, and clean the feature worktree.

