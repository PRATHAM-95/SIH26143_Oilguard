# start-stack.ps1
# Brings up the full SIH26143 stack in ONE terminal for browser checking:
#   Mongo (27017) -> Scientific service (8000) -> Backend (8082) -> Frontend (3000)
# Run from a PowerShell terminal in the repo root:
#   powershell -ExecutionPolicy Bypass -File start-stack.ps1
# Then open http://localhost:3000 in your browser.

$ErrorActionPreference = 'Stop'

$ROOT  = $PSScriptRoot
$SCI   = Join-Path $ROOT 'oil-spill-system\scientific-service'
$BACK  = Join-Path $ROOT 'oil-spill-system\backend'
$FRONT = Join-Path $ROOT 'oil-spill-system\frontend'

$VENV_PY = Join-Path $SCI '.venv\Scripts\python.exe'
$JAVA = "C:\Users\yoges\.vscode\extensions\redhat.java-1.55.0-win32-x64\jre\21.0.11-win32-x86_64\bin\java.exe"
$JAR = Join-Path $BACK 'target\app-0.1.0.jar'
$NPM = 'C:\nvm4w\nodejs\npm.cmd'

function Wait-Port([int]$port, [int]$timeoutSec = 45) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $timeoutSec) {
        if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
            return $true
        }
        Start-Sleep -Milliseconds 700
    }
    return $false
}

Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host " SIH26143 — OIL SPILL SYSTEM  (full stack, one terminal)"       -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Cyan

if (-not (Test-Path -LiteralPath $VENV_PY)) { Write-Host "VENV MISSING: $VENV_PY" -ForegroundColor Red; exit 1 }
if (-not (Test-Path -LiteralPath $JAR))    { Write-Host "JAR MISSING: $JAR (run: mvn -q clean package -DskipTests in backend/)" -ForegroundColor Red; exit 1 }

# --- 1. Mongo -----------------------------------------------------------
$mongo = Get-NetTCPConnection -LocalPort 27017 -State Listen -ErrorAction SilentlyContinue
if (-not $mongo) {
    Write-Host "`n[1/4] Starting MongoDB on :27017 ..." -ForegroundColor Green
    Start-Process mongod -ArgumentList '--dbpath', (Join-Path $env:TEMP 'opencode\mongo-data') -WindowStyle Hidden
    if (-not (Wait-Port 27017)) { Write-Host "Mongo did not come up." -ForegroundColor Yellow }
} else {
    Write-Host "`n[1/4] MongoDB already running on :27017" -ForegroundColor Green
}

# --- 2. Scientific service (FastAPI) ------------------------------------
$sci = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if (-not $sci) {
    Write-Host "[2/4] Starting scientific service on http://127.0.0.1:8000 ..." -ForegroundColor Green
    Start-Process -FilePath $VENV_PY -ArgumentList '-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000' -WorkingDirectory $SCI -WindowStyle Hidden
    if (Wait-Port 8000) { Write-Host "      sci UP on :8000" -ForegroundColor Green } else { Write-Host "      sci FAILED" -ForegroundColor Red }
} else {
    Write-Host "[2/4] Scientific service already running on :8000" -ForegroundColor Green
}

# --- 3. Backend (Spring Boot) -------------------------------------------
$be = Get-NetTCPConnection -LocalPort 8082 -State Listen -ErrorAction SilentlyContinue
if (-not $be) {
    Write-Host "[3/4] Starting backend on http://127.0.0.1:8082 ..." -ForegroundColor Green
    Start-Process -FilePath $JAVA -ArgumentList '-jar', $JAR -WorkingDirectory $BACK -WindowStyle Hidden
    if (Wait-Port 8082 70) { Write-Host "      backend UP on :8082" -ForegroundColor Green } else { Write-Host "      backend FAILED" -ForegroundColor Red }
} else {
    Write-Host "[3/4] Backend already running on :8082" -ForegroundColor Green
}

# --- 4. Frontend (vite) -------------------------------------------------
$fe = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if (-not $fe) {
    Write-Host "[4/4] Starting frontend on http://localhost:3000 ..." -ForegroundColor Green
    Start-Process -FilePath $NPM -ArgumentList 'run','dev' -WorkingDirectory $FRONT -WindowStyle Hidden
    if (Wait-Port 3000) { Write-Host "      frontend UP on :3000" -ForegroundColor Green } else { Write-Host "      frontend FAILED" -ForegroundColor Red }
} else {
    Write-Host "[4/4] Frontend already running on :3000" -ForegroundColor Green
}

Write-Host ""
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host " Open the app in your browser:  http://localhost:3000"          -ForegroundColor White
Write-Host "                                                   :8000 -> sci (FastAPI docs /docs)"
Write-Host "                                                   :8082 -> backend (Spring Boot)"
Write-Host "=============================================================" -ForegroundColor Cyan
