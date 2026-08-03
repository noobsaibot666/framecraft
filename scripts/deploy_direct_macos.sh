#!/usr/bin/env bash
# Direct-sale macOS build: build → DMG → sign → notarize → staple → distribute.
# Mirrors Darkwave's apps/desktop/scripts/deploy_direct_macos.sh, simplified
# further: Framecraft is a single-crate Tauri project (no Cargo workspace),
# so the build output lands directly under src-tauri/target/, no
# workspace-root indirection needed.
#
# Run from the repo root: bash scripts/deploy_direct_macos.sh
#
# Prerequisites (one-time, interactive, not something this script can do):
#   1. A "Developer ID Application" certificate in your login keychain,
#      issued under Team RD7UU4Z3D2 (same team/certs as Darkwave/CD Suite —
#      no new cert needed if you already have one for that team).
#   2. A notarization keychain profile:
#        xcrun notarytool store-credentials framecraft-notary \
#          --apple-id <your Apple ID email> \
#          --team-id RD7UU4Z3D2 \
#          --password <an app-specific password from appleid.apple.com>

set -euo pipefail

# Pinned by SHA-1 fingerprint, not by name: the login keychain has two
# "Developer ID Application: ... (RD7UU4Z3D2)" certs (shared across every
# project under this Apple Developer Team, same ones Darkwave uses) — this
# one is valid until 2031; the other, issued more recently, expires in
# 2027. Matching by name would be ambiguous between the two.
IDENTITY="2FDD1878C9570F69A38D4231D9E6FC37E92D537F"
KEYCHAIN_PROFILE="framecraft-notary"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

VERSION=$(node -p "require('./src-tauri/tauri.conf.json').version")
APP="$PROJECT_ROOT/src-tauri/target/release/bundle/macos/Framecraft.app"
DMG_DIR="$PROJECT_ROOT/src-tauri/target/release/bundle/dmg"
DMG_NAME="Framecraft_${VERSION}_aarch64.dmg"
DMG_OUT="$DMG_DIR/$DMG_NAME"

echo "▶  Framecraft v${VERSION} — Direct Distribution (macOS)"
echo "─────────────────────────────────────────────────────"

echo "[1/5] Building (direct-dist, unsandboxed, Developer ID identity)..."
# TAURI_SIGNING_PRIVATE_KEY_PATH makes tauri-plugin-updater's build hook
# write a real Ed25519 signature (Framecraft_x.y.z_aarch64.dmg.sig)
# alongside the DMG — needed for releases-meta/framecraft.json below.
APPLE_SIGNING_IDENTITY="$IDENTITY" \
TAURI_SIGNING_PRIVATE_KEY_PATH="$PROJECT_ROOT/secrets/framecraft-updater.key" \
npx tauri build \
  --features direct-dist \
  --config src-tauri/tauri.direct.conf.json

echo "[2/5] Signing DMG..."
codesign --force --sign "$IDENTITY" --options runtime --timestamp "$DMG_OUT"

echo "[3/5] Notarizing (this takes a minute)..."
xcrun notarytool submit "$DMG_OUT" --keychain-profile "$KEYCHAIN_PROFILE" --wait

echo "[4/5] Stapling & validating..."
xcrun stapler staple "$DMG_OUT"
xcrun stapler validate "$DMG_OUT"
spctl -a -t open --context context:primary-signature "$DMG_OUT"

echo "[5/5] Done."
echo ""
echo "  → $DMG_OUT"
echo ""
echo "Manually verify a NAS/external-drive 'portable' library still opens"
echo "correctly on this build (it's unsandboxed — no bookmark logic runs,"
echo "and shouldn't need to)."
echo ""
echo "Next: copy to the licensing server's gated download mount and update"
echo "PRODUCTS.framecraft.downloadFiles.macos's target if the filename changed:"
echo "  licensing-server/releases/actual/Framecraft.dmg"
