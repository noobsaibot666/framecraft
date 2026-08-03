---
title: Roadmap
description: Current Framecraft release scope and direction.
---

# Roadmap

## Current Release Scope

Framecraft 0.x is a local-first Tauri 2 desktop app (macOS primary, Windows via a dedicated deploy path) covering the full prompt-production loop:

- Prompt Craft — builder and manual authoring, provider-specific parameters, provider success formulas, AI-look risk detection, consistency locking
- Token Library — a learning token cloud, proven combinations, and per-token detail/usage stats
- Recipes — reusable, slot-based prompt templates, importable/exportable as JSON
- References and Results — visual input material and generated-output review, linked back to the prompts and results they influenced
- Generation Queue — a staging area between "prompt ready" and "result imported"
- Comparison Lab — seven judged comparison types with AI-assisted decisions that write back to winner/failed status
- Projects — briefs, Direction Studio, Storytelling (shot-by-shot storyboards), Creative Director Mode, campaigns, kanban board, export
- Cinema Studio — an independent script-to-shot-list pre-production pipeline for video productions, separate from the image-ad project workflow
- Application Intelligence — a unified entry point (`intelligenceEngine.ts`) for every subsystem that learns from usage: token quality scoring, reference impact, recurring inconsistency conflicts, comparison decisions, provider success formulas

## Near-Term Priorities

- Close remaining `library_package.rs` registration gaps as new standalone tables are added — this class of bug (a migration that runs in `lib.rs` but is missing from the four `library_package.rs` registration points) has caused real production incidents and is guarded by `cargo test`, not `cargo check`
- Extend video-specific field modeling now that Cinema Studio and video providers (Kling, Seedance) are first-class, rather than only gating fields for image providers
- Continue folding isolated or static signals (AI-look risk, duplicate detection, import learning) into the wired intelligence loop where a real trigger → compute → store → consumer path is worth building
- Windows packaging hardening via the `windows:rc` gated build script (test → typecheck → build → `cargo check` → `cargo test` → installer)

## Longer-Term Direction

- Deeper cross-library intelligence tooling within the existing per-library-SQLite model (no cross-library store is planned — that was evaluated and explicitly rejected to preserve the NAS-portable-library design)
- Broader provider coverage as new image/video model APIs stabilize, following the same provider-formula and provider-hint pattern already in place
- Continued design-system discipline as the surface area grows — Tailwind canonical classes, the Nothing OS–inspired monochrome language, and red reserved strictly as a signal color
