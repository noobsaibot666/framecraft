# V2 Video Frames Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the non-infrastructure V2 gaps by finishing Video Frames batch import, frame export, and reference-linking behavior while documenting that Infrastructure First is intentionally skipped for now.

**Architecture:** Keep frame extraction in the browser Canvas API. Use small pure helpers for tested frame filename/reference/import behavior, then wire them into `VideoFrames.tsx`. Use Tauri dialog/fs plugins only for explicit save-to-disk actions; prompt imports store frame data URLs in `image_ref` so references survive without a filesystem save.

**Tech Stack:** React 19, TypeScript, Zustand prompt store, Tauri 2 dialog/fs plugins, Vitest.

---

### Task 1: Document Infrastructure Skip

**Files:**
- Modify: `/Users/alan/_localDEV/_creative/_aicd-creator/V2/docs/05_v2_completion_checklist.md`

- [ ] Mark Infrastructure First as intentionally skipped while `claude-fable-5` is unavailable in Europe.

### Task 2: Add Frame Helper Tests And Helpers

**Files:**
- Create: `src/lib/videoFrames.ts`
- Create: `src/lib/videoFrames.test.ts`

- [ ] Write failing tests for frame filename generation, frame prompt import payload, and importable result filtering.
- [ ] Implement helpers.
- [ ] Run focused tests.

### Task 3: Wire Video Frames UI

**Files:**
- Modify: `src/pages/VideoFrames.tsx`
- Modify: `src/pages/PromptDetail.tsx`

- [ ] Add Import All Analyzed button for unsaved successful results.
- [ ] Add batch cost warning before analyzing more than 4 selected frames.
- [ ] Add Save Frame button per extracted/analyzed frame.
- [ ] Store frame data URL in imported prompt `image_ref`.
- [ ] Show linked reference image in Prompt Detail when present.

### Task 4: Add Tauri Save Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`

- [ ] Add `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs`.
- [ ] Add Rust `tauri-plugin-dialog` and `tauri-plugin-fs`.
- [ ] Register plugins and permissions.

### Task 5: Verify

**Files:**
- Modify: `/Users/alan/_localDEV/_creative/_aicd-creator/V2/docs/05_v2_completion_checklist.md`

- [ ] Update Phase 11 checklist items that are completed.
- [ ] Run `npm test`, `npm run build`, and `cargo check`.
- [ ] Commit the implementation.
