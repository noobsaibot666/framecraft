# Application Intelligence

Not a single page — this is a cross-cutting map of every subsystem in Framecraft that learns from usage (ratings, imports, comparisons, decisions) and feeds it back into the app.

An initial audit of this codebase found no unified module — every subsystem queried raw SQLite directly, two implementations quietly disagreed on the same question, one signal was computed and thrown away, and one tracked metric was never read. `src/lib/intelligenceEngine.ts` now exists as the single entry point pages call through: it's a facade over the underlying storage modules (`memoryEngine.ts`, `tokenPatterns.ts`, `referenceImpact.ts`, `inconsistencyIntelligence.ts`, `db.ts`'s avoidance-pattern functions), not a replacement for them. **What's unified is the code path, not the data** — by explicit decision, each portable library keeps its own learned scores in its own SQLite file, exactly as self-contained as before. There is no cross-library store.

Use this doc before adding a new "intelligence" feature — to find whether something similar already exists, and to know exactly where a new loop needs to close (trigger → compute → store → consumer) to actually be real. New work should add to or extend `intelligenceEngine.ts` rather than wiring lib calls inline in page components.

**Vocabulary used below:**
- **WIRED** — real trigger → compute → store → consumer loop, all four steps confirmed.
- **ISOLATED** — computes/stores but nothing downstream reads it, or reads real data but shares no storage/scoring with anything else.
- **STATIC** — deterministic/rule-based; no memory of past usage even if it looks adaptive.
- **SPLIT** — part of the loop is wired, part is a dead end.

---

## The engine — `src/lib/intelligenceEngine.ts`

Four orchestration functions today, each replacing what used to be 2-3 lib calls hand-wired inline in a page component:

- **`recordResultOutcome(promptText, scoreOverall, isFailed)`** — called once from `ResultReview.tsx` on save (a *new* result). Internally runs `scoreToQualityDelta()` → `updateTokenQualityFromResult()` + `updateCoOccurrences()` (see Token Quality Scoring below). Previously these were three separate fire-and-forget calls inlined in the page.
- **`recordResultRescore(promptText, oldScore, oldIsFailed, newScore, newIsFailed)`** — called from `ResultDetail.tsx` on save (editing an *existing* result). Applies only the *net* delta between the old and new score's quality delta — not the new delta on its own, which would re-add the full amount on every re-save and let a token's quality be farmed upward by repeatedly saving. A no-op when the score didn't actually change.
- **`recordComparisonApply(promptIds)`** — called from `ComparisonLab.tsx`'s Apply flow, right after `syncDecisionsToResults()`. Recomputes every touched prompt's summary via the existing `recomputePromptResultSummary()` (the same function every other result-mutation flow already calls) — closes the gap where Apply updated `results.is_winner` but never `prompts.is_winner`.
- **`recordComparisonLesson(decision)`** — called from `ComparisonLab.tsx`'s "Save as Outcome" flow. Turns a saved AI decision's `avoid[]` array into deduped `avoidance_patterns` rows (`is_builtin = 0`) via the existing `createAvoidancePattern()`, so the AI's judgment about what to avoid actually resurfaces later instead of living only in a text blob (see Comparison Decisions below).

---

## Token Quality Scoring — WIRED

The most complete loop in the app, now behind `intelligenceEngine.recordResultOutcome()`.

- **Trigger** — saving a scored result. `ResultReview.tsx` (Add Result flow), on save, fires (non-blocking) `recordResultOutcome(prompt.prompt_text, scores.overall, isFailed)`, which internally runs:
  - `scoreToQualityDelta(scoreOverall, isFailed)` — `memoryEngine.ts`
  - `updateTokenQualityFromResult(promptText, delta)` — `db.ts`
  - `updateCoOccurrences(promptText, scoreOverall)` — `tokenPatterns.ts`
- **Storage** — `tokens.quality_score` / `tokens.use_count` (substring-matched UPDATE against the prompt text); `token_patterns` table, upserted with a running average per token pair (`token_a_id`, `token_b_id`, `co_occurrence_count`, `avg_rating`).
- **Consumers**:
  - Dashboard — "Proven Tokens" (`quality_score > 0.15`) and "Winner Tokens" (joins `prompt_tokens` ↔ `prompts.is_winner`)
  - Token Cloud — pill highlighting (`quality_score > 0.3` positive, `< -0.05` negative)
  - Token Detail — per-token quality + partner combos, plus a library-wide "Top Patterns" card
  - `recommendations.ts:recommendTokens` — ranks by `quality_score` + recurrence bonus, surfaces in the Recommendation Panel's "Proven Tokens"
  - Prompt Craft's sequence builder — "proven combinations" hint pulls `getProvenCombos()`
- **Every write invalidates the recommendation cache** (`invalidateRecommendationCache()`).
- **Now also covers re-scoring** — `ResultDetail.tsx` (editing an existing result) calls `intelligenceEngine.recordResultRescore()`, which applies only the net delta between the old and new score. Previously this path fired nothing at all; a naive fix that called `recordResultOutcome()` again here would have double-counted on every re-save (and every unrelated edit — notes, artifacts), since re-saving with the same score would keep re-adding the full delta. `recordResultRescore` guards against both: no-op when the score is unchanged, and applies the difference (`scoreToQualityDelta(new) - scoreToQualityDelta(old)`), not the new value's delta in isolation. Co-occurrence patterns (`updateCoOccurrences`) still just re-run against the corrected score on change — that function is a running average, not a delta accumulator, so a re-score is a real additional data point but not a perfectly-weighted "undo the old value, apply the new one." Documented limitation, not silently ignored.

---

## Reference Impact Scoring — WIRED, unified formula

- **Signal** — `referenceImpact.ts`: `getHighImpactReferences()` / `getReferenceImpactScore()`, both now built on an exported `computeImpactScore(resultWins, resultAppearances, projectWins, projectCount)` plus exported `RESULT_IMPACT_WEIGHT`/`PROJECT_IMPACT_WEIGHT` constants (60/40) — the composite math used to be duplicated inline in each function; now there's one implementation.
- **Consumers** — Reference Library (badges the whole grid), Reference Detail (per-item score), Prompt Craft's "Impact Refs" panel (project-scoped) — all three call the *same* function, so they agree with each other.
- **`recommendations.ts:recommendReferences`** is still a separate query (its own filtering needs: category/tag matching, a direct `prompt_references` signal `referenceImpact.ts` doesn't have) — a full merge into one function remains undone, since the two answer genuinely different-shaped questions (global impact badge vs. context-filtered recommendation). What's fixed: `recommendReferences` now imports `RESULT_IMPACT_WEIGHT`/`PROJECT_IMPACT_WEIGHT` and interpolates them directly into its own SQL's `ORDER BY` (an `impact_score` expression computed the identical way, in SQL, since the ranking needs to happen inside the same query), replacing the old raw-unweighted-counts ordering. A reference can no longer rank differently between the Reference Library and the Recommendation Panel — the formula is shared even though the queries aren't.

---

## Recommendations Engine — WIRED (aggregator + cache, not a hub)

`recommendations.ts` is the closest thing to a central module, but it's a query aggregator, not a shared scoring layer other subsystems feed through.

- `getRecommendations(ctx)` fires 7 independent scorers in parallel, each with its own bespoke SQL against raw tables:
  - `recommendTokens`, `recommendPrompts`, `recommendRecipes`, `recommendSREFs`, `recommendProfiles`, `recommendReferences`, `recommendAvoidance`
- The only cross-module import is `getTopConsistencyConflicts` from `inconsistencyIntelligence.ts` (feeds `recommendAvoidance`).
- **SREF and Profile suggestions** are real learned signals, not hardcoded — they blend catalog rating with usage mined from `prompts.style_ref` / `prompts.parameters.profile` JSON, with a winner-boost.
- **Cache**: 30s TTL, 32-entry bounded async cache. `invalidateRecommendationCache()` is called from 30+ sites across `db.ts`, `references.ts`, and `promptTransfer.ts` — every mutation on a table the recommender reads. There is a dedicated test (`recommendationInvalidationWiring.test.ts`) asserting every mutator calls it. **This part is disciplined** — follow the same pattern for any new mutator.
- **Consumers** — `RecommendationPanel.tsx` (all 7 sections), `CodeSuggestField.tsx` (inline SREF/Profile suggestions), embedded in Prompt Craft.

---

## Recurring Inconsistency Conflicts — WIRED

The one subsystem the codebase's own comments explicitly label "App Intelligence" (`tokenConsistency.ts`).

- **Trigger** — a static keyword rule (`CONSISTENCY_RULES`) fires against the live draft in Prompt Craft. The Avoidance Panel calls `recordConsistencyEvent()` when a rule fires, is dismissed, or is corrected.
- **Storage** — `inconsistency_events` table (`rule_id`, `rule_label`, `suggestion`, `prompt_id`, `provider`, `action`).
- **Consumers**:
  - `getAllConsistencyRuleCounts()` — Prompt Craft shows "seen N times before" inline
  - `getTopConsistencyConflicts(limit)` — once a conflict recurs ≥2×, it's promoted into a personal "WATCH OUT FOR" entry in `recommendAvoidance`, modeled the same way as the static seed `avoidance_patterns` rows
- **Caveat** — the detection *rules* themselves (`CONSISTENCY_RULES`, `avoidanceEngine.ts` `TRIGGERS`) are 100% static/hardcoded. Only the *frequency counting* on top of them is learned.

---

## Comparison Decisions — WIRED (was SPLIT)

`ComparisonLab.tsx` + `comparisonDecision.ts` + `comparisons.ts` + `intelligenceEngine.ts`.

- **Qualitative half — now WIRED.** `generateComparisonDecision()` is still a single LLM call with no DB access of its own — that part is unchanged. What changed: saving the decision as the session outcome (`handleSaveDecisionOutcome`) now also calls `intelligenceEngine.recordComparisonLesson(decision)`, which inserts each distinct `decision.avoid[]` item as an `avoidance_patterns` row with `is_builtin = 0` (deduped, case-insensitive, against existing learned rows), `correction_prompt` filled from `decision.reuse[]`/`why_stronger`. These rows flow straight into `recommendAvoidance` (see below) — no new table, reusing the same column (`is_builtin`) that was already in the schema and already unused at runtime. The full outcome text is still also saved to `comparison_sessions.outcome_summary` as before, and is still what the Project Assistant reads as prose context — the fix adds a structured path alongside it, it doesn't replace the text.
- **Quantitative half — now fully WIRED.** Clicking **Apply** calls `syncDecisionsToResults(sessionId)` (`UPDATE results SET is_winner = …, is_failed = … WHERE id IN (…)`) exactly as before, then now also calls `intelligenceEngine.recordComparisonApply(promptIds)` for every prompt touched by the applied slots — which calls the existing `recomputePromptResultSummary()` per prompt. This closes the old gap: previously only `results.is_winner` updated on Apply, never `prompts.is_winner`, so `dashboardHealth.winnerTokens` and the prompt-level winner-boosts in `recommendTokens`/`recommendSREFs` never reacted to an applied comparison decision. They do now, via the same summary-recompute path every other result mutation already uses. `invalidateRecommendationCache()` still isn't called directly on Apply, but `recomputePromptResultSummary()` → `updatePrompt()` already calls it internally, so the cache does get invalidated as a side effect.

---

## Provider Success Formulas — WIRED, now per-library

`promptFormula.ts` + migration 035 (`learned_formulas` table).

- **Trigger** — `learnFormulaFromImport(text, provider)`, called from Manual Import on paste, when the pasted prompt demonstrates ≥3 recognized structural steps (`STEP_SIGNALS` keyword detection).
- **Storage** — moved off browser `localStorage["framecraft_learned_formulas_v1"]` onto `learned_formulas` (`provider TEXT PRIMARY KEY, steps TEXT, updated_at TEXT`), so learned formulas now travel with the portable library like everything else in the app.
- **Why it's still synchronous** — every call site (`CraftPrompt.tsx` ×6, `ManualImport.tsx`, `describeFormula.ts`, `assistant.ts`) calls `getFormulaForProvider()` synchronously, several from `useState` initializers where an async signature isn't an option. Rather than making the whole call chain async (a much larger, riskier change), the module keeps an in-memory cache as the source of truth: hydrated from SQLite once on module load (`ensureHydrated()`, fire-and-forget, guards against clobbering anything already learned this session), and written through on every `learnFormulaFromImport()` call (`persistLearned()`, fire-and-forget, same pattern as every other non-critical mutator in this codebase). The synchronous API surface didn't change; only what backs it did.
- **Consumers** — `getFormulaForProvider()` powers Prompt Craft's Formula Bar (multiple call sites) and is pulled into the Project Assistant's context via `formatFormulaForAI()`.
- **Migration registration** — a brand-new standalone table needs 4 separate spots in `src-tauri/src/library_package.rs` beyond the `lib.rs` migration list, or it silently won't exist in freshly-created or repaired/merged libraries: `REQUIRED_RELEASE_TABLES`, `migration_sql()`, the inline `CREATE TABLE` in `upgrade_supported_release_schema`, and a `MergeTableSpec` in `MERGE_MANIFEST` (identity `TargetOwned(&["provider"])`, matching `app_meta`'s pattern for a natural-key singleton-per-key table) — plus a `complete_graph_identity()` match arm and a fixture row for the merge round-trip test. See CLAUDE.md's SQLite migration rules section; this has caused two real production incidents before when missed.
- **Test isolation** — the in-memory cache is a module-level singleton, so tests need `resetLearnedFormulaCacheForTests()` (exported for exactly this) in `beforeEach`, mirroring `dbConnection.ts`'s existing `resetFramecraftDbConnectionForTests()` convention. The old `localStorage` mock in `promptFormula.test.ts` is gone — nothing in the implementation touches `localStorage` anymore.

---

## AI-Look Risk Score — STATIC

`avoidanceEngine.ts`: `detectRisks()` / `calculateRiskScore()` — pure keyword-trigger matching against hardcoded `TRIGGERS` per artifact type. Recomputed identically every time from the current draft text; never learns from whether high-risk prompts actually failed more often in practice (`results.artifacts`).

- **Consumer** — `recommendPrompts` uses `ai_look_risk ASC` as a **final tiebreaker only**. A real but minor downstream use of a score that itself never adapts.

---

## Recipe Use Count — WIRED (was a dead end)

- **Trigger** — applying a recipe (`RecipeApply.tsx`) calls `incrementRecipeUseCount()`.
- **Storage** — `prompts.recipe_use_count`.
- **Consumers** — Recipe Library shows "N× applied." `recommendRecipes()` now also orders by `win_count`, `avg_score`, `rating`, `reuse_potential`, **`recipe_use_count`** (added as the final tiebreaker), and its reason text now reports "Applied N times" when a recipe has use history but no wins/high rating yet. A frequently-applied recipe finally outranks an equally-rated but unused one.

---

## Avoidance Patterns — WIRED (bug fixed)

`avoidance_patterns` table, read by `recommendations.ts:recommendAvoidance`.

- **The bug found during the intelligence audit**: `recommendAvoidance` filtered `avoidance_patterns.category` against `ctx.category` — but these are two unrelated taxonomies. `avoidance_patterns.category` is an artifact-defect grouping (`texture`, `anatomy`, `lighting`, `optical`, …, seeded by `003_meta.sql`); `ctx.category` is a prompt content category (`advertising`, `fashion`, `product`, …). No seeded row's category ever equals a prompt category, and none of the 16 seed rows use the literal string `'all'` either — so the entire built-in seed set was invisible to recommendations. The only avoidance patterns that ever surfaced were ones manually added through `db.ts`'s `createAvoidancePattern()`, which hardcodes `category = 'all'` (one of the two OR-matched conditions), so those did show up.
- **Fix** — dropped the category comparison (the two vocabularies were never comparable) and filtered on `ap.provider IS NULL OR ap.provider = ctx.provider` instead, since `avoidance_patterns.provider` and `ctx.provider` genuinely share the same AI-provider vocabulary. Rows now order `is_builtin ASC` first (learned/personal patterns surface before generic built-ins), then by severity.
- **Why this mattered for the comparison-decision wiring above**: `intelligenceEngine.recordComparisonLesson()` needed this table's read path fixed, or the rows it writes (also `is_builtin = 0`) would have joined the same silent black hole the built-in seed rows were already sitting in.
- **`is_builtin` column** already existed in the schema (`001_initial.sql`) and was already designed for exactly this (user/learned vs. seeded patterns) — no migration was needed for any of this.

---

## Duplicate Detection — STATIC

`memoryEngine.ts:findSimilarPrompts` — Jaccard token-overlap similarity, computed fresh against every prompt on each draft change in Prompt Craft. No persistence, no memory of which suggested duplicates the user accepted or dismissed. Entirely separate from `recommendPrompts`'s "related prompts" (a different signal: provider/category/win_count SQL) — two unrelated "find similar prompts" algorithms coexist in the app.

---

## Import Learning — STATIC

`importLearning.ts`: `analyzeImportedPromptLearning`, `suggestPromptTags`, `suggestPromptTitle`, `suggestBestUse` — one-shot regex/keyword extraction run once per pasted prompt. Output is baked into that single prompt's `notes` field. Nothing aggregates across imports despite the name — nothing gets smarter with volume here.

---

## Project Assistant — bypasses the intelligence tables

`assistant.ts`: `buildContextPack()` queries `prompts`, `results`, `references`, `deliverables`, `comparisons` directly. It does **not** import `memoryEngine.ts`, `recommendations.ts`, `referenceImpact.ts`, or `tokenPatterns.ts`. `generateSuggestions()` is a deterministic if/else ladder over raw counts (no prompts → "start crafting," no winners marked → "mark your winners," etc.) — genuinely reactive to real data, but recomputed fresh from raw rows every time, not from any learned scoring table.

The only cross-subsystem link: `summarizeComparisonIntelligence()` pulls comparison `outcome_summary` strings into the Assistant's LLM system prompt as prose — this is how Comparison Decisions' qualitative output actually gets reused downstream, but only as unstructured text fed to another LLM call.

Despite being the component most directly named for this concept, the Assistant never touches `tokens.quality_score`, `token_patterns`, or reference impact scores.

---

## What "unified" means here, precisely

`intelligenceEngine.ts` is a real, callable hub now — `ResultReview.tsx`, `ResultDetail.tsx`, and `ComparisonLab.tsx` all route through it instead of orchestrating lib calls inline. But it's worth being precise about what did and didn't change, so the map stays honest:

- It **wraps** `memoryEngine.ts`, `tokenPatterns.ts`, `db.ts`'s mutators — it doesn't replace or merge them. `recommendations.ts` still doesn't import from it; it remains its own aggregator with its own bespoke SQL per scorer (`recommendReferences` and `recommendAvoidance` were edited directly, and `recommendReferences` now imports the weight *constants* from `referenceImpact.ts`, but the query itself still isn't rerouted through a shared function).
- `assistant.ts` (Project Assistant) still doesn't call `intelligenceEngine.ts` or any of the scoring tables — it wasn't touched. Still the one component named for this concept that doesn't participate in it.
- Data storage is **still per-library**: one SQLite file per portable library, no cross-library store — `promptFormula.ts`'s migration onto `learned_formulas` follows the same model, not a global one. Unifying the *code path*, not the data, was the explicit, decided scope — see CLAUDE.md's Application intelligence section for why.
- `recommendations.ts`'s seven scorers are still seven independent SQL queries — that aggregator itself wasn't restructured, only two of its scorers (`recommendReferences`, `recommendAvoidance`, `recommendRecipes`) were fixed in place.

So: real unification of the trigger points that existed as scattered inline orchestration (token learning — both new-result and re-score paths now — and comparison outcomes), three confirmed bugs fixed (the avoidance-pattern category filter, the recipe-use-count dead end, the re-score gap), one formula unified across two call sites (reference impact scoring), and one subsystem moved onto the per-library model it was always supposed to follow (provider formulas). Not a rewrite of the whole map — the Recommendations Engine's aggregator structure and Project Assistant's isolation are both unchanged by design.

---

## Checklist for adding or extending an intelligence feature

1. Start in `src/lib/intelligenceEngine.ts` — add a new orchestration function there, or extend an existing one (`recordResultOutcome`, `recordResultRescore`, `recordComparisonApply`, `recordComparisonLesson`), rather than wiring lib calls inline in a page component.
2. Name the trigger (the exact user action that should fire it) before writing code. If the same underlying data can be edited more than once (a score, a rating), design for the *re-edit* case up front — see `recordResultRescore`'s net-delta approach — not just the first-write case.
3. Check the subsystems above for something that already answers a similar question — extend it rather than adding a parallel implementation.
4. Prefer writing into an existing table/loop (`tokens.quality_score`, `token_patterns`, `inconsistency_events`, `avoidance_patterns` with `is_builtin = 0`, the reference-impact join tables) over inventing a new one. If a genuinely new table is needed, it's still per-library SQLite, not `localStorage` — and needs the 4-spot `library_package.rs` registration described in CLAUDE.md's migration rules, not just the `lib.rs` migration list.
5. If it mutates a table `recommendations.ts` reads, call `invalidateRecommendationCache()` — follow the pattern in `recommendationInvalidationWiring.test.ts`. Reusing an existing mutator (like `createAvoidancePattern`, which already does this) beats writing a new one.
6. Trace all four steps (trigger → compute → store → consumer) before calling it done. A feature that computes and stores but nothing reads is the most common failure mode here.
7. Record the result as WIRED, ISOLATED, STATIC, or SPLIT, and update this doc if it changes the map.
