# Framecraft — CLAUDE.md

Local-first Tauri 2 desktop app for AI image/video prompt engineering. React 19 + TypeScript + Vite + SQLite. Primary target: macOS.

---

## Release delivery loop — all three channels, every time

A Framecraft release is not "done" until **all three** channels carry the same version: **(1) App Store** (via Transporter → App Store Connect), **(2) Store Manager** (the storefront's publish pipeline), **(3) the live storefront + licensing server** (`alan-design.com`). Nothing syncs these automatically — a release that stops after Transporter leaves the direct-sale channel selling the previous DMG under the same listing. Standing rule: whenever asked to "build for the App Store" / "raise the version", drive the whole loop.

### Step 0 — version bump (one commit, four files)

`src-tauri/tauri.conf.json` `version`, `src-tauri/Cargo.toml` `version`, `package.json` `version` (marketing / `CFBundleShortVersionString`), **and** `CFBundleVersion` in `src-tauri/Info.plist` (the build number App Store Connect / Transporter key on — must be strictly higher than any prior upload). `Cargo.lock`'s `framecraft` entry follows on the next build; commit it too. A new App Store submission generally needs both a new marketing version *and* a new build number.

### Step 1 — App Store `.pkg` (Claude builds; user uploads)

`bash scripts/mac_sign_and_package_mas.sh` → `builds/Framecraft_SUBMISSION.pkg` (sandboxed, `com.alan.framecraft`, re-signed with `3rd Party Mac Developer Application` + `Installer`, `embedded.provisionprofile` embedded). Verify the **payload inside the `.pkg`** (a later `deploy_direct_macos.sh` run overwrites `target/release/bundle/macos/Framecraft.app`): `pkgutil --expand`, then check `CFBundleShortVersionString` / `CFBundleVersion`, `LSApplicationCategoryType` present, `ITSAppUsesNonExemptEncryption=false`, **no `get-task-allow`** in the signed entitlements, and the profile has **no `ProvisionedDevices`** (= distribution, not development). Then the user drags the `.pkg` into Transporter and sets the version + build in App Store Connect. Claude cannot do the Transporter/ASC part (Apple credentials).

### Step 2 — direct DMG → Store Manager ingest (Claude builds + drops)

`bash scripts/deploy_direct_macos.sh` → builds `--features direct-dist` with `TAURI_SIGNING_PRIVATE_KEY_PATH=secrets/framecraft-updater.key`, signs (Developer ID), notarizes (`notarytool --wait`), staples. Then create `/Volumes/Gaia/04_DEV/store-manager/ingest/Apps/framecraft/<version>/` containing:

- the DMG copied to the **fixed name `Framecraft.dmg`** (not version-suffixed — `licensing-server/products.js`'s `framecraft` entry points at that literal path, and the manifest's declared filename must match it),
- `manifest.json` (schema: Store Manager's `docs/manifest-schema.md`) — `productSlug: "framecraft"`, `category: "Apps"`, `fulfillment: "license"`, `version` = this release, `files.macos: "Framecraft.dmg"`, a `changelog`, `notifyExisting` (default `false`; set `true` only if existing buyers should get the "new version" email). Windows: only list `files.windows` if a matching `Framecraft.exe` for **this** version is also being dropped — otherwise macOS-only, and Windows joins this version's folder later.

Write `manifest.json` with the Write tool, not a shell heredoc — the SMB mount fails heredoc redirects intermittently.

### Step 3 — Dry-run → Publish (ALWAYS the user)

Within ~30s the drop shows in the dashboard Inbox (`http://192.168.178.146:5180`) as `pending_review`. **The user runs Dry-run, then Publish — never scripted around.** Deliberate gate: Publish touches live Stripe and rewrites `web_three` registry files (`src/data/storeProducts.json`, `licensing-server/products.js`, `server.js`'s `ALLOWED_PRICE_IDS`). The dry-run must say **"reusing existing price"** — Framecraft's Stripe product/price `prod_V0Qaw4oUtqkKgN` / `price_1U0Pj9CsCSs3k4X1b8i25dz6` is already seeded — not creating a new one. `storeProducts.json`'s `framecraft` entry has **no version field**; the storefront is version-agnostic and simply serves whatever `actual/Framecraft.dmg` the pipeline last wrote, so a version bump needs no hand-edit of that file.

### Step 4 — ship the `web_three` edits + deploy

Published on the **TrueNAS** instance (the normal one), the `web_three` edits land in the NAS **staging clone** `/Volumes/Gaia/04_DEV/store-manager/web_three_staging/`, **not** the Mac checkout `/Users/alan/_localDEV/web_three`, and the DMG is copied to the real releases tree server-side. Claude can: read the staging clone's diff (reads over the SMB mount are safe; *writes* — `checkout`/`reset` — are not, do those over SSH on TrueNAS), port the same edits into the Mac `web_three` checkout, `git add`/`commit`/`git push` from the Mac (push from the Mac always — TrueNAS host has no `git-lfs` on PATH and its pre-push hook aborts).

The deploy itself is **user-run**: no passwordless SSH key to `alan@192.168.178.146` exists from the Mac (`Permission denied (publickey)`), and the scripts prompt interactively for SSH + sudo passwords. Because `licensing-server/products.js` + `server.js` change, it needs the **full** deploy, not frontend-only:

```bash
cd /Users/alan/_localDEV/web_three && bash deploy.sh
```

(`bash deploy.sh` = frontend + backend; `npm run deploy:fast` / `bash deploy.sh --frontend-only` would miss the `licensing-server` changes.) It self-verifies `website-api`, `licensing-server`, and `/licensing/health` before exiting 0.

### Step 5 — verify the loop is closed

`curl -I https://alan-design.com` (expect `HTTP/2 200`), `curl -s https://alan-design.com/licensing/health` (expect `{"status":"active"}`), and confirm the storefront download's size/date matches the new `Framecraft_<version>_aarch64.dmg`. App Store side: the build appears in App Store Connect after processing, then Add for Review → Submit.

### Separate, unchanged: the updater manifest

The in-app auto-updater's Ed25519 signing (`TAURI_SIGNING_PRIVATE_KEY_PATH`, `releases-meta/framecraft.json`) is **not** something Store Manager knows about or manages — it's its own step. Note `scripts/deploy_direct_macos.sh` as configured does **not** emit a `.dmg.sig` (the direct config produces no updater artifacts) and this repo has no `releases-meta/` tree; if a release needs an updater-manifest bump, that is still a manual step done as before. `secrets/framecraft-updater.key` is gitignored and hand-copied only — never paste it into chat or email.

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

## App icon generation

The icon has **two representations** that must be regenerated together whenever it changes:

**1. Classic set (`src-tauri/icons/*`) — Windows, and macOS < 26.** Generated from the flat 1024 raster `src/assets/icon/framecraft.png` (the light/Default appearance):

- `npx tauri icon src/assets/icon/framecraft.png -o src-tauri/icons` writes the full desktop set (icns/ico/PNGs/Windows `Square*Logo` tiles) in one step — but it also writes `ios/` and `android/` subfolders this desktop-only project doesn't use and a stray `64x64.png` not referenced by `tauri.conf.json`; delete those three after running it. Cross-check against `tauri.conf.json`'s `bundle.icon` array (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`).
- **The flat raster (`framecraft.png`) and any hand-built PNG must fill the canvas edge-to-edge — no transparent margin.** Recurring past mistake: insetting the already-squircle art produces a grey Dock/Finder border. `sips -g pixelWidth -g pixelHeight -g hasAlpha <file>` + eyeball all four edges before regenerating. (This does **not** apply to the `.icon` bundle below — Icon Composer owns the mask there, and its exports legitimately have transparent corners.)
- Windows has no light/dark icon variants — the `.ico` is always the Default appearance. That's expected, not a gap.

**2. Appearance-aware `Assets.car` (`src-tauri/icons/Assets.car`) — macOS 26+ light / dark / tinted Dock icon.** Tauri only bundles a single-appearance `.icns`, so this is a separate compiled artifact:

- Source: `src/assets/icon/AppIcon.icon/` — an Icon Composer document (vendored from Marketing's `01_Icons/ICONS.icon`). Layered (`icon.json` + `Assets/framecraft.svg`); Icon Composer derives dark/tinted automatically from the one definition.
- `bash scripts/build_appicon_assets.sh` runs `actool` (Xcode 26+) on it → `src-tauri/icons/Assets.car` (contains `NSAppearanceNameAqua` / `NSAppearanceNameDarkAqua` / `ISAppearanceTintable` stacks) and refreshes `icon.icns` to match the light rendering. **Commit both outputs** — the Windows build machine has no `actool` and uses the committed `Assets.car` as-is.
- Wired in without touching the deploy scripts: `bundle.macOS.files` in `tauri.conf.json` copies `icons/Assets.car` to `Contents/Resources/Assets.car` *before* `tauri build` signs the app, and `src-tauri/Info.plist` sets `CFBundleIconName = AppIcon`. macOS 26 prefers that; older macOS ignores it and uses `CFBundleIconFile` (`icon.icns`).
- The current Icon Composer exports are iOS-proportioned (squircle fills more of the frame than a standard macOS icon), so the Dock icon sits slightly larger than neighbouring Mac apps. Acceptable for now; a macOS-appearance export from Icon Composer, or ~10% padding on `icon.icns` only, would normalize it.

**Manual fallbacks** (classic set only): `sips` for PNG resizing (built-in); `iconutil` for `.icns` — iconset names **must** be `icon_16x16.png` not `icon_16.png`; Python `struct` for `.ico` — Pillow's `ICO` save produces a broken 574-byte file, write the header manually.

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
