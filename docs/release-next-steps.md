# Framecraft — Release Next Steps

**Status (2026-08-04): both platforms are fully built, signed, deployed, and
verified live.** The only thing left in the whole release is Apple's App Review
decision on the Mac App Store submission — nothing actionable left on either
platform below. Kept as a historical runbook.

---

## macOS — what's left

Everything is done except one manual click-through:

1. App Store Connect → your app → the version page → **Build** section → select the
   uploaded build (Delivery UUID `924f280c-bbdc-4fe8-a0de-dcdf52e1285c`) once it's
   finished processing.
2. Confirm the App Privacy questionnaire, age rating, and pricing tier are filled in.
3. **Add for Review** → **Submit to App Review**.

Direct-sale (macOS) is already fully live — notarized DMG on the server, real Stripe
checkout, working auto-updater. Nothing left there.

---

## Windows — direct-sale only (no Microsoft Store)

Matches the same decision already made for Darkwave and CineFlow Suite: **Windows
ships unsigned for now.** No EV code-signing certificate purchase planned — buyers
will see a SmartScreen "unknown publisher" warning on first run, same as the other
two apps' Windows builds. This is a deliberate, already-made call, not an oversight —
don't block the release on it. (The exact signing process, if that ever changes, is
in the "Later: code signing" section at the bottom.)

Run everything below **on the Windows machine**, in PowerShell.

### 1. First-time setup (skip if this machine already builds Framecraft)

Install in order:

1. **Git** — <https://git-scm.com/download/win>
2. **Node.js 20 LTS** — <https://nodejs.org>
3. **Rust** — <https://rustup.rs>
4. **WebView2 Runtime** — usually already on Windows 11; otherwise
   <https://developer.microsoft.com/microsoft-edge/webview2/>
5. **Visual Studio Build Tools** — <https://visualstudio.microsoft.com/visual-cpp-build-tools/>,
   select the **Desktop development with C++** workload

Verify in a fresh terminal: `git --version`, `node --version`, `cargo --version`.

### 2. Clone and pull the code that has the direct-dist work

```powershell
git clone https://github.com/noobsaibot666/framecraft.git
cd framecraft
git pull origin main
npm install
```

This pulls the licensing engine (`src-tauri/src/license.rs`), the `direct-dist`
Cargo feature, and the NSIS-only Windows bundle config — none of that existed on
Windows before this release round.

### 3. Build the direct-sale installer

```powershell
cd framecraft
npx tauri build --features direct-dist --config src-tauri\tauri.direct.conf.json
```

Output lands at:

```
src-tauri\target\release\bundle\nsis\Framecraft_0.1.0_x64-setup.exe
```

(Only NSIS is produced — no `.msi` — because of the `bundle.windows.nsis` config
block added this round.)

If it fails linking, Visual Studio Build Tools didn't install correctly — see
Troubleshooting in `docs-site/.../development/windows-deploy.md`.

### 4. Smoke-test the installer locally

Run the `.exe`, let SmartScreen's "unknown publisher" warning appear (click **More
info** → **Run anyway** — expected, see the note above), and confirm:

- The app launches and the 14-day trial banner appears.
- **Settings → Activate License** opens the activation form (even though there's no
  real key to test with yet).
- If you have a "portable" library on this machine's disk or a mapped network drive,
  confirm it opens normally (Windows direct-sale build is fully unsandboxed — no
  bookmark/permission logic to worry about, unlike the macOS App Store build).

### 5. Sign the update manifest artifact

The DMG-equivalent step for Windows — this produces the Ed25519 signature the
in-app updater checks, **separate from any code-signing certificate**:

```powershell
cd framecraft
npx tauri signer sign -f secrets\framecraft-updater.key `
  src-tauri\target\release\bundle\nsis\Framecraft_0.1.0_x64-setup.exe
```

If `secrets\framecraft-updater.key` doesn't exist on this machine, copy it over
from the Mac (`framecraft/secrets/framecraft-updater.key` — gitignored, never
committed, so it has to be copied by hand, e.g. via AirDrop-equivalent/USB/secure
transfer, not email or chat).

This prints a `Public signature:` block and writes
`Framecraft_0.1.0_x64-setup.exe.sig` next to the installer.

### 6. Ship it — copy the installer + update manifest to the server

From the Mac (or wherever you have the NAS mounted), once the signed `.exe` and
`.sig` are transferred over from the Windows machine:

```bash
cp Framecraft_0.1.0_x64-setup.exe /Volumes/Gaia/04_DEV/01_releases/actual/Framecraft.exe
```

Then edit `licensing-server/releases-meta/framecraft.json` to add a Windows entry
next to the existing macOS one:

```json
{
  "version": "0.1.0",
  "notes": "Initial direct-sale release.",
  "pub_date": "2026-08-03T19:28:13Z",
  "platforms": {
    "darwin-aarch64": {
      "filename": "Framecraft.dmg",
      "signature": "..."
    },
    "windows-x86_64": {
      "filename": "Framecraft.exe",
      "signature": "<paste the .sig file's contents here>"
    }
  }
}
```

Copy that updated file onto the NAS mount and rebuild the container (same pattern
used for the macOS release):

```bash
cp licensing-server/releases-meta/framecraft.json /Volumes/Gaia/04_DEV/web/www/website/licensing-server/releases-meta/framecraft.json
ssh -t alan@192.168.178.146 "cd /mnt/Gaia/04_DEV/web/www/website && sudo docker compose -f docker-compose.traefik.yml up -d --build licensing-server"
```

### 7. Register the download in `products.js`

Edit `licensing-server/products.js`'s `framecraft` entry to add the Windows
filename:

```js
downloadFiles: { windows: 'actual/Framecraft.exe', macos: 'actual/Framecraft.dmg' },
```

Copy + rebuild the same way as step 6 (it's the same file that already has the
macOS entry).

### 8. Verify

```bash
curl -I "https://alan-design.com/licensing/framecraft/updates/download/Framecraft.exe"
curl "https://alan-design.com/licensing/framecraft/updates/darwin/aarch64/0.0.1"
```

First should return `200` with the real file size. Storefront checkout already
works for both platforms — same Stripe price, `/activate` resolves the right
download by the purchasing device's OS already (see `server.js`'s `/download`
route).

### 9. Update the storefront (optional, cosmetic)

`web_three/src/data/storeProducts.json`'s Framecraft entry currently only
advertises macOS. If you want the store page to explicitly say "Windows &
macOS," that's a copy tweak to `description`/`features` — not required for the
download itself to work, since `/download` already auto-detects the OS.

---

## Later: code signing (not needed now)

If Windows sales volume ever justifies it: buy an EV code-signing certificate,
install it in the Windows certificate store, find its SHA-1 thumbprint
(`certmgr.msc` or `Get-ChildItem Cert:\CurrentUser\My`), then:

```powershell
& "C:\Program Files (x86)\Windows Kits\10\bin\<version>\x64\signtool.exe" sign `
  /sha1 <CERT_THUMBPRINT> `
  /fd SHA256 `
  /tr http://timestamp.digicert.com `
  /td SHA256 `
  target\release\bundle\nsis\Framecraft_<version>_x64-setup.exe
```

This is the exact process already documented for Darkwave — same decision, same
fix, if it ever gets revisited.
