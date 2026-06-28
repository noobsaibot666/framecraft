# Framecraft — Windows Deploy Guide

## Prerequisites (one-time setup)

Install these in order before your first build:

1. **Git** — https://git-scm.com/download/win
2. **Node.js 20 LTS** — https://nodejs.org (includes npm)
3. **Rust** — https://rustup.rs (installs `rustc` + `cargo`)
4. **WebView2 Runtime** — usually already present on Windows 11; if not: https://developer.microsoft.com/en-us/microsoft-edge/webview2/
5. **Visual Studio Build Tools** — needed by Rust for Windows linking
   - Download: https://visualstudio.microsoft.com/visual-cpp-build-tools/
   - Select workload: **Desktop development with C++**

Verify everything is installed (open a new terminal after installs):

```powershell
git --version
node --version
npm --version
cargo --version
```

---

## Pull latest and run dev build

```powershell
# Clone (first time only)
git clone https://github.com/noobsaibot666/framecraft.git
cd framecraft

# Or — pull latest if already cloned
cd framecraft
git pull origin main

# Install JS dependencies
npm install

# Launch in dev mode (hot reload, no installer needed)
npm run tauri dev
```

Dev mode opens the app window directly. No installer, no build output — use this for testing.

---

## Production build (creates .exe installer)

```powershell
cd framecraft
git pull origin main
npm install
npm run tauri:build
```

Output will be at:

```
src-tauri/target/release/bundle/msi/Framecraft_0.1.0_x64_en-US.msi
src-tauri/target/release/bundle/nsis/Framecraft_0.1.0_x64-setup.exe
```

Run either installer to install the app system-wide.

---

## Updating an existing install

```powershell
cd framecraft
git pull origin main
npm install
npm run tauri:build
```

Then run the new installer — it will overwrite the previous version. The SQLite database lives in `%APPDATA%\com.alan.framecraft\` and is not touched by reinstalls.

---

## Quick reference

| Task | Command |
|------|---------|
| Pull latest | `git pull origin main` |
| Install JS deps | `npm install` |
| Dev mode (no build) | `npm run tauri dev` |
| Production build | `npm run tauri:build` |
| Run tests | `npm test` |
| Type check | `npx tsc --noEmit` |

---

## Notes

- First `cargo` build takes 5–10 min — Rust compiles all dependencies from scratch. Subsequent builds are fast.
- The app database is stored per-user in `%APPDATA%\com.alan.framecraft\` — never deleted by reinstalls.
- If the build fails with a linker error, confirm Visual Studio Build Tools are installed and restart the terminal.
- Tailwind v4 runs through Vite — no `npx tailwindcss` step needed.
