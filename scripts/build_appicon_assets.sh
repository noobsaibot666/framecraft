#!/usr/bin/env bash
# Compile the Icon Composer document into an appearance-aware Assets.car.
#
# Why this exists: Tauri only bundles a classic .icns (single appearance).
# macOS 26's light/dark/tinted Dock icon comes from an `AppIcon` entry inside
# a compiled Assets.car, selected at runtime via CFBundleIconName. `npx tauri
# icon` cannot produce that, and the deploy scripts sign the .app *inside*
# `tauri build`, so the CAR has to be present *before* bundling — it's wired in
# through `bundle.macOS.files` in tauri.conf.json, and this script regenerates
# the committed artifact whenever the icon changes.
#
# Run from the repo root:  bash scripts/build_appicon_assets.sh
# Requires Xcode 26+ (actool with Icon Composer support). macOS-only; on the
# Windows build machine the committed src-tauri/icons/Assets.car is used as-is.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ICON_SRC="src/assets/icon/AppIcon.icon"
OUT_DIR="src-tauri/icons"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

[ -d "$ICON_SRC" ] || { echo "✗ $ICON_SRC not found"; exit 1; }
command -v xcrun >/dev/null || { echo "✗ Xcode command line tools required"; exit 1; }

echo "▶  Compiling $ICON_SRC → $OUT_DIR/Assets.car"

# actool takes the .icon bundle directly as its document. --app-icon must match
# the bundle's basename (AppIcon) — that becomes the CFBundleIconName lookup key.
# minimum-deployment-target matches tauri.conf.json's bundle.macOS
# minimumSystemVersion (12.0): the appearance stacks are still embedded; older
# macOS just ignores them and falls back to CFBundleIconFile (icon.icns).
xcrun actool "$ICON_SRC" \
  --compile "$TMP" \
  --app-icon AppIcon \
  --output-partial-info-plist "$TMP/partial.plist" \
  --platform macosx \
  --minimum-deployment-target 12.0 \
  --target-device mac \
  --app-icon AppIcon \
  --skip-app-store-deployment \
  --errors --warnings --notices \
  --output-format human-readable-text

[ -f "$TMP/Assets.car" ] || { echo "✗ actool did not emit Assets.car"; exit 1; }

cp "$TMP/Assets.car" "$OUT_DIR/Assets.car"
# Keep the pre-macOS-26 fallback .icns pixel-consistent with the light
# appearance actool renders (replaces the `npx tauri icon` output).
[ -f "$TMP/AppIcon.icns" ] && cp "$TMP/AppIcon.icns" "$OUT_DIR/icon.icns"

echo "✓  $OUT_DIR/Assets.car        ($(du -h "$OUT_DIR/Assets.car" | cut -f1))"
echo "✓  $OUT_DIR/icon.icns  (light-appearance fallback)"
echo
echo "Appearances embedded:"
xcrun --sdk macosx assetutil --info "$OUT_DIR/Assets.car" 2>/dev/null \
  | grep -Eo '"Appearance" : "[^"]+"' | sort -u || true
echo
echo "Wired via bundle.macOS.files + CFBundleIconName in src-tauri/Info.plist —"
echo "nothing else to do; commit src-tauri/icons/Assets.car and icon.icns."
