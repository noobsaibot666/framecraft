# Craft Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Craft page feel responsive on open, during provider switches, and while typing by narrowing data access and deferring non-critical work.

**Architecture:** Keep the core editor path synchronous and lightweight, then move expensive advisory lookups behind narrower queries, caching, and deferred effects. Prefer focused helper changes over a broad page refactor so the Craft workflow improves without destabilizing unrelated screens.

**Tech Stack:** React, TypeScript, Zustand, Tauri SQLite, Vitest, Vite

---

### Task 1: Narrow suggestion data access

**Files:**
- Modify: `src/lib/craftRecipe.ts`
- Modify: `src/lib/db.ts`
- Test: `src/lib/craftRecipe.test.ts`

- [ ] Write a failing test proving recipe suggestions do not require loading every prompt.
- [ ] Run the focused test and confirm it fails for the current implementation.
- [ ] Add a recipe-focused query/helper and update suggestion loading to use it.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Cache Craft token loading

**Files:**
- Modify: `src/components/ui/TokenCloud.tsx`
- Test: `src/components/ui/TokenCloud` behavior through Vitest component tests if present, otherwise helper-level tests in a nearby `src/lib` test file.

- [ ] Write a failing test proving provider switches reuse previously fetched category token data instead of re-querying the database every time.
- [ ] Run the focused test and confirm it fails for the current implementation.
- [ ] Cache raw category token results and apply provider filtering in memory.
- [ ] Re-run the focused test and confirm it passes.

### Task 3: Defer non-critical Craft work

**Files:**
- Modify: `src/pages/CraftPrompt.tsx`
- Modify: `src/lib/memoryEngine.ts` if helper extraction is needed

- [ ] Reduce eager effect work on initial open so the editor renders before advisory panels finish loading.
- [ ] Defer duplicate detection and auto-analysis so typing stays responsive.
- [ ] Keep provider switches scoped to provider-specific UI and data where possible.

### Task 4: Verify the Craft path

**Files:**
- Verify only

- [ ] Run targeted tests for the changed helpers and Craft behavior.
- [ ] Run a production build to ensure the page still compiles in the desktop app.
- [ ] Summarize residual risks if any deferred panel still depends on full-library scans.
