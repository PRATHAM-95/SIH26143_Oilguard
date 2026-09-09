# =============================================================================
# SIH26143 - Production build (Windows, no new installs)
#
# Builds the three deployable artifacts in place:
#   1. Backend "executable jar"   -> oil-spill-system/backend/target/app-0.1.0.jar
#   2. Frontend static bundle     -> oil-spill-system/frontend/dist/ (hashed + gz)
#   3. Scientific service         -> Python venv already provisioned (requirements pinned)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\build-production.ps1        (with tests)
#   powershell -ExecutionPolicy Bypass -File .\build-production.ps1 -SkipTests
# =============================================================================
param([switch]$SkipTests)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot   # oil-spill-system

Write-Host "==> Building backend (Maven package)" -ForegroundColor Cyan
Push-Location (Join-Path $repo 'backend')
try {
    if ($SkipTests) {
        & mvn.cmd clean package -DskipTests
    } else {
        & mvn.cmd clean package
    }
    if ($LASTEXITCODE -ne 0) { throw "mvn package failed (exit $LASTEXITCODE)" }
} finally {
    Pop-Location
}
$jar = Join-Path $repo 'backend\target\app-0.1.0.jar'
if (-not (Test-Path -LiteralPath $jar)) { throw "Expected jar not found: $jar" }

Write-Host "==> Building frontend (tsc + vite build)" -ForegroundColor Cyan
Push-Location (Join-Path $repo 'frontend')
try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed (exit $LASTEXITCODE)" }
} finally {
    Pop-Location
}

Write-Host "`nBuild complete." -ForegroundColor Green
Write-Host "  Backend jar : $jar"
Write-Host "  Frontend    : $(Join-Path $repo 'frontend\dist')"
Write-Host "  Sci service : sci .venv already provisioned (see requirements.txt)"
Write-Host "`nNext: powershell -ExecutionPolicy Bypass -File .\start-production.ps1"