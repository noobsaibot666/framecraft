# Phase 7 Final Performance Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining performance, async-correctness, upload-safety, batch-recovery, and production-build work on the integrated Phase 2–3 `main` branch.

**Architecture:** Add small reusable boundaries for bounded caches, latest-request ownership, image validation, and prompt-list summary rows. Keep page changes thin: pages consume those helpers and preserve existing full-detail queries. Remove eager page imports, expose a visible route fallback, and configure stable vendor chunking without changing route URLs.

**Tech Stack:** React 19, TypeScript 6, Vitest, Zustand, Tauri 2, SQLite, Vite 7.

**Delivery constraint:** One final commit after all tasks, full verification, report update, and final review.

---

### Task 1: Bounded caches and transition retention

**Files:**
- Create: `src/lib/boundedCache.ts`
- Create: `src/lib/boundedCache.test.ts`
- Modify: `src/lib/recommendations.ts`
- Modify: `src/lib/recommendations.test.ts`
- Modify: `src/lib/tokenCloudCache.ts`
- Modify: `src/lib/tokenCloudCache.test.ts`
- Modify: `src/components/layout/PageTransition.tsx`
- Modify: `src/components/layout/PageTransition.test.ts`

- [x] Add failing tests for TTL/LRU eviction, in-flight dedupe, rejected-promise eviction/retry, explicit invalidation, and transition cache retention of only current/previous keys.
- [x] Run `npm test -- src/lib/boundedCache.test.ts src/lib/tokenCloudCache.test.ts src/lib/recommendations.test.ts src/components/layout/PageTransition.test.ts` and verify RED.
- [x] Implement `createBoundedAsyncCache<K,V>({ maxEntries, ttlMs, load, now })` with LRU touch, pending dedupe, rejected-entry eviction, and invalidation.
- [x] Move recommendation caching to the bounded helper with a key containing provider, category, project, excluded prompt, tags, and prompt text. Export invalidation and call it after relevant prompt/result/reference writes.
- [x] Move token category caching to the bounded helper while retaining `get/set/mutate/invalidate` behavior.
- [x] Extract `retainTransitionOutlets(cache, currentKey, outlet, previousKey)` and cap route outlets at two entries.
- [x] Re-run focused tests and `npx tsc --noEmit`.

### Task 2: Predictable image upload limits

**Files:**
- Modify: `src/lib/imageUtils.ts`
- Modify: `src/lib/imageUtils.test.ts`
- Modify: `src/pages/ResultReview.tsx`
- Modify: `src/pages/ComparisonLab.tsx`
- Modify: `src/pages/ManualImport.tsx`
- Modify: `src/pages/ReferenceLibrary.tsx`

- [x] Add failing tests for accepted JPEG/PNG/WebP, rejected MIME, zero/oversized bytes, invalid dimensions, and dimensions exceeding 12,000 pixels or 40 megapixels.
- [x] Implement `validateImageFile(file, { maxBytes, maxDimension, maxPixels })`, decoding dimensions before any data-URL conversion and returning a normalized user-facing error.
- [x] Wire validation before `fileToDataUrl`/preview creation in ResultReview, ComparisonLab, ManualImport, and ReferenceLibrary. Use a 25 MiB encoded-file limit and revoke previews on rejection/unmount.
- [x] Add source-contract tests proving each upload path calls validation before conversion.
- [x] Run focused tests and TypeScript.

### Task 3: Atomic batch import recovery and reporting

**Files:**
- Create: `src/lib/manualBatchImport.ts`
- Create: `src/lib/manualBatchImport.test.ts`
- Modify: `src/pages/ManualImport.tsx`

- [x] Add failing tests proving all items are prepared before writing, one database failure reports zero committed imports, success reports the exact count, and saving state is cleared through `finally`.
- [x] Implement `buildManualPromptTransfer(items)` using import-learning enrichment and the existing version-2 prompt-transfer envelope.
- [x] Implement `runManualBatchImport(items, importTransfer)` as one atomic prompt-transfer import returning `{ imported, total }`.
- [x] Update ManualImport to wrap the call in `try/catch/finally`, keep the page available on failure, set an exact batch error, show success count, and navigate only after success.
- [x] Run focused tests and TypeScript.

### Task 4: Stale-request ownership guards

**Files:**
- Create: `src/lib/latestRequest.ts`
- Create: `src/lib/latestRequest.test.ts`
- Modify: `src/pages/PromptDetail.tsx`
- Modify: `src/pages/ProjectAssistant.tsx`
- Modify: `src/pages/CraftPrompt.tsx`
- Modify: `src/lib/useImageDisplaySrc.ts`
- Create: `src/lib/staleRequestWiring.test.ts`

- [x] Add failing tests for monotonically increasing request tokens, invalidation on dependency change/unmount, and suppression of an older promise resolving after a newer one.
- [x] Implement `createLatestRequestGuard()` with `begin`, `isCurrent`, and `invalidate`.
- [x] Guard PromptDetail's grouped route load, ProjectAssistant context/thread/message loads, CraftPrompt prompt/project/reference/token async loads, and image fallback conversion. Reset page-specific state when route identity changes.
- [x] Add wiring tests checking every targeted async effect owns and invalidates a guard.
- [x] Run focused tests and TypeScript.

### Task 5: Summary list queries

**Files:**
- Modify: `src/lib/db.ts`
- Modify: `src/lib/references.ts`
- Modify: `src/stores/usePromptStore.ts`
- Modify: `src/pages/ReferenceLibrary.tsx`
- Create: `src/lib/summaryQueries.test.ts`

- [x] Add failing source/mapper tests requiring explicit prompt/reference summary column lists and forbidding `SELECT *` in list/search queries.
- [x] Add `getPromptSummaries`/`searchPromptSummaries` selecting only fields rendered, filtered, sorted, copied, or exported by PromptLibrary; retain `getPromptById` as the full detail query.
- [x] Add `getReferenceSummaries`/`searchReferenceSummaries` selecting card/filter fields and managed thumbnail/file paths; retain full `getReferenceById`.
- [x] Wire PromptLibrary's store and ReferenceLibrary to summary APIs; keep workspace/detail consumers on full APIs.
- [x] Run focused tests and TypeScript.

### Task 6: Startup and build chunking

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/ui/RouteFallback.tsx`
- Create: `src/lib/routeLoading.test.ts`
- Modify: `vite.config.ts`

- [x] Add failing tests that reject module-evaluation imports for all pages, require a visible Suspense fallback, and require manual vendor chunks.
- [x] Remove all eager `void import('@/pages/...')` calls. Preserve route-level lazy imports.
- [x] Add a low-cost accessible `RouteFallback` and use it for every route Suspense boundary.
- [x] Configure `build.rollupOptions.output.manualChunks` for React/router/query, Radix, motion, and Tauri dependencies; do not force application pages into shared chunks.
- [x] Run focused tests, TypeScript, and `npm run build`; confirm the startup entry no longer exceeds the configured 500 kB warning threshold.

### Task 7: Verification, report, review, and commit

**Files:**
- Modify: `docs/superpowers/plans/2026-07-01-phase-7-final-hardening.md`
- Modify outside repository: `/Users/alan/_localDEV/_creative/_aicd-creator/codereview/REPORT.md`

- [x] Run `npm test`, `npx tsc --noEmit`, `npm run build`, `cargo test --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`, `cargo fmt --manifest-path src-tauri/Cargo.toml --check`, and `git diff --check`.
- [x] Review the complete Phase 7 diff against Phase 4 of `docs/superpowers/specs/2026-06-30-application-integrity-hardening-design.md`; fix every Critical and Important issue.
- [x] Update `REPORT.md` with implemented contracts, exact test/build counts, resolved chunk warnings, and any remaining non-critical limitation.
- [x] Mark all plan checkboxes complete and commit the verified Phase 7 changes to `main` without pushing.
