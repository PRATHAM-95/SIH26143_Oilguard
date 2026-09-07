<#
.SYNOPSIS
    Waits until an HTTP endpoint responds successfully, with a hard time budget.

.DESCRIPTION
    Robust readiness/health poll for local dev services (Python FastAPI, Spring
    Boot, Vite). Windows PowerShell 5.1 Invoke-WebRequest has no connection
    retry parameters, so this helper implements the standard bounded retry loop:
    poll every -IntervalSeconds up to -TimeoutSeconds total, exit 0 on success.

    Exits 1 with the last error if the endpoint never becomes ready.

.EXAMPLE
    .\wait-health.ps1 -Uri http://127.0.0.1:8000/api/ais/availability -TimeoutSeconds 90
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$Uri,

    [int]$TimeoutSeconds = 90,

    [int]$IntervalSeconds = 2,

    [string]$Method = 'GET',

    [string]$Body,

    [string]$ContentType
)

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$attempt = 0
$lastError = 'not yet attempted'

while ((Get-Date) -lt $deadline) {
    $attempt++
    try {
        $args = @{
            Uri     = $Uri
            Method  = $Method
            TimeoutSec = 10
            UseBasicParsing = $true
            ErrorAction = 'Stop'
        }
        if ($Body) {
            $args.Body = $Body
        }
        if ($ContentType) {
            $args.ContentType = $ContentType
        }
        Invoke-WebRequest @args | Out-Null
        Write-Host "READY after $attempt attempt(s): $Uri"
        exit 0
    }
    catch {
        $lastError = $_.Exception.Message
        Start-Sleep -Seconds $IntervalSeconds
    }
}

Write-Error "TIMEOUT waiting for $Uri after $TimeoutSeconds s. Last error: $lastError"
exit 1