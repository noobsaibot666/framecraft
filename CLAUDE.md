# Framecraft — CLAUDE.md

Local-first Tauri 2 desktop app for AI image/video prompt engineering. React 19 + TypeScript + Vite + SQLite. Primary target: macOS.

---

## SQLite migration rules

**All migrations must be registered in `src-tauri/src/lib.rs`** — there is no auto-discovery. Missing entries = tables never exist in the binary.

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
