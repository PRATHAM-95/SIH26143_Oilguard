# start-stack-visible.ps1
# Brings up the full SIH26143 stack with EVERY service in its OWN VISIBLE
# PowerShell terminal so logs stream live while you browse:
#   Mongo (27017) -> Scientific service (8000) -> Backend (8082) -> Frontend (3000)
#
# Stops any existing listeners on those ports first, then opens one new
# console window per service. Run from the repo root:
#   powershell -ExecutionPolicy Bypass -File start-stack-visible.ps1
#
# Then open http://localhost:3000

$ErrorActionPreference = 'Stop'

$ROOT  = $PSScriptRoot
$SCI   = Join-Path $ROOT 'oil-spill-system\scientific-service'
$BACK  = Join-Path $ROOT 'oil-spill-system\backend'
$FRONT = Join-Path $ROOT 'oil-spill-system\frontend'

$VENV_PY = Join-Path $SCI '.venv\Scripts\python.exe'
$JAVA = "C:\Users\yoges\.vscode\extensions\redhat.java-1.55.0-win32-x64\jre\21.0.11-win32-x86_64\bin\java.exe"
$JAR = Join-Path $BACK 'target\app-0.1.0.jar'
$NPM = 'C:\nvm4w\nodejs\npm.cmd'
$MONGO_DB = Join-Path $env:TEMP 'opencode\mongo-data'

function Stop-Port([int]$port) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        Write-Host "  stopping PID $($c.OwningProcess) on :$port" -ForegroundColor Yellow
        Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 800
}

function Wait-Port([int]$port, [int]$timeoutSec = 60) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $timeoutSec) {
        if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
            return $true
        }
        Start-Sleep -Milliseconds 700
    }
    return $false
}

function Get-DotenvValue([string]$file, [string]$name) {
    if (-not (Test-Path -LiteralPath $file)) { return $null }
    foreach ($line in Get-Content -LiteralPath $file) {
        if ($line -match "^$([regex]::Escape($name))=(.*)$") {
            $val = $matches[1].Trim()
            if ($val) { return $val }
        }
    }
    return $null
}

Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host " SIH26143 - OIL SPILL SYSTEM (visible terminals per service)" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Cyan

if (-not (Test-Path -LiteralPath $VENV_PY)) { Write-Host "VENV MISSING: $VENV_PY" -ForegroundColor Red; exit 1 }
if (-not (Test-Path -LiteralPath $JAR))    { Write-Host "JAR MISSING: $JAR (run: mvn -q clean package -DskipTests in backend/)" -ForegroundColor Red; exit 1 }
if (-not (Test-Path -LiteralPath $JAVA))   { Write-Host "JAVA MISSING: $JAVA" -ForegroundColor Red; exit 1 }

Write-Host "`nStopping existing listeners on 27017 / 8000 / 8082 / 3000 ..." -ForegroundColor Yellow
# Online MongoDB (MONGODB_URI in env or .env pointing at a remote cluster) has no local mongod to stop.
$onlineUri = $env:MONGODB_URI
if (-not $onlineUri) { $onlineUri = Get-DotenvValue (Join-Path $ROOT 'oil-spill-system\.env') 'MONGODB_URI' }
$useOnlineMongo = [bool]$onlineUri -and $onlineUri -notmatch '^mongodb(\+srv)?://(localhost|127\.0\.0\.1)(:|/)'
if (-not $useOnlineMongo) { Stop-Port 27017 }
Stop-Port 8000; Stop-Port 8082; Stop-Port 3000

# --- 1. Mongo ---
if ($useOnlineMongo) {
    Write-Host "`n[1/4] Using ONLINE MongoDB ($onlineUri) — no local mongod required" -ForegroundColor Green
} else {
    Write-Host "`n[1/4] Opening MONGO terminal (log window: mongo)" -ForegroundColor Green
    Start-Process powershell -WorkingDirectory $env:TEMP -WindowStyle Normal -ArgumentList @(
        '-NoExit', '-Command',
        ("Write-Host 'Mongo on :27017' -ForegroundColor Cyan; mongod --dbpath '{0}'" -f $MONGO_DB)
    )
    if (Wait-Port 27017 60) { Write-Host "      Mongo UP on :27017" -ForegroundColor Green } else { Write-Host "      Mongo FAILED" -ForegroundColor Red }
}

# --- 2. Scientific service ---
Write-Host "[2/4] Opening SCIENTIFIC terminal (uvicorn :8000)" -ForegroundColor Green
Start-Process powershell -WorkingDirectory $SCI -WindowStyle Normal -ArgumentList @(
    '-NoExit', '-Command',
    ("& '{0}' -m uvicorn app.main:app --host 127.0.0.1 --port 8000" -f $VENV_PY)
)
if (Wait-Port 8000 60) { Write-Host "      sci UP on :8000" -ForegroundColor Green } else { Write-Host "      sci FAILED" -ForegroundColor Red }

# --- 3. Backend ---
Write-Host "[3/4] Opening BACKEND terminal (jar :8082)" -ForegroundColor Green
Start-Process powershell -WorkingDirectory $BACK -WindowStyle Normal -ArgumentList @(
    '-NoExit', '-Command',
    ("& '{0}' -jar '{1}'" -f $JAVA, $JAR)
)
if (Wait-Port 8082 90) { Write-Host "      backend UP on :8082" -ForegroundColor Green } else { Write-Host "      backend FAILED" -ForegroundColor Red }

# --- 4. Frontend ---
Write-Host "[4/4] Opening FRONTEND terminal (vite :3000)" -ForegroundColor Green
Start-Process powershell -WorkingDirectory $FRONT -WindowStyle Normal -ArgumentList @(
    '-NoExit', '-Command', "& '$NPM' run dev"
)
if (Wait-Port 3000 90) { Write-Host "      frontend UP on :3000" -ForegroundColor Green } else { Write-Host "      frontend FAILED" -ForegroundColor Red }

Write-Host ""
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host " Open in your browser:  http://localhost:3000" -ForegroundColor White
Write-Host "  :8000 sci /docs  |  :8082 backend  |  :27017 mongo" -ForegroundColor Gray
Write-Host "=============================================================" -ForegroundColor Cyan