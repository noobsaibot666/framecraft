# Phase 1 Release Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make portable-library opening, migration, ingest, seed merging, and assistant note saving safe enough to unblock release.

**Architecture:** Portable schema validation and repair share one release manifest and one conditional upgrade path. Portable writes require an acquired application lock and normal SQLite locking. Untrusted ingest paths are validated before I/O, built-in seed prompts are excluded from user-content merge, and note saving becomes append-only.

**Tech Stack:** Rust/rusqlite/Tauri 2, React 19, TypeScript 6, Vitest 4

---

### Task 1: Upgrade and validate every supported portable schema

**Files:**
- Modify: `src-tauri/src/library_package.rs`
- Test: `src-tauri/src/library_package.rs`

- [x] **Step 1: Add failing historical-schema tests**

Create package fixtures at migrations 15, 18, 19, 20, 21, and 22. After `repair_library_database_schema`, assert validation succeeds and these release columns exist:

```rust
const REQUIRED_RELEASE_COLUMNS: &[(&str, &str)] = &[
    ("comparison_sessions", "comparison_type"),
    ("comparison_sessions", "outcome_summary"),
    ("comparison_items", "source_role"),
    ("projects", "campaign_id"),
    ("generation_queue", "is_pinned"),
    ("prompts", "recipe_use_count"),
    ("prompts", "best_use"),
    ("prompts", "risk_notes"),
    ("prompts", "source_url"),
    ("prompts", "thumbnail_data"),
];
```

Also create a migration-22 fixture, repair it, then insert a prompt containing `source_url` and `thumbnail_data` to prove normal CRUD compatibility.

- [x] **Step 2: Verify RED**

Run: `cargo test library_package::tests::repair_ -- --nocapture`

Expected: migration-18 through migration-22 fixtures are incorrectly considered healthy or remain missing later columns.

- [x] **Step 3: Implement the authoritative manifest and conditional upgrader**

Add `campaigns` to `REQUIRED_RELEASE_TABLES`. Make `has_required_database_schema` require every `REQUIRED_RELEASE_COLUMNS` entry. Replace the limited previous-release upgrade with `upgrade_supported_release_schema`, which runs inside one transaction and conditionally applies:

```rust
if !connection_column_exists(&tx, "projects", "campaign_id")? {
    tx.execute_batch("ALTER TABLE projects ADD COLUMN campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL;")?;
}
if !connection_column_exists(&tx, "generation_queue", "is_pinned")? {
    tx.execute_batch("ALTER TABLE generation_queue ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0;")?;
}
if !connection_column_exists(&tx, "prompts", "recipe_use_count")? {
    tx.execute_batch("ALTER TABLE prompts ADD COLUMN recipe_use_count INTEGER NOT NULL DEFAULT 0;")?;
}
if !connection_column_exists(&tx, "prompts", "best_use")? {
    tx.execute_batch("ALTER TABLE prompts ADD COLUMN best_use TEXT;")?;
}
if !connection_column_exists(&tx, "prompts", "risk_notes")? {
    tx.execute_batch("ALTER TABLE prompts ADD COLUMN risk_notes TEXT;")?;
}
if !connection_column_exists(&tx, "prompts", "source_url")? {
    tx.execute_batch("ALTER TABLE prompts ADD COLUMN source_url TEXT;")?;
}
if !connection_column_exists(&tx, "prompts", "thumbnail_data")? {
    tx.execute_batch("ALTER TABLE prompts ADD COLUMN thumbnail_data TEXT;")?;
}
```

Create missing `campaigns`, `creative_directions`, and `shot_sequence` tables with their existing migration SQL only when absent. Apply migration 022 only when none of its four exact built-in titles exists. Commit the transaction, then validate against the same manifest.

- [x] **Step 4: Verify GREEN**

Run: `cargo test library_package::tests::repair_ -- --nocapture`

Expected: every supported fixture upgrades and validates.

### Task 2: Fail closed when SQLite locking is unavailable

**Files:**
- Modify: `src-tauri/src/portable_sqlite.rs`
- Test: `src-tauri/src/portable_sqlite.rs`

- [x] **Step 1: Add a source-contract test**

Add a test that reads `portable_sqlite.rs` and asserts the production source contains no `open_nolock_connection` call and no `SQLITE_OPEN_URI` writable fallback.

- [x] **Step 2: Verify RED**

Run: `cargo test portable_sqlite::tests::does_not_use_writable_nolock_fallback -- --nocapture`

Expected: FAIL because the fallback exists.

- [x] **Step 3: Remove the unsafe fallback**

After configured-open and stale-SHM retry fail, return:

```rust
Err(format_open_error(path, retry_error, None))
```

Delete `open_nolock_connection`, `sqlite_nolock_uri`, and tests that endorse writable no-lock operation. Preserve stale WAL-header normalization and actionable path diagnostics.

- [x] **Step 4: Verify GREEN**

Run: `cargo test portable_sqlite::tests -- --nocapture`

Expected: all portable SQLite tests pass.

### Task 3: Acquire the portable lock before repair

**Files:**
- Create: `src/lib/libraryStartup.ts`
- Create: `src/lib/libraryStartup.test.ts`
- Modify: `src/lib/librarySettings.ts`
- Modify: `src/components/LibraryLockGuard.tsx`

- [x] **Step 1: Write the failing orchestration tests**

Define and test this dependency-injected API:

```ts
export async function acquireAndPreparePortableLibrary(input: {
  baseDir: string;
  lock: LibraryLockInfo;
  now: number;
  forceTakeover: boolean;
  acquire: typeof acquireLibraryLockNative;
  repair: typeof repairLibraryDatabaseSchemaNative;
}): Promise<LibraryLockInfo>
```

The test records calls and expects `acquire` before `repair`. A failed acquire must never call repair. Invalid post-repair validation must throw.

- [x] **Step 2: Verify RED**

Run: `npm test -- src/lib/libraryStartup.test.ts`

Expected: FAIL because the orchestrator does not exist.

- [x] **Step 3: Implement and wire the orchestrator**

Implement the function as:

```ts
const owned = await input.acquire(input.baseDir, input.lock, input.now, input.forceTakeover);
const validation = await input.repair(input.baseDir);
if (!validation.ok) throw new Error(validation.errors.join(", "));
return owned;
```

Remove all automatic repair from `getLibrarySettingsState` and `openLibraryFromDialog`. Permit selection of a structurally valid library with repairable schema errors, but defer repair until startup ownership. In `LibraryLockGuard.acquire`, call `acquireAndPreparePortableLibrary` and set `owned` only after repair succeeds.

- [x] **Step 4: Verify GREEN**

Run: `npm test -- src/lib/libraryStartup.test.ts src/lib/librarySettings.test.ts src/lib/libraryLock.test.ts`

Expected: all tests pass and call order is proven.

### Task 4: Reject path-forming ingest payloads before I/O

**Files:**
- Modify: `src/lib/sharedIngest.ts`
- Modify: `src/lib/sharedIngest.test.ts`

- [x] **Step 1: Write malicious payload tests**

Add cases for `referenceId`, `resultId`, and `job_id` values containing `../`, `/`, `\\`, empty strings, and more than 128 characters. Add extension cases for `../../db`, `exe`, mixed separators, and empty values. Assert `validateSharedIngestJob` rejects them and `publishSharedIngestJob` performs no writes.

- [x] **Step 2: Verify RED**

Run: `npm test -- src/lib/sharedIngest.test.ts`

Expected: traversal-bearing IDs/extensions are accepted.

- [x] **Step 3: Implement strict validation and containment**

Use:

```ts
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
```

Validate every job ID, entity ID, and extension before path concatenation. Require staged paths to equal the canonical `${job_id}/original.${extension}` and `${job_id}/thumb.jpg` forms. Reject invalid jobs before `mkdir`, `writeFile`, `copyFile`, or DB calls.

- [x] **Step 4: Verify GREEN**

Run: `npm test -- src/lib/sharedIngest.test.ts`

Expected: all safe and malicious ingest tests pass.

### Task 5: Keep built-in seeds out of user-content merge

**Files:**
- Modify: `src-tauri/src/library_package.rs`
- Test: `src-tauri/src/library_package.rs`

- [x] **Step 1: Strengthen the failing merge tests**

Assert merging two fresh packages reports only explicitly inserted user prompts, imports no known Nano Banana seed title, and a repeated merge imports zero additional prompts.

- [x] **Step 2: Verify RED**

Run: `cargo test library_package::tests::merge_ -- --nocapture`

Expected: the existing three tests fail with 4–5 unexpected imports.

- [x] **Step 3: Filter known built-ins in the merge query**

Define the four exact migration-022 titles in one Rust constant and exclude rows matching `provider = 'nano_banana'` and those titles from `read_prompt_records`. Keep all user-created Nano Banana prompts eligible for merge.

- [x] **Step 4: Verify GREEN**

Run: `cargo test library_package::tests::merge_ -- --nocapture`

Expected: all merge tests pass, including repeat merge.

### Task 6: Append assistant notes without overwriting user data

**Files:**
- Modify: `src/lib/assistant.ts`
- Modify: `src/lib/assistant.test.ts`
- Modify: `src/pages/ProjectAssistant.tsx`

- [x] **Step 1: Write append behavior tests**

Add:

```ts
expect(appendProjectNote(undefined, "New note")).toBe("New note");
expect(appendProjectNote("Existing", "New note")).toBe("Existing\n\nNew note");
expect(appendProjectNote(" Existing ", " New note ")).toBe("Existing\n\nNew note");
```

- [x] **Step 2: Verify RED**

Run: `npm test -- src/lib/assistant.test.ts`

Expected: FAIL because `appendProjectNote` does not exist.

- [x] **Step 3: Implement and use append behavior**

Export `appendProjectNote(existing, next)` from `assistant.ts`. In `ProjectAssistant`, require `pack` and pass `appendProjectNote(pack.project.notes, payload)` to `updateProject`.

- [x] **Step 4: Verify GREEN**

Run: `npm test -- src/lib/assistant.test.ts`

Expected: all assistant tests pass.

### Task 7: Phase verification, review, and report

**Files:**
- Modify: `../codereview/REPORT.md`

- [x] **Step 1: Run complete verification**

Run:

```bash
npm test
npx tsc --noEmit
npm run build
(cd src-tauri && cargo test)
git diff --check
```

Expected: all commands exit 0. Existing Vite chunk warnings may remain until Phase 4, but no errors are allowed.

- [x] **Step 2: Request independent review**

Review the Phase 1 diff against `docs/superpowers/specs/2026-06-30-application-integrity-hardening-design.md`. Fix every Critical and Important issue, then rerun Step 1.

- [x] **Step 3: Document Phase 1**

Add the confirmed fixes, test counts, Rust test counts, build result, and reviewer verdict to `../codereview/REPORT.md`. Do not commit; the user requested one final commit after all four phases.
