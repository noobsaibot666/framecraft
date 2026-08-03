---
title: Development Setup
description: Local development setup for Framecraft and its documentation.
---

# Development Setup

## Application

From the `framecraft/` repository root:

```bash
npm install
npm run tauri dev
```

This launches the app window directly with hot reload — no installer, no build output.

Run the full checked build (tests, type check, Vite build) with:

```bash
npm run check
```

Individually:

```bash
npm test              # Vitest — pure/in-memory, no Tauri required
npx tsc --noEmit       # Type check
npm run build          # tsc + Vite build
cargo check            # Rust, from src-tauri/
```

`cargo check` must be clean before `npm run tauri build`. `cargo test` (not just `cargo check`) is required to catch a missed portable-library migration registration — see [Data Model](/framecraft/technical/data-model/).

## Documentation

From `framecraft/docs-site/`:

```bash
npm install
npm run dev      # local preview
npm run build     # production build
```

The documentation build output is written to:

```text
docs-site/dist/
```

For the shared docs hub, that output is handed off for placement under:

```text
docs-site/dist/framecraft/
```

Framecraft's own internal dev planning docs (feature specs, superpowers plans) live separately at `framecraft/docs/` — this Astro/Starlight project is `framecraft/docs-site/`, deliberately not built inside `framecraft/docs/`, so the two don't collide or get confused for each other.
