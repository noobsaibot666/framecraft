# Comparison Intelligence Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Feed saved comparison decisions into project intelligence and correct result score-scale wording.

**Architecture:** Summarize comparison sessions through a pure helper, attach that summary to `ProjectContextPack`, and consume it in Assistant suggestions, AI context, and the visible context panel. Reuse existing comparison CRUD without schema changes.

**Tech Stack:** React, TypeScript, Vitest, Tauri, SQLite.

---

### Task 1: Comparison intelligence summary

**Files:**
- Create: `src/lib/comparisonIntelligence.ts`
- Create: `src/lib/comparisonIntelligence.test.ts`

- [x] Write failing tests for total, decided, pending, and bounded recent outcomes.
- [x] Run the focused test and confirm failure because the helper is missing.
- [x] Implement the pure summary helper.
- [x] Run the focused test and confirm it passes.

### Task 2: Project context integration

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/assistant.ts`
- Modify: `src/lib/assistant.test.ts`

- [x] Write failing tests for unresolved-comparison guidance and `/5` result score wording.
- [x] Add comparison sessions to `buildContextPack` and serialize recent outcomes into AI context.
- [x] Add deterministic guidance for pending comparison sessions.
- [x] Correct prompt and result score-scale wording.
- [x] Run focused Assistant tests.

### Task 3: Project Assistant visibility

**Files:**
- Modify: `src/pages/ProjectAssistant.tsx`

- [x] Display comparison decided/pending counts in the context panel.
- [x] Display prompt and result averages on the five-point scale.
- [x] Verify TypeScript compilation.

### Task 4: Verification and release

**Files:**
- Modify: `sprint_2/docs/02_sprint_2_completion_checklist.md` outside the app repository.

- [x] Run all frontend tests.
- [x] Run TypeScript compilation.
- [x] Run Rust tests.
- [x] Run the production build.
- [x] Run `git diff --check` and review the implementation.
- [x] Update the Sprint 2 checklist.
- [x] Commit, merge, push, and clean the feature worktree.
