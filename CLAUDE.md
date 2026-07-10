# Framecraft — CLAUDE.md

Local-first Tauri 2 desktop app for AI image/video prompt engineering. React 19 + TypeScript + Vite + SQLite. Primary target: macOS.

---

## SQLite migration rules

**All migrations must be registered in `src-tauri/src/lib.rs`** — there is no auto-discovery. Missing entries = tables never exist in the binary.

**A new standalone table also needs 4 registrations in `src-tauri/src/library_package.rs`**, or it silently won't exist in freshly-created or repaired/merged portable libraries even though the main `lib.rs` migration ran fine (this has caused two real production incidents — see project memory): `REQUIRED_RELEASE_TABLES`, `migration_sql()` (note: this array has historically NOT included every migration — it stopped at 031 before migration 035 was added; check what's actually in it rather than assuming it's exhaustive), the inline `CREATE TABLE` block in `upgrade_supported_release_schema`, and a `MergeTableSpec` entry in `MERGE_MANIFEST` (plus a `complete_graph_identity()` match arm and a fixture row in `merge_manifest_preserves_complete_dependency_graph_and_is_idempotent` if you touch that test). Mirror whatever the most recent standalone-table migration did (e.g. `inconsistency_events`, `learned_formulas`) rather than re-deriving the pattern. `cargo test` — not just `cargo check` — is required to catch a missed spot; the compiler won't.

**NAS portable libraries can fail if the DB header is still WAL-mode without sidecars.** Symptom: macOS/SMB path is readable/writable, but SQLite returns `unable to open database file`, with `WAL exists: false` and `SHM exists: false`. Check `src-tauri/src/portable_sqlite.rs`: `open_portable_database` normalizes this stale WAL header by backing up the DB under `backups/sqlite-journal-repair-*`, converting a local temp copy to `journal_mode=DELETE`, running `PRAGMA integrity_check`, and copying it back.

**Never use `(VALUES ...) AS t(col)` in migration SQL.** SQLite rejects this syntax. Use `SELECT ... UNION ALL SELECT ...` instead:
```sql
-- WRONG
FROM (VALUES ('a'), ('b')) AS t(text)

-- CORRECT
FROM (SELECT 'a' AS text UNION ALL SELECT 'b') AS t
```

**`references` is a reserved word** — always quote it: `"references"`. Applies to table names, foreign key targets, and index definitions.

**Don't create a table in migration 001 that a later migration recreates with a different schema.** The `CREATE TABLE IF NOT EXISTS` in the later migration silently no-ops, leaving the old schema in place and breaking any indexes on new columns. Fix: `DROP TABLE IF EXISTS` first in the later migration (safe only if the table is always empty at that point).

---

## Tauri v2 capabilities

Permission names in `capabilities/default.json` are scoped differently from what old docs say:

| Use this | Not this |
|----------|----------|
| `fs:read-all` | `fs:allow-read-file` |
| `fs:allow-appdata-read-recursive` | `fs:allow-read-dir` |
| `fs:allow-appdata-write-recursive` | `fs:allow-create-dir` |
| `fs:allow-write-file` | — |

Run `cargo check` after any capability change — unknown permission names are compile errors.

---

## isTauri guard pattern

Every DB call is gated on:
```ts
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
```
Dev mode (Vite browser) uses in-memory `_dev*` stores. Vitest runs in dev mode — no Tauri dependency required for tests.

---

## CSP (tauri.conf.json)

`img-src` must include `asset: https://asset.localhost tauri://localhost` for images loaded from the filesystem to render.

---

## App icon generation (macOS)

- Use `sips` for PNG resizing (built-in, no ImageMagick needed)
- Use `iconutil` for `.icns` — iconset file names **must** be `icon_16x16.png`, not `icon_16.png`
- Use Python struct for `.ico` — Pillow's `ICO` save produces a broken file (574 bytes); write the binary header manually

---

## Design constraints

Nothing OS-inspired: monochrome, hardware-like. **Red (#D71921) is signal only** — never decoration. `font-mono` for all data/labels, `system-label` for uppercase headers. Tailwind canonical classes only (`rounded-pill` not `rounded-[999px]`).

---

## Test suite

`npm test` → 142+ tests, 14+ files. All pure/in-memory — no Tauri required. Run before every build.

`cargo check` → must be clean before `npm run tauri build`.

---

## Application intelligence — current state (as of this writing, verify before relying on it)

Full detail with file:line citations: `docs/features/intelligence.md`. Summary below.

**`src/lib/intelligenceEngine.ts` is the required entry point for new "learns from usage" features.** It's a facade over the underlying storage modules (`memoryEngine.ts`, `tokenPatterns.ts`, `referenceImpact.ts`, `inconsistencyIntelligence.ts`, `db.ts`'s avoidance-pattern functions), not a replacement for them — those stay where they are. Data is still scoped per-library (each portable SQLite file keeps its own learned scores); what's unified is the code path pages call through, by decision (not a cross-library store — that was considered and explicitly rejected to preserve the NAS-portable-library model).

Use the vocabulary below when discussing or extending this area, so it's explicit whether a feature is real:

- **WIRED** — real trigger → compute → store → consumer loop, confirmed by tracing all four steps.
- **ISOLATED** — computes/stores but nothing downstream reads it (a dead end), or reads real data but shares no storage/scoring with anything else.
- **STATIC** — deterministic/rule-based, no memory of past usage even though it may look adaptive.
- **SPLIT** — part of the loop is wired, part is a dead end.

**Confirmed subsystems:**

- **Token quality scoring** — WIRED, behind `intelligenceEngine.recordResultOutcome()` (new result) and `intelligenceEngine.recordResultRescore()` (editing an existing result's score in `ResultDetail.tsx` — previously this silently skipped the loop entirely). Trigger: saving a scored result → `scoreToQualityDelta()` (`memoryEngine.ts`) + `updateTokenQualityFromResult()` + `updateCoOccurrences()` (`db.ts`, `tokenPatterns.ts`) → `tokens.quality_score`, `token_patterns` table. Read by Dashboard (Proven/Winner Tokens), Token Cloud, Token Detail, `recommendations.ts:recommendTokens`, and the sequence-builder's "proven combinations" hint. `recordResultRescore` applies only the *net* delta between the old and new score (not the new delta on its own) — re-saving an unchanged score is a no-op; re-rating applies exactly the difference, so a token's quality can't be farmed upward by repeated saves.
- **Reference impact** — WIRED, unified formula. `referenceImpact.ts` exports `computeImpactScore()` (60/40 result-win/project-win weighting) and the weight constants; `recommendations.ts:recommendReferences` now interpolates the same constants into its own SQL's `ORDER BY` instead of ordering by raw unweighted counts, so a reference can't rank differently between the Reference Library/Impact Refs panel and the Recommendation Panel. The two remain separate queries (different filtering needs — category/tag matching, plus a `prompt_references` direct-link signal `referenceImpact.ts` doesn't have) but now share the one formula that matters.
- **Recommendations engine** (`recommendations.ts`) — an aggregator + cache, not a hub. Seven independent scorers (tokens/prompts/recipes/srefs/profiles/references/avoidance), each with its own bespoke SQL against raw tables. `invalidateRecommendationCache()` is called on every mutation across `db.ts` and `references.ts` (30+ sites) and has a dedicated wiring test (`recommendationInvalidationWiring.test.ts`) — this part is disciplined and any new mutator on a table the recommender reads must follow the same pattern.
- **Recurring inconsistency conflicts** — WIRED, and the only subsystem the codebase's own comments explicitly call "App Intelligence" (`tokenConsistency.ts`). A static keyword rule fires in the live draft → `recordConsistencyEvent()` → `inconsistency_events` table → `getTopConsistencyConflicts()` promotes a conflict into a personal "watch out for" entry in `recommendAvoidance` once it recurs ≥2×.
- **Comparison decisions** — WIRED (was SPLIT). Clicking **Apply** calls `syncDecisionsToResults` then `intelligenceEngine.recordComparisonApply()`, which recomputes every touched prompt's summary — closing the old gap where only `results.is_winner` updated, never `prompts.is_winner`. Saving an AI decision as the session outcome now also calls `intelligenceEngine.recordComparisonLesson()`, which turns `decision.avoid[]` into deduped `avoidance_patterns` rows (`is_builtin = 0`) instead of a text blob nothing re-reads — these rows flow straight into `recommendAvoidance` (see next item), no new table needed.
- **Avoidance patterns** — WIRED (bug fixed). `recommendAvoidance` used to filter `avoidance_patterns.category` against a prompt's category — two unrelated taxonomies (artifact-defect categories like "texture"/"anatomy" vs. prompt categories like "advertising"/"fashion") that could never match, so the 16 built-in seeded patterns never surfaced through recommendations at all (only patterns manually added via `createAvoidancePattern`, which hardcodes `category = 'all'`, ever did). Fixed to filter on `provider` instead (genuinely the same vocabulary on both sides) and order learned (`is_builtin = 0`) patterns first.
- **Provider success formulas** (`promptFormula.ts`) — WIRED, and now per-library. Moved off browser `localStorage` onto a `learned_formulas` table (migration 035) — an in-memory cache stays the source of truth for the synchronous `getFormulaForProvider()` API every call site relies on, hydrated from SQLite on module load and written through on every learn (fire-and-forget, matching the rest of the app's mutator pattern). Learned from paste-imports (`ManualImport.tsx`) when ≥3 structural steps are recognized; consumed by Prompt Craft's Formula Bar and the Project Assistant. Test isolation via `resetLearnedFormulaCacheForTests()`, the same pattern `dbConnection.ts` already uses.
- **AI-look risk score** — STATIC. Pure keyword-trigger matching (`avoidanceEngine.ts`); never learns from whether high-risk prompts actually failed more often. Used only as a minor tiebreaker in `recommendPrompts`.
- **Recipe use count** — WIRED (was a dead end). `recommendRecipes` now factors `prompts.recipe_use_count` into its ORDER BY and reason text; a frequently-applied recipe outranks an equally-rated but unused one.
- **Duplicate detection** (`memoryEngine.ts:findSimilarPrompts`) — STATIC, Jaccard token-overlap, no memory of which suggested duplicates were accepted or dismissed. Unrelated to `recommendPrompts`'s separate "related prompts" logic.
- **Import learning** (`importLearning.ts`) — STATIC, one-shot regex/keyword extraction per pasted prompt; nothing aggregates across imports despite the name.
- **Project Assistant** (`assistant.ts`) — does **not** consume any learned scoring table (`tokens.quality_score`, `token_patterns`, reference impact). It recomputes its own deterministic suggestions from raw row counts on every call; its only link to the rest is pulling comparison `outcome_summary` text as prose context.

**When asked to add or extend an "app intelligence" feature:**

1. Start in `src/lib/intelligenceEngine.ts` — add a new orchestration function there, or extend an existing one, rather than wiring 2-3 lib calls inline in a page component.
2. Name the trigger (the exact user action that should fire it) before writing code.
3. Prefer writing into an existing table/loop (`tokens.quality_score`, `token_patterns`, `inconsistency_events`, `avoidance_patterns` with `is_builtin = 0`, the reference-impact join tables) over inventing a new parallel one — check the list above first for something that already answers a similar question.
4. If it mutates a table `recommendations.ts` reads, call `invalidateRecommendationCache()` — follow the pattern in `recommendationInvalidationWiring.test.ts`. (Reusing an existing mutator like `createAvoidancePattern`, which already does this, is preferable to writing a new one.)
5. Trace all four steps (trigger → compute → store → consumer) before calling it done — a feature that computes and stores but nothing reads is the most common failure mode here.
6. State plainly in the PR/commit whether the result is WIRED, ISOLATED, STATIC, or SPLIT, and update this section if it changes the map.

---

## Feature documentation

After shipping a significant feature or page-level change, ask the user whether to add/update that page's doc in `docs/features/<page-name>.md` — don't update it unprompted. One file per page; keep entries short, succinct, and actionable (what the page is about, what you can do, features in operational order for multi-panel pages) — no verbose field-by-field explanations. See `docs/features/prompt-craft.md` for the format.
