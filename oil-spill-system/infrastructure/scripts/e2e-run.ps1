# e2e-run.ps1 - live E2E driver for STEP 11.1 hardening verification.
#
# Reusable pipeline: create simulation -> spill (creates incident + ground truth)
# -> start investigation -> poll to a terminal status. Optional WebSocket capture
# of /ws/investigation/{id} for event assertions.
#
# Usage:
#   .\e2e-run.ps1 -Name <scenario> [-StartDelaySec <n>] [-RunForSec <n>]
#                 [-PollSec 2] [-TimeoutSec 600] [-CaptureWs] [-KillWsAtSec <n>]
#                 [-Reconnect] [ -ExpectedTerminal RUNNING|COMPLETED|CANCELLED ]
#                 [-ExtraStartJson <json>]
#
# Scenario timing presets (from the STEP 11.1 plan):
#   RELEASE  -> full run to completion (CANDIDATE_IDENTIFIED)
#   FORCE    -> cancel mid-run, then rerun (reuse) and complete
#   REVERSED -> absorbed-candidates run (fast target window)
#   NO_REVERSE -> wide window (many candidates)
param(
    [Parameter(Mandatory=$true)][string]$Name,
    [int]$StartDelaySec = 2,
    [int]$RunForSec = 0,
    [int]$PollSec = 2,
    [int]$TimeoutSec = 600,
    [switch]$CaptureWs,
    [int]$KillWsAtSec = 0,
    [switch]$Reconnect,
    [string]$ExpectedTerminal = "COMPLETED",
    [string]$ExtraStartJson = "",
    [switch]$SkipPoll,
    [switch]$CancelThenRerun,
    [int]$CancelAtSec = 40,
    [switch]$RerunAfterCompleted,
    [switch]$ReuseAssert
)

$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:8082'
$out  = Join-Path $env:TEMP 'opencode\e2e'
New-Item -ItemType Directory -Path $out -Force | Out-Null
$stamp = "{0:HHmmss}" -f (Get-Date)
$log   = Join-Path $out "$Name-$stamp.log"

function Log([string]$m) {
    $line = "{0:HH:mm:ss}  {1}" -f (Get-Date), $m
    Write-Output $line
    Add-Content -LiteralPath $log -Value $line
}
function Post([string]$url, [string]$bodyJson = '', [int]$expectCode = 200) {
    try {
        if ($bodyJson) {
            $resp = Invoke-RestMethod -Uri "$base$url" -Method Post -ContentType 'application/json' -Body $bodyJson -TimeoutSec 120
        } else {
            $resp = Invoke-RestMethod -Uri "$base$url" -Method Post -TimeoutSec 120
        }
        return $resp
    } catch {
        Log "POST FAIL $url -> $($_.Exception.Message)"
        throw
    }
}
function Get-Json([string]$url) {
    Invoke-RestMethod -Uri "$base$url" -Method Get -TimeoutSec 60
}

Log "== E2E scenario [$Name] =="

# ---- 1. create simulation (investigation mode) ---------------------------------
$region = '{"north":29.9,"south":28.9,"east":-88.9,"west":-90.1}'
$sim = Post '/api/simulation' "{`"region`":$region,`"mode`":`"investigation`"}"
$simId = $sim.simulationId
Log "simulation     : $simId"
Add-Content -LiteralPath $out\last-sim.txt -Value "$Name`t$simId"

# ---- 2. spill from first vessel (creates incident + hidden ground truth) -------
Start-Sleep -Milliseconds 800
$startedSim = Post "/api/simulation/$simId/start"
Log "sim status     : $($startedSim.status)"
$vessels = Get-Json "/api/simulation/$simId/vessels"
$vessel = @($vessels.vessels)[0]
if (-not $vessel) { Log "ERROR no vessel present"; exit 3 }
$spill = Post "/api/simulation/$simId/vessels/$($vessel.id)/spill" '{"quantityKg":5000,"type":"accidental","oilType":"GENERIC CRUDE"}'
$incidentId = $spill.incidentId
$spillEventId = $spill.spillEventId
Log "incident       : $incidentId (spill $spillEventId)"

# ---- 3. start investigation ------------------------------------------------------
$startBody = '{}'
if ($ExtraStartJson) { $startBody = $ExtraStartJson }
$started = Post "/api/investigation/$incidentId/start" $startBody
$invId = $started.investigationId
$reused = $started.reused
Log "investigation  : $invId (reused=$reused)"
Add-Content -LiteralPath $out\last-inv.txt -Value "$Name`t$invId"

# ---- 3b. optional ws capture after start (events keyed by investigation id) -------
$wsFile = Join-Path $out "$Name-$stamp-ws.txt"
$wsProc = $null
if ($CaptureWs) {
    $py = Join-Path (Split-Path $PSScriptRoot -Parent) '..\scientific-service\.venv\Scripts\python.exe'
    $pyAbs = (Resolve-Path $py).Path
    if (-not (Test-Path $pyAbs)) { Log "ERROR venv python missing: $pyAbs"; exit 3 }
    $argsWs = @('ws-capture.py', '--path', "/ws/investigation/$invId", '--timeout', ([string]($TimeoutSec + 60)), '--out', $wsFile)
    $wsProc = Start-Process -FilePath $py -ArgumentList $argsWs -WorkingDirectory $PSScriptRoot -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 1
    Log "ws capture     : PID $($wsProc.Id) -> $wsFile (path /ws/investigation/$invId)"
}

if ($SkipPoll) { Log "skip-poll requested; returning"; exit 0 }

# ---- 5. optional ws disconnect / reconnect breakpoint -----------------------------
if ($Reconnect -and $KillWsAtSec -gt 0) {
    Start-Sleep -Seconds $KillWsAtSec
    if ($wsProc -and -not $wsProc.HasExited) {
        Log "reconnect breakpoint: killing ws PID $($wsProc.Id)"
        Stop-Process -Id $wsProc.Id -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
        $wsProc2 = Start-Process -FilePath $py -ArgumentList @('ws-capture.py', '--path', "/ws/investigation/$invId", '--timeout', ([string]($TimeoutSec + 60)), '--out', "$wsFile.re") -PassThru -WindowStyle Hidden
        Log "ws recapture   : PID $($wsProc2.Id) -> $wsFile.re"
    }
}

# ---- 6. poll to terminal -----------------------------------------------------------
$term = $null
$lastProgress = -1
$lastEv = 0
$cancelled = $false
$rerunDone = -not $CancelThenRerun
$sw = [System.Diagnostics.Stopwatch]::StartNew()
while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
    Start-Sleep -Seconds $PollSec
    $inv = Get-Json "/api/investigation/$invId"
    $term = $inv.status
    $progress = if ($null -ne $inv.progress) { $inv.progress } else { 0 }
    $ev = if ($null -ne $inv.evidence) { @($inv.evidence).Count } else { 0 }
    if ($progress -ne $lastProgress -or $ev -ne $lastEv) {
        Log "  progress=$progress evidence=$ev stages=$($inv.stageStatuses -join ',')"
        $lastProgress = $progress; $lastEv = $ev
    }
    if ($CancelThenRerun -and -not $cancelled -and $sw.Elapsed.TotalSeconds -ge $CancelAtSec) {
        $cancelled = $true
        try {
            $c = Post "/api/investigation/$invId/cancel"
            Log "cancel posted  : $($c.status) (t=$([int]$sw.Elapsed.TotalSeconds)s)"
        } catch {
            Log "cancel failed  : $($_.Exception.Message)"
        }
    }
    if ($term -in @('COMPLETED','FAILED','CANCELLED')) {
        if ($CancelThenRerun -and $term -eq 'CANCELLED' -and -not $rerunDone) {
            Log "cancel observed; rerunning"
            $rerunDone = $true
            $rerun = Post "/api/investigation/$incidentId/start" $startBody
            Log "rerun          : investigationId=$($rerun.investigationId) reused=$($rerun.reused)"
            $invId = $rerun.investigationId
            $term = $null
            $lastProgress = -1; $lastEv = 0
            continue
        }
        break
    }
    if ($RunForSec -gt 0 -and $sw.Elapsed.TotalSeconds -ge $RunForSec) { break }
}
if (-not $term -or $term -in @('RUNNING','CREATED')) {
    if ($RunForSec -gt 0) { $term = "RUNNING(stopped t=$([int]$sw.Elapsed.TotalSeconds)s)" }
}

Log "terminal       : $term  (t=$([int]$sw.Elapsed.TotalSeconds)s)"

# ---- 6b. idempotent re-start after COMPLETED: new id + old evidence stable ----------
if ($RerunAfterCompleted -and $term -eq 'COMPLETED') {
    $before = (Get-Json "/api/investigation/$invId").evidence.Count
    $again = Post "/api/investigation/$incidentId/start" '{}'
    $afterOld = (Get-Json "/api/investigation/$invId").evidence.Count
    Log "rerun-completed: newId=$($again.investigationId) reused=$($again.reused) oldEvidenceBefore=$before oldEvidenceAfter=$afterOld"
    Add-Content -LiteralPath $out\rerun-after-completed.txt -Value "$Name`tnewId=$($again.investigationId)`treused=$($again.reused)`toldEvidence=$before/$afterOld"
}

# ---- 7. summary dump -----------------------------------------------------------------
$inv = Get-Json "/api/investigation/$invId"
$inv | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath "$out\$Name-$stamp-state.json"
Log "state dump     : $out\$Name-$stamp-state.json"
Log "status         : $($inv.status)"
Log "attemptCount   : $($inv.attemptCount)"
Log "evidence       : $($inv.evidence.Count)"
$conclusion = $inv.conclusion
if ($conclusion) {
    Log "conclusion     : status=$($conclusion.status) refId=$($conclusion.referenceId) score=$($conclusion.score)"
}
$warnings = @($inv.warnings)
if ($warnings.Count -gt 0) { Log "warnings       : $($warnings.Count) [$($warnings[0])]" }

# verdict against ground truth when candidate present
if ($conclusion -and $conclusion.referenceId) {
    try {
        $verdict = Post "/api/investigation/$invId/reveal" '{}'
        Log "reveal verdict : GT match=$($verdict.groundTruthMatched) nominal=$($verdict.groundTruthVesselId) actual=$($verdict.actualVesselId)"
    } catch {
        Log "reveal         : NOT_AVAILABLE ($($_.Exception.Message))"
    }
}

# report section sanity
try {
    $rep = Get-Json "/api/investigation/$invId/report"
    $keys = @($rep.PSObject.Properties.Name) | Sort-Object
    Log "report sections: $($keys -join ',')"
} catch {
    Log "report         : ERROR $($_.Exception.Message)"
}

if ($wsProc -and -not $wsProc.HasExited) { Stop-Process -Id $wsProc.Id -Force -ErrorAction SilentlyContinue }

$ok = $term -eq $ExpectedTerminal
Log "RESULT $Name = $(if ($ok) { 'PASS' } else { 'FAIL' }) (expected $ExpectedTerminal, got $term)"
exit $(if ($ok) { 0 } else { 1 })