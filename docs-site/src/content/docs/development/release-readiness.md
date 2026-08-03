---
title: Release Readiness
description: Release validation notes for Framecraft and its documentation.
---

# Release Readiness

Release validation should cover the desktop app, the Rust backend, and the documentation output.

## Desktop App Checks

- `npm test` passes (Vitest, pure/in-memory — no Tauri dependency required)
- `npx tsc --noEmit` is clean
- `cargo check` is clean from `src-tauri/`
- `cargo test` is clean — this is the only thing that catches a portable-library migration missing one of its four `library_package.rs` registrations (see [Data Model](/framecraft/technical/data-model/)); `cargo check` alone will not catch it
- `npm run tauri build` (or `npm run windows:rc` on Windows) produces installers without error
- Any new standalone SQLite table is registered in all four required spots, not just the `lib.rs` migration list

## Documentation Checks

- `docs-site/astro.config.mjs` uses `site: "https://docs.alan-design.com"`
- `docs-site/astro.config.mjs` uses `base: "/framecraft"`
- Every hand-authored absolute link or image in the content (`](/foo)`, `![alt](/screenshots/...)`) includes the `/framecraft/` prefix — Starlight's sidebar navigation auto-prefixes via `base`, but literal markdown body links and images do not
- Verify by grepping the **built HTML output**, not just the source markdown, for any `href="/..."` that isn't `/framecraft/...`
- `npm run build` succeeds from `docs-site/`
- Built output is handed off from `docs-site/dist/` for placement at `docs-site/dist/framecraft/` alongside the other products in the shared docs hub — not deployed to its own separate host or path
