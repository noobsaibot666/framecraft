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

Three orchestration functions today, each replacing what used to be 2-3 lib calls hand-wired inline in a page component:

- **`recordResultOutcome(promptText, scoreOverall, isFailed)`** — called once from `ResultReview.tsx` on save. Internally runs `scoreToQualityDelta()` → `updateTokenQualityFromResult()` + `updateCoOccurrences()` (see Token Quality Scoring below). Previously these were three separate fire-and-forget calls inlined in the page.
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
- **Known gap, not fixed** — this only fires from the *initial* Add Result save (`ResultReview.tsx`). Editing an existing result's score later in `ResultDetail.tsx` does **not** go through `recordResultOutcome()` — token quality doesn't adjust if you re-rate a result after the fact.

---

## Reference Impact Scoring — WIRED

- **Signal** — `referenceImpact.ts`: `getHighImpactReferences()` / `getReferenceImpactScore()`. Pure read-time aggregation (no cached score column) over `result_references` → `results.is_winner` (60% weight) and `project_references` → `project_prompts` → `prompts.is_winner` (40% weight).
- **Consumers** — Reference Library (badges the whole grid), Reference Detail (per-item score), Prompt Craft's "Impact Refs" panel (project-scoped) — all three call the *same* function, so they agree with each other.
- **`recommendations.ts:recommendReferences`** is a separate query with its own filtering needs (category/tag matching, a direct `prompt_references` signal `referenceImpact.ts` doesn't have) — not a pure duplicate, but it was missing `referenceImpact.ts`'s project-level signal entirely. Fixed: added the same `project_references → project_prompts → prompts.is_winner` join, so a reference attached to a winning project but never directly linked to a prompt is no longer invisible to recommendations.
- **Remaining follow-up**: the two still aren't one function — a full merge is a reasonable next step once both are observed working correctly with today's fix, but wasn't done now to avoid rewriting working filtering/ranking logic under time pressure.

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

## Provider Success Formulas — WIRED, siloed outside SQLite

`promptFormula.ts`.

- **Trigger** — `learnFormulaFromImport(text, provider)`, called from Manual Import on paste, when the pasted prompt demonstrates ≥3 recognized structural steps (`STEP_SIGNALS` keyword detection).
- **Storage** — browser `localStorage["framecraft_learned_formulas_v1"]`. **Not SQLite** — outside the NAS-portable-library backup/sync mechanism the rest of the app's data goes through (see CLAUDE.md's portable SQLite notes). Not backed up, not scoped per-library.
- **Consumers** — `getFormulaForProvider()` powers Prompt Craft's Formula Bar (multiple call sites) and is pulled into the Project Assistant's context via `formatFormulaForAI()`.
- **Note** — this is a real, working learn→store→consume loop; it's just structurally disconnected from everything else, living in a different persistence layer entirely.

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

`intelligenceEngine.ts` is a real, callable hub now — `ResultReview.tsx` and `ComparisonLab.tsx` both route through it instead of orchestrating 2-3 lib calls inline. But it's worth being precise about what did and didn't change, so the map stays honest:

- It **wraps** `memoryEngine.ts`, `tokenPatterns.ts`, `db.ts`'s mutators — it doesn't replace or merge them. `recommendations.ts` still doesn't import from it or from `tokenPatterns.ts`/`referenceImpact.ts`; it remains its own aggregator with its own bespoke SQL per scorer (recommendReferences and recommendAvoidance were edited directly, not rerouted through a shared function).
- `promptFormula.ts` still lives in `localStorage`, structurally cut off from everything else — deliberately out of scope for this pass (see the follow-up note under Provider Success Formulas above).
- `assistant.ts` (Project Assistant) still doesn't call `intelligenceEngine.ts` or any of the scoring tables — it wasn't touched.
- Data storage is **unchanged**: still one SQLite file per portable library, no cross-library store. Unifying the *code path* was the explicit, decided scope — see CLAUDE.md's Application intelligence section for why.

So: real unification of the trigger points that existed as scattered inline orchestration (token learning, comparison outcomes), plus two confirmed bugs fixed (the avoidance-pattern category filter, the recipe-use-count dead end) and one gap closed with a targeted join (reference project-signal). Not a rewrite of the whole map — `recommendations.ts`'s seven scorers are still seven independent SQL queries, and Project Assistant and the formula learner are still their own islands.

---

## Checklist for adding or extending an intelligence feature

1. Start in `src/lib/intelligenceEngine.ts` — add a new orchestration function there, or extend `recordResultOutcome`/`recordComparisonApply`/`recordComparisonLesson`, rather than wiring lib calls inline in a page component.
2. Name the trigger (the exact user action that should fire it) before writing code.
3. Check the subsystems above for something that already answers a similar question — extend it rather than adding a parallel implementation.
4. Prefer writing into an existing table/loop (`tokens.quality_score`, `token_patterns`, `inconsistency_events`, `avoidance_patterns` with `is_builtin = 0`, the reference-impact join tables) over inventing a new one.
5. If it mutates a table `recommendations.ts` reads, call `invalidateRecommendationCache()` — follow the pattern in `recommendationInvalidationWiring.test.ts`. Reusing an existing mutator (like `createAvoidancePattern`, which already does this) beats writing a new one.
6. Trace all four steps (trigger → compute → store → consumer) before calling it done. A feature that computes and stores but nothing reads is the most common failure mode here.
7. Record the result as WIRED, ISOLATED, STATIC, or SPLIT, and update this doc if it changes the map.
