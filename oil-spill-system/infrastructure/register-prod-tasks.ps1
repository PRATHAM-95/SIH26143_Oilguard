# =============================================================================
# SIH26143 - Register the production stack as a Windows scheduled task
#
# One built-in supervisor (Task Scheduler) starts the whole stack at logon and
# restarts it on failure - zero extra software. By default runs as SYSTEM.
# Under an SSH/RDP session the stack's ports stay bound regardless of the
# interactive user, matching a production-style daemon.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\register-prod-tasks.ps1
#   powershell -ExecutionPolicy Bypass -File .\register-prod-tasks.ps1 -Unregister
# =============================================================================
param([switch]$Unregister)

$ErrorActionPreference = 'Stop'
$taskName = 'OilSpillProductionStack'
$script = Join-Path $PSScriptRoot 'start-production.ps1'

if ($Unregister) {
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "$taskName unregistered." -ForegroundColor Green
    } else {
        Write-Host "$taskName not registered." -ForegroundColor Yellow
    }
    exit 0
}

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Write-Host "$taskName already registered - re-register with -Unregister first if needed." -ForegroundColor Yellow
}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`""

# Start 60 s after logon (give the session time to stabilize) and keep retrying.
$trigger1 = New-ScheduledTaskTrigger -AtLogOn
$trigger1.Delay = 'PT60S'
$trigger2 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddSeconds(30)
$trigger2.Repetition = (New-ScheduledTaskTrigger -Once -At (Get-Date).AddHours(1)).Repetition
$trigger2.Repetition.Interval = (New-TimeSpan -Minutes 30)
$trigger2.Repetition.StopAtDurationEnd = $false

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 5) `
    -ExecutionTimeLimit (New-TimeSpan -Days 0) `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $taskName `
    -Action $action `
    -Trigger $trigger1, $trigger2 `
    -Settings $settings `
    -User 'SYSTEM' `
    -RunLevel Highest -Force | Out-Null

Write-Host "`nRegistered $taskName (runs $script as SYSTEM at logon)." -ForegroundColor Green
Write-Host "Current state:"
Get-ScheduledTask -TaskName $taskName | Get-ScheduledTaskInfo | Format-List LastRunTime, NextRunTime, LastTaskResult
Start-ScheduledTask -TaskName $taskName
Write-Host "Task started. Stack will be up at http://localhost:4173" -ForegroundColor Cyan