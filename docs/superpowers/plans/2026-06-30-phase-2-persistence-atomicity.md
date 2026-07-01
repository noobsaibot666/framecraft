# Phase 2 Persistence Completeness and Atomicity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make library snapshots, merges, prompt transfer, multi-row database actions, and managed-media workflows complete, atomic, and explicit about failures.

**Architecture:** Keep package-level operations in Rust, where one SQLite connection and filesystem staging can guarantee consistency. Add a parameterized native transaction command for frontend persistence actions, retain a tested plugin fallback for local app-data mode, and isolate prompt JSON serialization in a versioned transfer module. Treat database rows and managed media as one logical operation with staged publication, compensation on failure, and orphan reconciliation.

**Tech Stack:** Rust, rusqlite backup API, Tauri 2 commands, TypeScript, Vitest, SQLite transactions.

**Delivery constraint:** Do not commit individual tasks. The user requested phased delivery, so Phase 2 is committed only after the full verification and report update pass.

---

### Task 1: SQLite-consistent snapshots and atomic package publication

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/library_package.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/libraryNative.ts`
- Modify: `src/lib/librarySettings.ts`
- Test: `src-tauri/src/library_package.rs`
- Test: `src/lib/librarySettings.test.ts`

- [x] **Step 1: Add failing WAL snapshot and publication-cleanup tests**

Add Rust tests that create a source package, enable WAL, insert committed rows while the writer remains open, invoke the snapshot helper, and assert the target contains those rows. Add failure injection around metadata/media copy and assert neither the final target nor its staging sibling is visible after failure.

```rust
#[test]
fn copy_snapshot_includes_committed_wal_rows() {
    let source = create_test_library("wal-source");
    let writer = Connection::open(&source.db_path).unwrap();
    writer.pragma_update(None, "journal_mode", "WAL").unwrap();
    writer.execute("INSERT INTO prompts (id, title, provider, prompt_text, created_at, updated_at) VALUES ('wal-prompt','WAL','midjourney','body','t','t')", []).unwrap();

    let copy = copy_library_package(&source.base_dir, &target_path(), &[], &[]).unwrap();
    assert_eq!(prompt_count(&copy.paths.db_path, "wal-prompt"), 1);
}
```

- [x] **Step 2: Run focused Rust tests and verify RED**

Run: `cargo test --manifest-path src-tauri/Cargo.toml copy_`

Expected: FAIL because the current implementation copies the database file and writes directly to the final package.

- [x] **Step 3: Implement snapshot and staged publication helpers**

Enable `rusqlite = { version = "0.32", features = ["backup"] }`. In `library_package.rs`, add helpers with these contracts:

```rust
fn snapshot_database(source: &Path, destination: &Path) -> Result<(), String>;
fn staging_package_path(target: &Path) -> PathBuf;
fn publish_staged_package(staging: &Path, target: &Path) -> Result<(), String>;
fn copy_package_tree(source: &LibraryPathsDto, staging: &LibraryPathsDto) -> Result<Vec<String>, String>;
```

`snapshot_database` must use `rusqlite::backup::Backup`, not `fs::copy`. `copy_package_tree` copies `library.json`, `results/`, `references/`, `inbox/`, `staging/`, and `sync/`; it excludes `locks/` and `backups/`. Build the complete package under a unique sibling `.framecraft-staging-*` directory, validate it, fsync/close handles, and atomically rename it to the final target. Cleanup the staging directory on every error. Reject an existing final target rather than merging into it.

Route migration, copy, and backup through this mechanism. Remove `result_files` and `reference_files` from the native contract and from `librarySettings.ts`; a full snapshot discovers package content itself.

- [x] **Step 4: Verify snapshot behavior**

Run: `cargo test --manifest-path src-tauri/Cargo.toml library_package::tests`

Expected: WAL and failure-injection tests pass; existing package tests remain green.

---

### Task 2: Versioned, dependency-aware complete-library merge

**Files:**
- Modify: `src-tauri/src/library_package.rs`
- Modify: `src/lib/libraryPackage.ts`
- Modify: `src/pages/Settings.tsx`
- Test: `src-tauri/src/library_package.rs`
- Test: `src/lib/libraryPackage.test.ts`

- [x] **Step 1: Add a failing complete-graph merge fixture**

Build a source library containing non-default values and relationships for prompts/recipes, results, references, projects, campaigns, comparisons, project joins, prompt/result reference joins, deliverables, assistant threads/messages, export presets, generation queue, creative directions, shot sequence, tokens/patterns, srefs, profiles, and app metadata. Merge into a target that forces at least one ID collision per root entity. Assert every declared field survives and every foreign key points at the remapped target ID.

```rust
assert_eq!(text_value(&target, "prompts", "builder_state", &prompt_id), Some("{\"subject\":\"shoe\"}"));
assert_join(&target, "project_prompts", &[&project_id, &prompt_id]);
assert_join(&target, "comparison_items", &[&session_id, &result_id]);
assert_join(&target, "result_references", &[&result_id, &reference_id]);
```

- [x] **Step 2: Run the complete-graph test and verify RED**

Run: `cargo test --manifest-path src-tauri/Cargo.toml merge_round_trips_complete_library_graph`

Expected: FAIL because only prompts, results, and references are currently merged and the prompt manifest omits migration-20/23/25 fields.

- [x] **Step 3: Replace table-specific merge with a versioned manifest**

Introduce explicit descriptors rather than discovering arbitrary tables at runtime:

```rust
struct MergeTableSpec {
    table: &'static str,
    columns: &'static [&'static str],
    id_column: Option<&'static str>,
    dependencies: &'static [ForeignKeySpec],
    media_columns: &'static [MediaColumnSpec],
    conflict: MergeConflictPolicy,
}

const MERGE_MANIFEST_VERSION: u8 = 1;
const MERGE_TABLE_ORDER: &[&str] = &[
    "app_meta", "campaigns", "projects", "prompts", "results", "references",
    "token_categories", "tokens", "token_patterns", "avoidance_patterns",
    "srefs", "profiles", "recipes", "comparison_sessions",
    "project_deliverables", "assistant_threads", "export_presets",
    "generation_queue", "creative_directions", "shot_sequence",
    "project_prompts", "project_results", "project_references",
    "prompt_references", "result_references", "prompt_tokens",
    "comparison_items", "deliverable_references", "assistant_messages",
];
```

Declare all supported user-content tables and all columns through migration 25, including `recipe_use_count`, `best_use`, `risk_notes`, `source_url`, `thumbnail_data`, and `builder_state`. Process root entities before join/dependent tables. Maintain per-table source-to-target ID maps and rewrite every declared foreign key before insertion. Keep built-in seed filtering from Phase 1. Merge all database rows in one target transaction.

Stage all copied media before opening the target transaction. On transaction failure, delete staged media. After commit, publish staged media with collision-safe names; if publication fails, execute a compensating transaction that removes rows inserted by this merge and delete published files. Return a per-table report map while preserving the existing prompt/result/reference summary fields for the UI.

- [x] **Step 4: Verify complete merge and repeated-merge idempotency**

Run: `cargo test --manifest-path src-tauri/Cargo.toml merge_`

Expected: complete graph, collision, media failure, and repeated merge tests pass without duplicate relationships.

---

### Task 3: Parameterized atomic frontend database operations

**Files:**
- Modify: `src-tauri/src/native_sqlite.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/nativeSqlite.ts`
- Create: `src/lib/dbTransaction.ts`
- Create: `src/lib/dbTransaction.test.ts`
- Modify: `src/lib/projects.ts`
- Modify: `src/lib/comparisons.ts`
- Modify: `src/lib/db.ts`
- Test: `src-tauri/src/native_sqlite.rs`
- Test: `src/lib/projects.test.ts`
- Test: `src/lib/comparisons.test.ts`

- [x] **Step 1: Add rollback, duplicate-ID, and comparison-concurrency tests**

Cover four required behaviors: project creation rolls back when any extended field fails; batch prompt import leaves zero rows when one insert fails; duplicate comparison-item insertion returns the persisted row ID; winner selection and result-decision synchronization are each one transaction. Add a cross-session winner test where two sessions select different winners without clearing the other session.

- [x] **Step 2: Run focused tests and verify RED**

Run: `cargo test --manifest-path src-tauri/Cargo.toml native_sqlite && npm test -- src/lib/projects.test.ts src/lib/comparisons.test.ts src/lib/dbTransaction.test.ts`

Expected: FAIL because there is no parameterized transaction command and current operations issue independent statements.

- [x] **Step 3: Add a structured native transaction command**

Use a typed statement list so values never require SQL interpolation:

```rust
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TransactionStatement { query: String, bind_values: Vec<JsonValue> }

#[tauri::command]
fn native_sqlite_execute_transaction(
    db_path: String,
    statements: Vec<TransactionStatement>,
) -> Result<Vec<NativeSqliteTransactionResult>, String>;
```

Add an `operation: "execute" | "query"` discriminator to `TransactionStatement`. Open one connection, begin one rusqlite transaction, execute every normalized statement, collect `rowsAffected`/`lastInsertId` for writes and row maps for queries, and commit only after all succeed. Register the command and expose `executeTransaction` on `NativeSqliteDatabase`.

In `dbTransaction.ts`, define a small adapter:

```ts
export type AtomicStatement = { operation: "execute" | "query"; query: string; bindValues?: unknown[] };
export async function executeAtomically(db: DatabaseLike, statements: AtomicStatement[]): Promise<QueryResult[]>;
```

Use the native method when available. For the plugin-backed local database, execute a single escaped batch generated only by a centralized, tested SQLite literal encoder; reject unsupported object/blob values instead of silently stringifying them.

- [x] **Step 4: Move user actions onto atomic statements**

Change `createProject` to one insert containing base, migration-14, and `campaign_id` fields. Remove compatibility catches now that startup guarantees the schema. Convert `setItemWinner`, `clearItemWinner`, `setItemRejected`, `syncDecisionsToResults`, relationship insert + parent timestamp updates, and `batchUpdatePrompts` to `executeAtomically`.

For `addItemToSession`, execute the following write and read in one transaction, then return the ID from the query result. Never return the newly generated ID when the insert was ignored.

```sql
INSERT INTO comparison_items
  (id, session_id, result_id, position, source_role, is_winner, is_rejected, created_at)
VALUES ($1, $2, $3, $4, $5, 0, 0, $6)
ON CONFLICT(session_id, result_id) DO UPDATE SET
  position = excluded.position,
  source_role = excluded.source_role;
SELECT id FROM comparison_items WHERE session_id = $1 AND result_id = $2;
```

- [x] **Step 5: Verify atomic operations**

Run: `npm test -- src/lib/dbTransaction.test.ts src/lib/projects.test.ts src/lib/comparisons.test.ts && cargo test --manifest-path src-tauri/Cargo.toml native_sqlite`

Expected: all transaction, rollback, duplicate, and cross-session tests pass.

---

### Task 4: Explicit, symmetric prompt JSON transfer

**Files:**
- Create: `src/lib/promptTransfer.ts`
- Create: `src/lib/promptTransfer.test.ts`
- Modify: `src/pages/Settings.tsx`
- Modify: `src/lib/db.ts`
- Modify: `src/types/index.ts`

- [x] **Step 1: Add failing round-trip and rejection tests**

Assert that all fields declared by the transfer format export and import symmetrically, including character/image refs, analysis fields, source URL, thumbnail, recipe state, reuse potential, builder state, and lineage. Assert unsupported versions and malformed records are rejected before any database write. Assert a failed record rolls back the entire batch.

- [x] **Step 2: Run the transfer tests and verify RED**

Run: `npm test -- src/lib/promptTransfer.test.ts`

Expected: FAIL because Settings owns an unvalidated version-1 shape and omits several import fields.

- [x] **Step 3: Implement the version-2 prompt transfer module**

Use an explicit discriminated envelope:

```ts
export interface PromptTransferV2 {
  kind: “framecraft.prompt-transfer”;
  version: 2;
  exported_at: string;
  prompts: PromptTransferRecordV2[];
}

export function exportPromptTransfer(prompts: Prompt[]): PromptTransferV2;
export function parsePromptTransfer(raw: string): PromptTransferV2;
export async function importPromptTransfer(data: PromptTransferV2): Promise<number>;
```

Define the record field list once and use it for both export and import mapping. Preserve lineage by mapping `source_id` to newly persisted IDs and rewriting `parent_source_id` within the batch. Label the Settings action and downloaded filename “Prompt Transfer”; do not call it a library export. Keep full-library export as the `.framecraftlib` snapshot action.

- [x] **Step 4: Verify transfer and Settings wiring**

Run: `npm test -- src/lib/promptTransfer.test.ts src/lib/librarySettings.test.ts`

Expected: version, symmetry, validation, lineage, and atomic-batch tests pass.

---

### Task 5: Managed-media compensation and orphan reconciliation

**Files:**
- Modify: `src/lib/fileStore.ts`
- Modify: `src/lib/sharedImport.ts`
- Modify: `src/lib/db.ts`
- Modify: `src/lib/references.ts`
- Modify: `src/lib/librarySettings.ts`
- Modify: `src/pages/Settings.tsx`
- Test: `src/lib/fileStore.test.ts`
- Test: `src/lib/sharedImport.test.ts`
- Test: `src/lib/librarySettings.test.ts`

- [x] **Step 1: Add media failure-injection tests**

Inject failures after original write, after thumbnail write, during database insertion, and during relationship insertion. Assert no final media remains and no partial database row/link is visible. Add deletion tests that use the exact persisted paths rather than guessing extensions from IDs. Add reconciliation tests with one referenced file and one orphan.

- [x] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/lib/fileStore.test.ts src/lib/sharedImport.test.ts src/lib/librarySettings.test.ts`

Expected: FAIL because local imports publish files before rows and cleanup helpers swallow all errors.

- [x] **Step 3: Implement staged media lifecycle helpers**

Add focused APIs:

```ts
export interface StagedMedia { originalTemp: string; thumbnailTemp: string; originalFinal: string; thumbnailFinal: string; }
export async function stageManagedImage(kind: "result" | "reference", id: string, dataUrl: string): Promise<StagedMedia>;
export async function publishStagedMedia(media: StagedMedia): Promise<void>;
export async function cleanupStagedMedia(media: StagedMedia): Promise<void>;
export async function removeManagedPaths(paths: Array<string | null | undefined>): Promise<void>;
```

For imports: stage files, atomically insert row plus relationship, then rename temp files to final names. If DB work fails, remove temp files. If publication fails, delete the inserted row/link in a compensating transaction and remove all temp/final files.

For deletion: select exact managed paths, stage them into a trash directory by rename, delete the row in a transaction, then remove trash. Restore renamed files if the database transaction fails.

- [x] **Step 4: Add orphan reconciliation**

Implement a read-only scan that compares files under managed result/reference directories against paths stored in `results` and `references`. Expose a Settings preview with counts and a separately confirmed cleanup action. Never delete files outside the active managed directories.

- [x] **Step 5: Verify media lifecycle behavior**

Run: `npm test -- src/lib/fileStore.test.ts src/lib/sharedImport.test.ts src/lib/librarySettings.test.ts`

Expected: every injected failure leaves no partial row, relationship, staging file, or newly created orphan.

---

### Task 6: Honest database error semantics

**Files:**
- Create: `src/lib/dbErrors.ts`
- Create: `src/lib/dbErrors.test.ts`
- Modify: `src/lib/comparisons.ts`
- Modify: `src/lib/references.ts`
- Modify: `src/lib/campaigns.ts`
- Modify: `src/lib/recommendations.ts`
- Modify: `src/lib/creativeDirections.ts`
- Modify: `src/lib/deliverables.ts`
- Modify: `src/lib/queue.ts`
- Modify: `src/lib/assistant.ts`
- Test: `src/lib/comparisons.test.ts`
- Test: `src/lib/references.test.ts`
- Test: `src/lib/campaigns.test.ts`
- Test: `src/lib/recommendations.test.ts`
- Test: `src/lib/creativeDirections.test.ts`
- Test: `src/lib/deliverables.test.ts`
- Test: `src/lib/queue.test.ts`
- Test: `src/lib/assistant.test.ts`

- [x] **Step 1: Inventory and test swallowed query errors**

For every persistence helper that catches a database exception and returns `[]`, `{}`, `0`, or `null`, add a test proving the exception propagates with operation context. Preserve `[]` only for a successful empty query and `null` only for a successful missing-row query.

- [x] **Step 2: Add contextual error wrapping**

```ts
export function databaseError(operation: string, error: unknown): Error {
  return new Error(`${operation}: ${String(error)}`, { cause: error });
}
```

Remove broad compatibility catches. Catch only when adding meaningful context and rethrow. If a compatibility branch remains temporarily necessary, recognize SQLite's exact missing-table/missing-column code/message and rethrow every other error.

- [x] **Step 3: Verify error semantics**

Run: `npm test -- src/lib/comparisons.test.ts src/lib/references.test.ts src/lib/campaigns.test.ts src/lib/recommendations.test.ts src/lib/creativeDirections.test.ts src/lib/deliverables.test.ts src/lib/queue.test.ts src/lib/assistant.test.ts`

Expected: successful empty/missing queries retain their documented return values; corruption, permission, migration, and adapter errors reject with operation context.

---

### Task 7: Phase verification, review, report, and checkpoint

**Files:**
- Modify: `docs/superpowers/plans/2026-06-30-phase-2-persistence-atomicity.md`
- Modify outside repository: `/Users/alan/_localDEV/_creative/_aicd-creator/codereview/REPORT.md`

- [x] **Step 1: Run complete verification**

```bash
npm test
npx tsc --noEmit
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
git diff --check
```

Expected: every command exits 0. Existing Vite chunk warnings remain assigned to Phase 4; no test, type, build, Rust, or diff error is allowed.

- [ ] **Step 2: Review Phase 2 against the approved design**

Re-read `docs/superpowers/specs/2026-06-30-application-integrity-hardening-design.md` lines 47–76. Inspect the complete diff and trace one snapshot, one full merge, one prompt transfer, one comparison decision, one media failure, and one database exception end-to-end. Fix every Critical or Important finding and rerun Step 1.

- [ ] **Step 3: Update the report**

Add a completed “Application Integrity Hardening — Phase 2: Persistence completeness and atomicity” section to `codereview/REPORT.md` with implemented contracts, exact verification counts, known non-fatal warnings, and the remaining Phase 3–4 scope.

- [ ] **Step 4: Stop for user approval**

Present the Phase 2 result and verification evidence. Do not begin Phase 3 until the user explicitly says to proceed.
