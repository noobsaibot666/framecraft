# Phase 4 — Performance, Async Correctness, and Production Hardening

**Goal:** Meet the Phase 4 exit criteria in `docs/superpowers/specs/2026-06-30-application-integrity-hardening-design.md` (lines 106–132): bound startup cost and route retention, reject oversized/invalid uploads, trim summary-query payloads, make caches correct (complete keys, LRU/TTL bounds, in-flight dedupe, reject-eviction, invalidation), guard stale async responses, and make batch import recover and report accurately.

**Delivery constraint:** Commit as one Phase 4 commit after full verification, then merge to `main`.

---

### Task 1: Bounded, correct caches

**Files:** `src/lib/lruCache.ts` (new), `src/lib/recommendations.ts`, `src/lib/tokenCloudCache.ts`, `src/components/layout/PageTransition.tsx` + tests

- [ ] Add a small generic bounded TTL/LRU map (`createBoundedCache`) with `get`/`set`/`delete`/`clear` and max-entry eviction (oldest-first) + optional TTL.
- [ ] `recommendations.ts`: cache key must include `tags` and `promptText` (both feed scorers); store via bounded cache (cap ~24, TTL 30s); dedupe in-flight promises; export `invalidateRecommendations()` for post-write callers.
- [ ] `tokenCloudCache.ts`: on loader rejection, evict the cached promise so the next read retries.
- [ ] `PageTransition.tsx`: bound `outletCache` to current + previous key only (evict others).

### Task 2: Upload validation

**Files:** `src/lib/imageUtils.ts`, `src/pages/ResultReview.tsx`, `src/pages/ComparisonLab.tsx`, `src/pages/ManualImport.tsx` + test

- [ ] `imageUtils.ts`: add `MAX_UPLOAD_BYTES` (25 MB), `ALLOWED_IMAGE_TYPES`, and `validateImageFile(file): string | null` (returns error message or null). `fileToDataUrl` throws on oversize/invalid type.
- [ ] Wire `validateImageFile` into each upload entry point; surface the message via the page's existing error/toast state before any read.

### Task 3: Batch import recovery + reporting

**Files:** `src/pages/ManualImport.tsx` + test (extract pure `summarizeBatchOutcome` helper)

- [ ] `handleBatchImport`: wrap the loop in try/finally so `batchSaving` always clears; catch per-item failures, continue, and report exact `{ succeeded, failed }`; only navigate when all succeed, otherwise show the summary.

### Task 4: Stale-response guards

**Files:** `src/pages/PromptDetail.tsx`, `src/pages/ProjectAssistant.tsx`, `src/pages/CraftPrompt.tsx`, `src/lib/useImageDisplaySrc.ts`

- [ ] Add an `ignore`/`cancelled` flag (effect cleanup) around each async `.then(setState)` so a stale in-flight response cannot overwrite current state.

### Task 5: Summary-query payload reduction

**Files:** `src/lib/references.ts`, `src/lib/db.ts` + tests

- [ ] Reference list/search queries select summary columns (omit `file_data`; keep `thumbnail_data` only where the view needs it) — add a dedicated summary path, keep full-row fetch for detail.
- [ ] Prompt list queries (`getPrompts`, paged) omit large unused columns where the list view does not read them.

### Task 6: Startup and chunking

**Files:** `src/App.tsx`, `vite.config.ts`

- [ ] Remove the 32 module-eval `void import(...)` warmers; keep route-level `lazy()`. Replace `Suspense fallback={null}` with a visible low-cost fallback. Prefetch likely-next routes on idle.
- [ ] `vite.config.ts`: add `build.rollupOptions.output.manualChunks` splitting the react/router/query/vendor bundle so no chunk trips the 500 kB warning.

### Task 7: Verification + report

- [ ] `npm test`, `npx tsc --noEmit`, `npm run build`, `cargo test`, `git diff --check` all clean.
- [ ] Update `codereview/REPORT.md` with the Phase 4 section and exact counts. Commit and merge to `main`.
