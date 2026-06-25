$ErrorActionPreference = "Stop"

function Step($Name) {
  Write-Host ""
  Write-Host "== $Name ==" -ForegroundColor Cyan
}

function Require-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

Step "Checking Windows build prerequisites"
Require-Command node
Require-Command npm
Require-Command cargo
node --version
npm --version
cargo --version

Step "Installing dependencies"
npm ci

Step "Running JavaScript and TypeScript checks"
npm test
npx tsc --noEmit
npm run build

Step "Running Rust checks"
Push-Location "src-tauri"
cargo check
cargo test
Pop-Location

Step "Building Windows package"
npm run tauri build

Step "Windows artifacts"
$ArtifactRoot = Join-Path $Root "src-tauri\target\release\bundle"
$Artifacts = @()
if (Test-Path $ArtifactRoot) {
  $Artifacts = Get-ChildItem $ArtifactRoot -Recurse -File -Include *.exe,*.msi | Sort-Object FullName
}

if (-not $Artifacts -or $Artifacts.Count -eq 0) {
  throw "No Windows .exe or .msi artifacts found under $ArtifactRoot"
}

$Artifacts | ForEach-Object {
  Write-Host $_.FullName
}

Write-Host ""
Write-Host "Windows RC build complete. Launch the installer or app above, then run V8/docs/05_v8_manual_rc_checklist.md." -ForegroundColor Green
