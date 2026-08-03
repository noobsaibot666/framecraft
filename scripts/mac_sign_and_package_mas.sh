#!/usr/bin/env bash
# Mac App Store build: build (sandboxed) → sign → package .pkg → ready for
# App Store Connect upload. Mirrors Darkwave's
# apps/desktop/scripts/mac_sign_and_package_mas.sh, simplified: Framecraft
# is a single-crate Tauri project (no Cargo workspace) and has no bundled
# sidecar binaries to sign individually.
#
# Run from the repo root: bash scripts/mac_sign_and_package_mas.sh
#
# Prerequisites (one-time, interactive):
#   1. "3rd Party Mac Developer Application" + "3rd Party Mac Developer
#      Installer" certificates in your login keychain, issued under Team
#      RD7UU4Z3D2 (same team/certs as Darkwave/CD Suite — no new cert
#      needed if you already have these for that team).
#   2. A provisioning profile for com.alan.framecraft, downloaded from
#      developer.apple.com and saved as src-tauri/embedded.provisionprofile
#      (requires the bundle id to be registered first — see Phase K of the
#      distribution plan).

set -euo pipefail

APP_IDENTITY="3rd Party Mac Developer Application: Nudson Alan Terrinha Alves (RD7UU4Z3D2)"
INSTALLER_IDENTITY="3rd Party Mac Developer Installer: Nudson Alan Terrinha Alves (RD7UU4Z3D2)"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

APP_PATH="$PROJECT_ROOT/src-tauri/target/release/bundle/macos/Framecraft.app"
PROVISION="src-tauri/embedded.provisionprofile"
APP_ENTITLEMENTS="src-tauri/entitlements.mas.plist"

echo "▶  Framecraft — Mac App Store package"
echo "──────────────────────────────────────"

echo "[1/6] Building (sandboxed, MAS identity)..."
APPLE_SIGNING_IDENTITY="$APP_IDENTITY" npx tauri build \
  --config src-tauri/tauri.mas.conf.json

echo "[2/6] Removing quarantine attributes..."
xattr -rc "$APP_PATH"

echo "[3/6] Embedding provisioning profile..."
if [ ! -f "$PROVISION" ]; then
  echo "Missing $PROVISION — download it from developer.apple.com first" \
       "(requires com.alan.framecraft to be registered, see Phase K)." >&2
  exit 1
fi
cp "$PROVISION" "$APP_PATH/Contents/embedded.provisionprofile"
xattr -rc "$APP_PATH"

echo "[4/6] Signing app bundle..."
codesign --force --verify --verbose \
  --sign "$APP_IDENTITY" \
  --entitlements "$APP_ENTITLEMENTS" \
  --options runtime \
  "$APP_PATH"
xattr -rc "$APP_PATH"

echo "[5/6] Verifying signature..."
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

echo "[6/6] Building .pkg for App Store Connect..."
mkdir -p builds
COPYFILE_DISABLE=1 productbuild \
  --component "$APP_PATH" /Applications \
  --sign "$INSTALLER_IDENTITY" \
  "builds/Framecraft_SUBMISSION.pkg"

echo ""
echo "✓ builds/Framecraft_SUBMISSION.pkg ready."
echo ""
echo "Upload with Transporter or:"
echo "  xcrun altool --upload-app -f builds/Framecraft_SUBMISSION.pkg \\"
echo "    -t macos -u <apple-id-email> -p <app-specific-password>"
