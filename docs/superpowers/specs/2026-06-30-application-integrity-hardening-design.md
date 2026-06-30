# Application Integrity and Hardening Design

## Objective

Audit and harden every routed Framecraft workflow, database adapter, portable-library operation, ingest/import/export path, and major loading/performance boundary. The finished application must fail explicitly instead of presenting database failures as empty content or successful saves, preserve user data across supported library operations, and pass both frontend and Rust verification.

## Delivery Strategy

Work proceeds in four risk-ordered phases. Each phase is test-first, independently reviewed, and documented in `../codereview/REPORT.md`. Source and documentation changes remain uncommitted until every phase and final review pass, then one commit records the complete result.

## Phase 1: Release Safety and Portable Database Integrity

### Schema contract

Create one authoritative portable schema manifest covering all required tables and release-critical columns through the latest migration. Portable validation, repair, release diagnostics, and tests must use this contract instead of separate partial lists.

Portable repair must detect the installed schema state and apply every pending migration in order inside a transaction. It must support libraries created by historical releases, including databases that already contain migrations 018 through 022 but lack later columns. Repair must never classify a stale schema as healthy.

### Lock and connection ordering

Portable-library discovery and validation before ownership are read-only. The application must acquire the library lock before any schema repair or writable database open. Library switching follows the same order: validate path, acquire ownership, repair/migrate, then expose the connection.

Normal SQLite locking is mandatory for writable access. The writable `nolock=1` fallback is removed. If SQLite cannot establish safe locking after stale journal/SHM recovery, opening fails with the database path and actionable recovery guidance.

### Shared ingest boundary

Inbox jobs must validate every identifier and extension used in a path. IDs use a strict ASCII filename-safe grammar and bounded length; extensions use an image whitelist. Resolved source and destination paths must remain inside their expected staging/results/references roots. Invalid jobs move to the failed queue without copying files or writing database rows.

### Built-in seed behavior

Built-in Nano Banana seed prompts must not duplicate when two libraries merge. The merge contract identifies and skips built-in seed content independently of random database-local IDs. Tests distinguish built-in seed rows from user prompts.

### Immediate data-loss fix

Project Assistant's save-note action appends to existing notes with a deterministic separator. It must never replace existing project notes.

### Phase 1 exit criteria

- Historical portable schemas upgrade to the current schema and can create/read prompts afterward.
- Repair never runs before lock ownership.
- No writable no-lock connection path remains.
- Malicious ingest identifiers and extensions are rejected before file I/O.
- Fresh-library merge tests pass without importing duplicate built-ins.
- Existing project notes survive assistant note saves.
- Frontend tests, Rust tests, TypeScript, and build pass.

## Phase 2: Persistence Completeness and Atomicity

### Library operation contracts

The UI and implementation expose distinct, accurate contracts:

- **Backup/Copy/Move:** produce a consistent full-library snapshot, including committed WAL content, all database entities, media, metadata, and sync directories.
- **Merge:** preserve supported user content and relationships using a versioned table/column manifest and dependency order. Modern prompt fields, recipes, results, references, projects, campaigns, comparison data, and join tables must not be silently dropped.
- **Prompt JSON transfer:** is explicitly versioned and labeled as prompt transfer unless it round-trips the complete library. Every field included in that format must import symmetrically.

Live SQLite files are copied through a SQLite-consistent snapshot mechanism rather than raw filesystem copy. Package publication uses staging and atomic rename so an interrupted operation does not expose a half-written library.

### Cross-resource transactions

Database groups that represent one user action execute atomically on one connection: project creation with extended/campaign fields, comparison winner selection and decision synchronization, batch prompt import, and relationship creation. Duplicate inserts return the persisted row ID rather than a generated ID for an ignored row.

Media workflows stage files first, commit database rows/links as one logical unit, then publish files. Failure cleanup removes staged or newly copied files. Deletion workflows remove database records and associated managed media, with reconciliation coverage for pre-existing orphans.

### Error semantics

Database helpers return empty arrays only for successful empty queries and `null` only for a successfully queried missing row. Migration, adapter, corruption, and permission errors propagate with operation context. Compatibility handling catches only recognized missing-schema errors and is removed once migration guarantees make it unnecessary.

### Phase 2 exit criteria

- Snapshot tests cover WAL-backed databases.
- Merge round-trip tests cover all declared fields and relationships.
- Failure-injection tests prove no partial database state or orphan media remains.
- Duplicate and cross-session comparison operations behave correctly.
- JSON transfer labels and round-trip behavior match.
- Frontend tests, Rust tests, TypeScript, and build pass.

## Phase 3: Routed Feature Wiring and Page Reliability

### Navigation contracts

Every visible navigation action must arrive with its promised context:

- Batch Import opens batch mode from `?batch=1`.
- Token Detail's `tokenId` initializes Craft with that token.
- Prompt Library consumes provider and failed-state query filters as well as tags.
- Token management points to a real destination or the dead action is removed.
- Unknown routes render a recoverable not-found page.

Global Comparison uploads become managed persisted results/items when a session is saved. Reopening a session reconstructs every uploaded slot and decision. The UI must not describe transient data as saved.

### Routed resource states

Campaign, project workspace/subroutes, result review, and other ID-backed pages use explicit `loading`, `ready`, `not-found`, and `error` states. Mutation controls are unavailable until the parent resource is resolved. Errors include retry and safe navigation.

Dead modal state and unreachable UI branches are removed. Existing successful workflows remain behaviorally unchanged.

### Phase 3 exit criteria

- Route/query contract tests cover every corrected link.
- Persistence round-trip tests cover global comparison sessions.
- Missing IDs and rejected loads produce the correct state and block writes.
- All routed actions have a valid destination and effect.
- Frontend tests, Rust tests, TypeScript, and build pass.

## Phase 4: Performance, Async Correctness, and Production Hardening

### Startup and navigation

Keep route-level lazy loading. Remove module-evaluation imports of every page. Provide a visible, low-cost Suspense fallback and prefetch only likely next routes during idle time or navigation intent. The route transition cache retains only current/previous outlets and evicts completed entries.

### Payload and query control

Image ingestion validates MIME, dimensions, and encoded/file size, creates bounded thumbnails, and stores managed media instead of unbounded base64 payloads where practical. List/dashboard queries select summary columns and avoid transferring full thumbnail/blob fields unless a view needs them.

### Cache and request correctness

Recommendation cache keys include every input that changes results, use bounded TTL/LRU storage, deduplicate in-flight work, and invalidate after relevant writes. Token cache evicts rejected promises and supports retry. Category loads, draft analysis, and recommendations ignore or abort stale responses so old work cannot overwrite current state. Optimistic favorite mutations roll back and surface errors.

### Batch behavior

Batch import uses an atomic or explicitly resumable workflow, always clears saving state, and reports exact successes/failures. Set-based database updates replace avoidable per-item IPC loops.

### Phase 4 exit criteria

- Startup no longer eagerly evaluates every page chunk and never renders a blank route fallback.
- Route transition retention is bounded.
- Oversized/invalid uploads are rejected predictably.
- Summary queries avoid large unused payloads.
- Cache retry, invalidation, bounds, and stale-response tests pass.
- Batch failure tests prove UI recovery and accurate reporting.
- Frontend tests, Rust tests, TypeScript, and build pass.

## Review and Verification

After each phase:

1. Run focused red/green tests for every fix.
2. Run the complete Vitest and Rust suites, TypeScript checking, production build, and diff hygiene checks.
3. Dispatch an independent code reviewer for the phase diff.
4. Fix every Critical and Important review issue before proceeding.
5. Record completed work and exact evidence in `../codereview/REPORT.md`.

After Phase 4, run a final application-wide review against this design. Commit only when the repository is cleanly verified and the report contains no unresolved Critical or Important item introduced by this scope.

## Non-Goals

- Redesigning Framecraft's visual language.
- Adding unrelated providers or creative features.
- Guaranteeing writable operation on storage that cannot provide safe SQLite locking.
- Claiming interactive GUI coverage where no automated desktop harness exists; such gaps must be documented and covered by deterministic unit/integration tests where possible.
