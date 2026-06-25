# Shared Library Ingest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first V9 shared-library ingest slice for reference and result image jobs.

**Architecture:** Add inbox/staging/sync paths to library packages. Publish append-only JSON jobs from any machine, then process them through one controlled merge path that writes media and SQLite rows. Preserve existing direct app behavior outside shared ingest.

**Tech Stack:** React 19, TypeScript, Tauri 2, SQLite plugin, Rust package validation.

---

### Task 1: Library Paths And Package Directories

**Files:**
- Modify: `src/lib/libraryConfig.ts`
- Modify: `src/lib/libraryPackage.ts`
- Modify: `src-tauri/src/library_package.rs`
- Test: `src/lib/libraryConfig.test.ts`
- Test: `src/lib/libraryPackage.test.ts`
- Test: Rust `library_package::tests`

- [ ] Add `inboxDir`, `stagingDir`, `syncDir`, `appliedDir`, and `failedDir` to `LibraryPaths`.
- [ ] Ensure TypeScript package creation creates those directories.
- [ ] Ensure Rust package creation and repair create those directories.
- [ ] Extend tests to assert the new paths/directories.

### Task 2: Shared Job Model

**Files:**
- Create: `src/lib/sharedIngest.ts`
- Test: `src/lib/sharedIngest.test.ts`

- [ ] Define `SharedIngestJob` union for `reference.import` and `result.import`.
- [ ] Add strict relative path validation.
- [ ] Add deterministic final media path helpers.
- [ ] Add `createReferenceImportJob` and `createResultImportJob` factories.
- [ ] Add tests for valid jobs, invalid paths, idempotency keys, and two-machine job ids.

### Task 3: Native File Helpers

**Files:**
- Modify: `src/lib/sharedIngest.ts`
- Test: `src/lib/sharedIngest.test.ts`

- [ ] Add dependency-injected file-system interface for unit tests.
- [ ] Add `publishSharedIngestJob`: create staging media files, write `*.tmp`, rename to `inbox/*.json`.
- [ ] Keep all paths relative inside job JSON.
- [ ] Test atomic operation order with a fake file system.

### Task 4: Merge Processor

**Files:**
- Modify: `src/lib/sharedIngest.ts`
- Test: `src/lib/sharedIngest.test.ts`

- [ ] Add dependency-injected database interface.
- [ ] Add `processSharedIngestInbox`.
- [ ] Add applied/failed record writing.
- [ ] Add idempotency checks through `sync/applied/<key>.json`.
- [ ] Add reference merge tests.
- [ ] Add result merge tests.
- [ ] Add duplicate, missing prompt, and missing media tests.

### Task 5: Settings Action And Diagnostics

**Files:**
- Modify: `src/pages/Settings.tsx`
- Modify: `src/lib/releaseDiagnostics.ts`
- Test: `src/lib/releaseDiagnostics.test.ts`

- [ ] Add shared ingest health to diagnostics: required shared directories exist for portable libraries.
- [ ] Add Settings button to process pending shared ingest jobs.
- [ ] Show applied/failed summary after processing.
- [ ] Test diagnostics pass/fail behavior.

### Task 6: Verification And Commit

**Files:**
- All changed files.

- [ ] Run `npm test`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run build`.
- [ ] Run `cargo test`.
- [ ] Run `cargo check`.
- [ ] Commit and push.

