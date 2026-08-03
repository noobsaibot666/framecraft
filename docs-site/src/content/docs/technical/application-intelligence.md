---
title: Application Intelligence
description: How Framecraft's usage-learning subsystems are wired, and how to extend them.
---

# Application Intelligence

Application Intelligence is a cross-cutting map of every subsystem in Framecraft that learns from usage — ratings, imports, comparisons, decisions — and feeds it back into the app. It isn't a single page; it's an architectural concern that spans Prompt Craft, the Dashboard, Comparison Lab, and several library modules.

`src/lib/intelligenceEngine.ts` is the required entry point for new "learns from usage" features. It's a **facade** over the underlying storage modules (`memoryEngine.ts`, `tokenPatterns.ts`, `referenceImpact.ts`, `inconsistencyIntelligence.ts`, `db.ts`'s avoidance-pattern functions) — not a replacement for them. What's unified is the code path pages call through, not the data itself: each portable library keeps its own learned scores in its own SQLite file, exactly as self-contained as before. Cross-library intelligence was explicitly considered and rejected, to preserve the NAS-portable-library model described in [Data Model](/framecraft/technical/data-model/).

## Vocabulary

- **WIRED** — a real trigger → compute → store → consumer loop, with all four steps confirmed.
- **ISOLATED** — computes and stores, but nothing downstream reads it, or it reads real data while sharing no storage/scoring with anything else.
- **STATIC** — deterministic/rule-based, with no memory of past usage even if it looks adaptive.
- **SPLIT** — part of the loop is wired, part is a dead end.

## Confirmed Subsystems

- **Token quality scoring — WIRED.** Saving a scored result runs `scoreToQualityDelta()` → `updateTokenQualityFromResult()` + `updateCoOccurrences()`, updating `tokens.quality_score` and the `token_patterns` co-occurrence table. Editing an existing result's score applies only the *net* delta between old and new — not the new delta on its own — so a token's quality can't be farmed upward by repeatedly re-saving the same result. Read by the Dashboard's Proven/Winner Tokens, the Token Cloud, Token Detail, `recommendTokens`, and Prompt Craft's proven-combinations hint.
- **Reference impact scoring — WIRED, unified formula.** `computeImpactScore()` weights 60% on results a reference was directly linked to that won, 40% on projects it's attached to whose prompts won. The Reference Library, Reference Detail, and Prompt Craft's Impact Refs panel all call the same function, so scores can't disagree between screens.
- **Recommendations engine — WIRED (aggregator, not a hub).** Seven independent scorers (tokens, prompts, recipes, SREFs, profiles, references, avoidance) each run their own SQL. A 30-second, 32-entry bounded cache is invalidated from 30+ mutation sites across the codebase, with a dedicated wiring test asserting every mutator calls `invalidateRecommendationCache()`.
- **Recurring inconsistency conflicts — WIRED.** A static keyword rule set fires against the live draft in Prompt Craft; each firing, dismissal, or correction is recorded. Once a specific conflict recurs twice or more, it's promoted into a personal "watch out for" entry alongside the seeded avoidance patterns.
- **Comparison decisions — WIRED.** Clicking Apply in the Comparison Lab writes winner/failed status back to results, then recomputes every touched prompt's summary — closing a real gap where only the result-level flag updated, never the prompt-level one. Saving an AI decision as a session outcome turns its `avoid[]` list into deduplicated, learned avoidance-pattern rows.
- **Avoidance patterns — WIRED (a real bug was fixed here).** The recommendation query originally filtered avoidance patterns' artifact-defect category against a prompt's *content* category — two unrelated taxonomies that could never match, so the built-in seeded patterns never surfaced. Fixed to filter on provider instead, which genuinely shares a vocabulary on both sides.
- **Provider success formulas — WIRED, per-library.** Learned from pasted imports that demonstrate at least three recognized structural steps, and stored in a `learned_formulas` table rather than browser `localStorage`, so they travel with the portable library.
- **AI-look risk score — STATIC.** Pure keyword-trigger matching; used only as a minor tiebreaker in prompt recommendations, and never learns from whether high-risk prompts actually failed more often in practice.
- **Duplicate detection — STATIC.** Jaccard token-overlap similarity computed fresh on every draft change; no memory of which suggested duplicates were accepted or dismissed.
- **Import learning — STATIC.** One-shot regex/keyword extraction per pasted prompt; nothing aggregates across imports.
- **Project Assistant — deliberately bypasses the intelligence tables.** It queries prompts/results/references/deliverables/comparisons directly and recomputes deterministic suggestions from raw counts every time. Its only link to the rest of this system is reading comparison outcome summaries as prose context for its own LLM calls.

## Extending Application Intelligence

1. Start in `intelligenceEngine.ts` — add a new orchestration function, or extend an existing one, rather than wiring library calls inline in a page component.
2. Name the exact trigger (the user action that should fire it) before writing code. If the underlying data can be edited more than once (a score, a rating), design for the re-edit case up front, not just the first write.
3. Check the subsystems above for something that already answers a similar question before adding a parallel implementation.
4. Prefer writing into an existing table/loop over inventing a new one. A genuinely new table still needs the four-point `library_package.rs` registration described in [Data Model](/framecraft/technical/data-model/).
5. If the change mutates a table the recommendations engine reads, call `invalidateRecommendationCache()`.
6. Trace all four steps — trigger, compute, store, consumer — before calling a feature done. A feature that computes and stores but that nothing reads is the most common failure mode here.
