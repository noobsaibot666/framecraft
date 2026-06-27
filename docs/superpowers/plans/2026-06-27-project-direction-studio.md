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

- [x] Write failing CRUD and exclusive-selection tests.
- [x] Add the migration, types, native CRUD, and development fallback.
- [x] Run focused persistence tests.

### Task 2: Direction generation and project mapping

**Files:**
- Create: `src/lib/creativeDirectionGeneration.ts`
- Create: `src/lib/creativeDirectionGeneration.test.ts`

- [x] Write failing tests for valid/invalid JSON and project-field assembly.
- [x] Implement strict response parsing and deterministic project-field assembly.
- [x] Add Anthropic/OpenAI generation using existing API helpers.
- [x] Run focused generation tests.

### Task 3: Embedded Direction Studio

**Files:**
- Create: `src/components/projects/DirectionStudio.tsx`
- Modify: `src/pages/ProjectWorkspace.tsx`

- [x] Add project-context generation controls and copyable errors.
- [x] Add editable responsive direction items and manual creation.
- [x] Add select/apply/delete actions.
- [x] Apply selected direction into Project Workspace state and persisted project fields.
- [x] Verify TypeScript compilation.

### Task 4: Verification and release

**Files:**
- Modify: `sprint_2/docs/02_sprint_2_completion_checklist.md` outside the app repository.

- [x] Run all frontend tests.
- [x] Run TypeScript compilation.
- [x] Run Rust tests.
- [x] Run the production build.
- [x] Review migration safety and project update behavior.
- [x] Verify desktop and narrow-window layouts in Playwright.
- [x] Update package initialization through migrations 15-16, validate the release schema, and safely upgrade complete migration-14 libraries.
- [x] Update the Sprint 2 checklist.
- [x] Commit, merge, push, and clean the feature worktree.
