---
title: Data Model
description: Framecraft's SQLite schema, migrations, and portable-library registration rules.
---

# Data Model

Framecraft's schema is entirely SQLite, versioned as a sequential set of numbered migrations (currently past migration 035). Core entity groups:

- **Prompts** — the authored text/structured record, with versioning (editing forks a new version), builder-mode fields (subject/environment/mood/realism/variation) persisted as `builder_state` JSON, and provider-specific `parameters`
- **Tokens** — the vocabulary extracted from and reused across prompts, with `quality_score` and `use_count` driven by result outcomes, plus `token_patterns` (co-occurrence pairs)
- **Results** — generated outputs linked to a prompt version, carrying `is_winner`/`is_failed` flags and a multi-dimension score (realism, brand fit, composition, lighting, AI-look risk, reuse potential)
- **References** — visual input material, linked to the prompts/results they influenced via a typed role (style, composition, lighting, product, character, frame, failure-example)
- **Recipes** — slot-based prompt templates (`recipe_use_count` tracks reuse)
- **Projects** — briefs, creative directions, shot sequences (`shot_sequence`), storyboards (`direction_storyboards`), and `creative_strategy` JSON (Creative Director Mode)
- **Campaigns** — a grouping entity above projects
- **Comparison sessions** — typed comparison sessions, slots, and outcomes
- **Avoidance patterns** — both built-in seeded rows and learned rows (`is_builtin = 0`) written from comparison decisions
- **Inconsistency events** — recorded firings of the static consistency-rule detector, used to promote recurring conflicts into personal avoidance entries
- **Learned formulas** — per-provider prompt-structure formulas learned from pasted imports

Cinema Studio uses its own, largely independent set of tables — projects, script versions, folders, assets, scenes, and shots — reflecting that it's a separate subsystem from the image-ad project workflow rather than an extension of it.

## Migration Registration Rules

**All migrations must be registered in `src-tauri/src/lib.rs`.** There is no auto-discovery — a missing entry means the table never exists in the compiled binary.

**A new standalone table needs four separate registrations in `src-tauri/src/library_package.rs`** beyond the `lib.rs` migration list, or it silently won't exist in freshly-created or repaired/merged portable libraries even though the main migration ran fine against a normal library:

1. `REQUIRED_RELEASE_TABLES`
2. `migration_sql()` — historically this array has not always been kept in sync with the latest migration; verify what's actually in it rather than assuming it's exhaustive
3. The inline `CREATE TABLE` block in `upgrade_supported_release_schema` (the in-place repair path for pre-existing libraries)
4. A `MergeTableSpec` entry in `MERGE_MANIFEST` (the NAS library merge path), plus a matching `complete_graph_identity()` arm and fixture row if the merge round-trip test is touched

This has caused two real, shipped production incidents from a table that migrated fine in `lib.rs` but was invisible to the merge/repair paths. `cargo test` — not `cargo check` — is what catches a missed registration; the compiler has no way to know the four lists are supposed to agree.

## SQLite Syntax Constraints

- **Never use `(VALUES ...) AS t(col)`** — SQLite rejects this syntax. Use `SELECT ... UNION ALL SELECT ...` instead.
- **`references` is a reserved word** — always quote it as `"references"` in table names, foreign key targets, and index definitions.
- **Don't recreate a table with a different schema in a later migration using `CREATE TABLE IF NOT EXISTS`** — it silently no-ops against the existing table, leaving the old schema in place. Use `DROP TABLE IF EXISTS` first in the later migration, and only when the table is guaranteed empty at that point.

## NAS Portable Library Repair

`src-tauri/src/portable_sqlite.rs`'s `open_portable_database` normalizes a stale WAL-mode header found without its sidecar `.wal`/`.shm` files: it backs the database up under `backups/sqlite-journal-repair-*`, converts a local temp copy to `journal_mode=DELETE`, runs `PRAGMA integrity_check`, and copies the repaired file back into place.
