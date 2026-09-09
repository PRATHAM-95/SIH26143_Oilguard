# =============================================================================
# SIH26143 - Production start (Windows, no new installs, "slow start / fast run")
#
# Starts, in order (health-gated so no traffic ever hits a cold worker):
#   1. Scientific service (uvicorn, SCIENTIFIC_PRELOAD=1)  -> warms OpenDrift etc.
#   2. Backend (java -jar app-0.1.0.jar)                   -> connects to Atlas Mongo
#   3. Frontend (vite preview, serves dist/ on :4173)      -> browser talks to :8082
#
# All output is written to logs/. Stop everything with  -Stop .
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\start-production.ps1
#   powershell -ExecutionPolicy Bypass -File .\start-production.ps1 -Stop
# =============================================================================
param([switch]$Stop)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot   # oil-spill-system
$logs = Join-Path $PSScriptRoot 'logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null

$pidFile = Join-Path $PSScriptRoot '.prod-pids.txt'

function Read-Pids {
    if (Test-Path -LiteralPath $pidFile) {
        Get-Content -LiteralPath $pidFile | ForEach-Object { [int]$_ }
    } else { @() }
}

function Wait-Http([string]$url, [int]$timeoutSec, [int]$intervalSec = 2) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $timeoutSec) {
        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
            if ($r.StatusCode -eq 200) { return $true }
        } catch { }
        Start-Sleep -Seconds $intervalSec
    }
    return $false
}

if ($Stop) {
    foreach ($pid in (Read-Pids)) {
        if (Get-Process -Id $pid -ErrorAction SilentlyContinue) {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "Stopped PID $pid" -ForegroundColor Yellow
        }
    }
    Remove-Item -LiteralPath $pidFile -ErrorAction SilentlyContinue
    Write-Host "Production stack stopped." -ForegroundColor Green
    exit 0
}

# --- 0. Prerequisites -------------------------------------------------------
$py = Join-Path $repo 'scientific-service\.venv\Scripts\python.exe'
$jar = Join-Path $repo 'backend\target\app-0.1.0.jar'
if (-not (Test-Path -LiteralPath $jar)) {
    Write-Host "Backend jar missing - run build-production.ps1 first." -ForegroundColor Red; exit 1
}
if (-not (Test-Path -LiteralPath $py)) {
    Write-Host "Sci venv missing at: $py" -ForegroundColor Red; exit 1
}
$envFile = Join-Path $repo '.env'
if (-not (Test-Path -LiteralPath $envFile)) {
    Write-Host "Missing .env - copy .env.example to .env and set MONGODB_URI." -ForegroundColor Red; exit 1
}

$pids = @()
try {
    # --- 1. Scientific service (warm boot, then /api/ready) ------------------
    Write-Host "[1/3] Starting scientific service (uvicorn, preload=ON) ..." -ForegroundColor Cyan
    $oldPreload = $env:SCIENTIFIC_PRELOAD
    $env:SCIENTIFIC_PRELOAD = '1'
    $sci = Start-Process -FilePath $py `
        -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000') `
        -WorkingDirectory (Join-Path $repo 'scientific-service') `
        -RedirectStandardOutput (Join-Path $logs 'sci.log') `
        -RedirectStandardError (Join-Path $logs 'sci.err.log') `
        -WindowStyle Hidden -PassThru
    if ($null -eq $oldPreload) { Remove-Item Env:SCIENTIFIC_PRELOAD -ErrorAction SilentlyContinue } else { $env:SCIENTIFIC_PRELOAD = $oldPreload }
    $pids += $sci.Id

    if (-not (Wait-Http 'http://localhost:8000/api/ready' 180 3)) {
        Write-Host "Sci service never reached /api/ready - see $logs\sci.err.log" -ForegroundColor Red; exit 1
    }
    Write-Host "   Sci service ready (warm)." -ForegroundColor Green

    # --- 2. Backend (needs Atlas Mongo) ---------------------------------------
    Write-Host "[2/3] Starting backend (java -jar) ..." -ForegroundColor Cyan
    $be = Start-Process -FilePath 'java.exe' `
        -ArgumentList @('-jar', $jar) `
        -WorkingDirectory (Join-Path $repo 'backend') `
        -RedirectStandardOutput (Join-Path $logs 'backend.log') `
        -RedirectStandardError (Join-Path $logs 'backend.err.log') `
        -WindowStyle Hidden -PassThru
    $pids += $be.Id

    if (-not (Wait-Http 'http://localhost:8082/api/health' 120 3)) {
        Write-Host "Backend never became healthy - see $logs\backend.err.log" -ForegroundColor Red; exit 1
    }
    $health = Invoke-RestMethod -Uri 'http://localhost:8082/api/health' -TimeoutSec 10
    if ($health.mongodb -ne 'UP') {
        Write-Host "Backend up but MongoDB is NOT UP ($($health.mongodb)) - check MONGODB_URI in .env" -ForegroundColor Red; exit 1
    }
    Write-Host "   Backend healthy, MongoDB UP." -ForegroundColor Green

    # --- 3. Frontend static server --------------------------------------------
    Write-Host "[3/3] Starting frontend (vite preview, :4173) ..." -ForegroundColor Cyan
    $fe = Start-Process -FilePath 'npm.cmd' `
        -ArgumentList @('run', 'preview', '--', '--host', '0.0.0.0', '--port', '4173') `
        -WorkingDirectory (Join-Path $repo 'frontend') `
        -RedirectStandardOutput (Join-Path $logs 'frontend.log') `
        -RedirectStandardError (Join-Path $logs 'frontend.err.log') `
        -WindowStyle Hidden -PassThru
    $pids += $fe.Id

    $pids | Set-Content -LiteralPath $pidFile

    Write-Host "`nProduction stack running:" -ForegroundColor Green
    Write-Host "   Frontend  ->  http://localhost:4173"
    Write-Host "   Backend   ->  http://localhost:8082 (health: /api/health)"
    Write-Host "   Sci svc   ->  http://localhost:8000 (ready: /api/ready)"
    Write-Host "   Logs      ->  $logs"
    Write-Host "   Stop      ->  .\start-production.ps1 -Stop"
} catch {
    foreach ($pid in $pids) { Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue }
    Write-Host "Startup failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}