---
title: Windows Deploy Guide
description: Building and deploying Framecraft on Windows.
---

# Windows Deploy Guide

## Prerequisites (One-Time Setup)

Install these in order before your first build:

1. **Git**
2. **Node.js 20 LTS** (includes npm)
3. **Rust** via rustup (installs `rustc` and `cargo`)
4. **WebView2 Runtime** — usually already present on Windows 11
5. **Visual Studio Build Tools** — required by Rust for Windows linking; select the **Desktop development with C++** workload

Verify everything is installed, in a new terminal:

```powershell
git --version
node --version
npm --version
cargo --version
```

## Pull Latest and Deploy (Recommended)

One command pulls the newest code, installs dependencies, runs the full test/typecheck/build gate, and produces the Windows installer:

```powershell
cd framecraft
git pull origin main
npm run windows:rc
```

`windows:rc` runs, in order: `npm ci` → `npm test` → `tsc --noEmit` → `npm run build` → `cargo check` → `cargo test` → `npm run tauri build`, then prints the path to every `.exe`/`.msi` produced under `src-tauri/target/release/bundle`. If any step fails, the script stops there — fix that step before retrying.

Run the printed installer to deploy the new build; it overwrites the previous install. The SQLite database in `%APPDATA%\com.alan.framecraft\` is untouched by reinstalls.

## Dev Build

```powershell
cd framecraft
git pull origin main
npm install
npm run tauri dev
```

Dev mode opens the app window directly with hot reload — no installer, no build output.

## Production Build

```powershell
cd framecraft
git pull origin main
npm install
npm run tauri:build
```

Output:

```text
src-tauri/target/release/bundle/msi/Framecraft_<version>_x64_en-US.msi
src-tauri/target/release/bundle/nsis/Framecraft_<version>_x64-setup.exe
```

## Quick Reference

| Task | Command |
|------|---------|
| Pull latest + full checked build + installer | `git pull origin main && npm run windows:rc` |
| Dev mode (no build) | `npm run tauri dev` |
| Production build (no test/typecheck gate) | `npm run tauri:build` |
| Run tests | `npm test` |
| Type check | `npx tsc --noEmit` |

## Notes

- The first `cargo` build takes 5–10 minutes — Rust compiles all dependencies from scratch. Subsequent builds are fast.
- The app database is stored per-user in `%APPDATA%\com.alan.framecraft\` and is never deleted by reinstalls.
- A linker error on build usually means Visual Studio Build Tools isn't installed, or the terminal needs restarting after install.
- Tailwind v4 runs through Vite — no separate `npx tailwindcss` step is needed.
