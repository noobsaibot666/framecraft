# V1 Code Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the V1 code review findings in safe phases, starting with data correctness, then V1 library/rule completeness, then regression coverage.

**Architecture:** Keep changes local to the existing React/Tauri/SQLite architecture. Add small testable pure helpers around prompt/result aggregation and library filtering so behavior can be verified without a running Tauri shell. Store result image originals in existing result data for V1 durability before adding any heavier asset pipeline.

**Tech Stack:** React 19, TypeScript, Zustand, Tauri 2, SQLite via `tauri-plugin-sql`, Vitest for focused unit tests.

---

### Task 1: Phase 1 Data Correctness

**Files:**
- Modify: `package.json`
- Modify: `src/lib/db.ts`
- Modify: `src/lib/imageUtils.ts`
- Modify: `src/pages/ResultReview.tsx`
- Modify: `src/pages/PromptDetail.tsx`
- Modify: `src-tauri/migrations/007_token_patterns.sql`
- Create: `src/lib/resultMemory.ts`
- Create: `src/lib/resultMemory.test.ts`

- [ ] Add Vitest test script and dependency.
- [ ] Write failing tests for prompt summary recomputation and prompt update metadata preservation.
- [ ] Add result aggregation helper that computes prompt rating, winner, failed, and AI-risk from remaining results.
- [ ] Persist original uploaded image data so saved results survive restart.
- [ ] Update prompt metadata writes to include `style_ref`, `parameters`, `character_ref`, and `image_ref`.
- [ ] Update result save/delete flows to recompute parent prompt summaries.
- [ ] Make migration 007 repair the existing `token_patterns` table shape.
- [ ] Run `npm test`, `npm run build`, and `cargo check`.
- [ ] Commit Phase 1.

### Task 2: Phase 2 V1 Library And Avoidance Completeness

**Files:**
- Modify: `src/stores/usePromptStore.ts`
- Modify: `src/pages/PromptLibrary.tsx`
- Modify: `src/lib/avoidanceEngine.ts`
- Modify: `src/lib/db.ts`
- Create or update tests for filtering, sorting, and custom rule matching.

- [ ] Add failing tests for rating/AI-risk/failed filters and most-used/AI-risk sorting.
- [ ] Add missing UI controls for rating, AI-risk, failed, most-used sort, and AI-risk sort.
- [ ] Add custom avoidance trigger persistence or deterministic text-based trigger matching.
- [ ] Run tests/build/check.
- [ ] Commit Phase 2.

### Task 3: Phase 3 Review Verification

**Files:**
- Modify: `V1/codereview/v1_code_review_2026-06-24.md` if needed from parent directory.
- Create: `V1/codereview/v1_code_review_fix_report_2026-06-24.md`.

- [ ] Re-run all verification commands.
- [ ] Write a fix report mapping each original finding to fixed, deferred, or intentionally scoped behavior.
- [ ] Commit docs/report if the parent directory is under version control; otherwise leave the file in `V1/codereview`.
