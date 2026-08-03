---
title: Architecture
description: Framecraft application architecture and module boundaries.
---

# Architecture

Framecraft is a Tauri 2 desktop application: a Rust backend for the OS shell and local SQLite access, a React frontend for the UI, and no server component of its own.

## Stack

- **Runtime:** Tauri 2 (`tauri-plugin-sql` for SQLite, `tauri-plugin-fs` for file access, `tauri-plugin-dialog`, `tauri-plugin-opener`, `tauri-plugin-http`)
- **Frontend:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS v4 (CSS-first `@theme` directive via `@tailwindcss/vite`)
- **State:** Zustand + TanStack Query
- **Routing:** React Router
- **Forms:** React Hook Form + Zod
- **Backend crates:** `rusqlite` for direct SQLite access alongside `tauri-plugin-sql`, `reqwest` (rustls) for calling AI provider APIs, `serde`/`serde_json` for the app's JSON-shaped columns

## Dev-mode Guard

Every database call is gated on a runtime check for the Tauri context:

```ts
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
```

Outside Tauri (`vite dev` in a browser, or the Vitest test runner), the app falls back to in-memory `_dev*` stores. This means the full test suite runs without any Tauri dependency or a real SQLite file.

## Storage Model

Each Framecraft library is a **portable SQLite file** — there is no shared backend database. A library can live on local disk or on a NAS/SMB share, and multiple machines can point at the same shared library file. This local-first model is a deliberate constraint: it keeps a creative's prompt history and ratings entirely under their own control, and it's why cross-library intelligence (see [Application Intelligence](/framecraft/technical/application-intelligence/)) was explicitly scoped out rather than built as a hosted store.

NAS-hosted libraries have a known failure mode where a stale WAL-mode header (present without its `.wal`/`.shm` sidecar files) makes SQLite report `unable to open database file` even though the file is otherwise readable and writable over SMB. The backend detects and repairs this automatically: it backs up the database, converts a local temp copy to `journal_mode=DELETE`, runs `PRAGMA integrity_check`, and copies the repaired file back.

## Provider Integration

Framecraft does not generate images or video itself. It assembles a paste-ready or API-ready prompt and, for providers with a chat-completion API (used for prompt drafting, critique, and analysis rather than image generation), calls out directly over `https`. The Tauri CSP's `connect-src` is scoped to the specific AI provider endpoints in use — see [Privacy Policy](/framecraft/legal/privacy-policy/) for what that means for your data.

## Security Constraints

The Tauri Content-Security-Policy restricts script and style sources to the app bundle itself (`script-src 'self'`), and scopes `img-src`/`media-src` to include the Tauri asset protocol (`asset:`, `https://asset.localhost`, `tauri://localhost`) so images and video stored on disk can render inside the webview. Filesystem capabilities in `capabilities/default.json` use the Tauri v2 permission names (`fs:read-all`, `fs:allow-appdata-read-recursive`, `fs:allow-appdata-write-recursive`, `fs:allow-write-file`) rather than the older v1-style names — a capability change that uses the wrong name fails at `cargo check`, not silently at runtime.

## Reliability Philosophy

Framecraft is a working creative tool, not a system with hard uptime requirements — but data loss (a lost rating, a corrupted library, a silently-broken migration) is treated as a real failure. Every SQLite migration must be registered in multiple places for a portable library to actually carry it (see [Data Model](/framecraft/technical/data-model/)), and that registration is enforced by `cargo test`, not just `cargo check`, because the compiler has no way to know a table registration list is incomplete.
