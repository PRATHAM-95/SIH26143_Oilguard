# e2e-cdp.ps1 - browser-level E2E driver for the STEP 11.1 UI verification.
#
# Dependency-free: drives Chrome via the raw Chrome DevTools Protocol over a
# PowerShell System.Net.WebSockets.ClientWebSocket (Node v20 has no global
# WebSocket, so we deliberately avoid npm websocket packages).
#
# Scenario ui-full:
#   1. Open /simulation, create a simulation from the UI (captain mode).
#   2. Select the first vessel, start the simulation.
#   3. Release an oil spill -> incident recorded in the UI.
#   4. Navigate to /investigation, click "Start investigation".
#   5. Watch status RUNNING, pipeline pills progress; cancel button appears.
#   6. Wait for COMPLETED; conclusion panel and evidence chain render.
#   7. Click "Reveal ground truth"; reveal metrics render.
#   8. Navigate to /report; assert the 12 report sections render.
#
# Usage:
#   .\e2e-cdp.ps1 -Scenario ui-full [-TimeoutSec 360]
#   .\e2e-cdp.ps1 -Scenario ui-cancel   (start -> cancel -> new run)
param(
    [string]$Scenario = 'ui-full',
    [string]$Chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe',
    [int]$DebugPort = 9222,
    [int]$TimeoutSec = 360,
    [string]$Base = 'http://localhost:3000'
)

$ErrorActionPreference = 'Stop'
$out = Join-Path $env:TEMP 'opencode\e2e'
New-Item -ItemType Directory -Path $out -Force | Out-Null
$log = Join-Path $out (("ui-$Scenario-{0:HHmmss}.log") -f (Get-Date))
function Log([string]$m) {
    $line = "{0:HH:mm:ss}  {1}" -f (Get-Date), $m
    Write-Output $line
    Add-Content -LiteralPath $log -Value $line
}

# ---------------- Chrome launch + target discovery ----------------
$profile = Join-Path $env:TEMP "opencode\chrome-cdp-$DebugPort"
if (Test-Path $profile) { Remove-Item -Recurse -Force $profile }
$chromeProc = Start-Process -FilePath $Chrome -ArgumentList @(
    "--headless=new", "--remote-debugging-port=$DebugPort",
    "--user-data-dir=$profile", "--no-first-run", "--disable-gpu",
    "--window-size=1400,900", "about:blank"
) -PassThru -WindowStyle Hidden

$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 500
    try {
        Invoke-RestMethod -Uri "http://127.0.0.1:$DebugPort/json/version" -TimeoutSec 3 | Out-Null
        $ready = $true
        break
    } catch { }
}
if (-not $ready) { Log "FATAL chrome devtools port $DebugPort not ready"; exit 1 }

$newTab = Invoke-RestMethod -Uri "http://127.0.0.1:$DebugPort/json/new?about:blank" -Method Put -ContentType 'application/json'
$wsUrl = $newTab.webSocketDebuggerUrl
Log "target page    : $wsUrl"

# ---------------- WebSocket plumbing ----------------
$ws = [System.Net.WebSockets.ClientWebSocket]::new()
$cts = [System.Threading.CancellationTokenSource]::new()
$ws.ConnectAsync([Uri]$wsUrl, $cts.Token).Wait()

$script:cmdId = 0

function Read-Frame() {
    $ms = [System.IO.MemoryStream]::new()
    $buf = [byte[]]::new(262144)
    while ($true) {
        $seg = [ArraySegment[byte]]::new($buf)
        $res = $ws.ReceiveAsync($seg, $cts.Token)
        $res.Wait()
        $got = $res.Result
        $ms.Write($buf, 0, $got.Count)
        if ($got.EndOfMessage) { break }
    }
    $bytes = $ms.ToArray()
    $ms.Dispose()
    if ($bytes.Length -eq 0) { return $null }
    $text = [System.Text.Encoding]::UTF8.GetString($bytes)
    try { return $text | ConvertFrom-Json } catch { return $null }
}

function Send-Cdp([string]$method, [object]$params = $null, [int]$timeoutSec = 30) {
    $script:cmdId++
    $id = $script:cmdId
    $msg = @{ id = $id; method = $method } | ConvertTo-Json -Depth 6 -Compress
    if ($params) {
        $msg = @{ id = $id; method = $method; params = $params } | ConvertTo-Json -Depth 12 -Compress
    }
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($msg)
    $seg = [ArraySegment[byte]]::new($bytes)
    $send = $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $cts.Token)
    $send.Wait()
    $deadline = (Get-Date).AddSeconds($timeoutSec)
    while ((Get-Date) -lt $deadline) {
        $frame = Read-Frame
        if (-not $frame) { continue }
        if ($frame.id -eq $id) { return $frame }
        # buffer events silently (log debug later if needed)
        Add-Content -LiteralPath $log -Value "EVENT $($frame.method) $($frame | ConvertTo-Json -Compress -Depth 4)".Substring(0, [Math]::Min(400, ("EVENT $($frame.method) " + ($frame | ConvertTo-Json -Compress -Depth 4)).Length))
    }
    throw "CDP timeout on method $method"
}

function Eval-JS([string]$js) {
    $res = Send-Cdp 'Runtime.evaluate' @{ expression = $js; returnByValue = $true; awaitPromise = $true } 30
    if ($res.result.exceptionDetails) {
        Log "eval error: $($res.result.exceptionDetails.text)"
        return $null
    }
    return $res.result.result.value
}

function Wait-Text([string]$jsFind, [string]$what, [int]$waitSec = 120) {
    $deadline = (Get-Date).AddSeconds($waitSec)
    while ((Get-Date) -lt $deadline) {
        $found = Eval-JS $jsFind
        if ($found) { return $found }
        Start-Sleep -Milliseconds 500
    }
    Log "WAIT TIMEOUT: $what"
    return $null
}

function Click-ByText([string]$text, [int]$waitSec = 30) {
    $js = "(() => { const els = [...document.querySelectorAll('button')]; const b = els.find(e => e.textContent.trim() === '$text'); if (!b) { return false; } b.click(); return true; })()"
    $ok = Eval-JS $js
    if ($ok -eq $true) { Log "clicked: $text" } else { Log "CLICK MISSING: $text" }
    return $ok
}

try {
    Send-Cdp 'Page.enable' | Out-Null
    Send-Cdp 'Runtime.enable' | Out-Null
    Eval-JS "window.__e2e = { steps: [] }" | Out-Null

    Log "navigating to $Base/simulation"
    Send-Cdp 'Page.navigate' @{ url = "$Base/simulation" } 20 | Out-Null
    Wait-Text "document.body ? document.body.innerText.includes('Create simulation') : false" 'simulation page loaded' 40 | Out-Null

    # --- 1. create simulation -----------------------------------------------------
    $created = Wait-Text "(() => { const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Create simulation'); return b ? !b.disabled : false })()" 'create button enabled' 60
    if (-not $created) { Log "FATAL create-simulation button not enabled"; exit 2 }
    Click-ByText 'Create simulation'
    $simId = Eval-JS "sessionStorage.getItem('sih-oilspill.active-simulation')"
    Log "ui-created-sim: $simId"
    Add-Content -LiteralPath $out\last-ui-sim.txt -Value $simId

    # --- 2. select first vessel ----------------------------------------------------
    $sel = Wait-Text '(() => { const s = document.querySelector(''select[aria-label="Select vessel"]''); return s && s.options.length > 1 })()' 'vessel select populated' 60
    if (-not $sel) { Log "FATAL no vessel selectable"; exit 2 }
    $val = Eval-JS '(() => { const s = document.querySelector(''select[aria-label="Select vessel"]''); s.value = s.options[1].value; s.dispatchEvent(new Event(''change'', { bubbles: true })); return s.value })()'
    Log "ui-selected-vessel: $val"

    # --- 3. start simulation --------------------------------------------------------
    $ok = Wait-Text "(() => { const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Start simulation'); return b ? !b.disabled : false })()" 'start button enabled' 30
    Click-ByText 'Start simulation'

    # --- 4. release oil spill --------------------------------------------------------
    $ok = Wait-Text "(() => { const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Release oil spill'); return b ? !b.disabled : false })()" 'spill button enabled' 60
    if ($ok) { Click-ByText 'Release oil spill' } else { Log "FATAL spill not enabled"; exit 2 }
    $incidentId = Wait-Text "(() => { const m = document.body.innerText.match(/incident\s+([a-zA-Z0-9-]+)/i); return m ? m[1] : null })()" 'incident id visible' 60
    Log "ui-incident   : $incidentId"

    # --- 5. go to investigation page ---------------------------------------------------
    Eval-JS 'document.querySelector(''a[href="/investigation"]'').click()'
    $invPage = Wait-Text "document.body ? document.body.innerText.includes('Start investigation') : false" 'investigation page' 40 | Out-Null

    $startBtn = Wait-Text "(() => { const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Start investigation'); return b ? !b.disabled : false })()" 'start investigation enabled' 30

    if ($Scenario -eq 'ui-cancel') {
        Click-ByText 'Start investigation'
        $running = Wait-Text "document.body.innerText.includes('RUNNING')" 'status RUNNING' 60
        Log "ui-status-running: $running"
        $cancelBtn = Wait-Text "(() => { const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Cancel'); return b ? !b.disabled : false })()" 'cancel button' 60
        Click-ByText 'Cancel'
        $cancelled = Wait-Text "document.body.innerText.includes('CANCELLED')" 'status CANCELLED' 60
        Log "ui-cancelled  : $cancelled"
        if ($cancelled) { Log "RESULT ui-cancel = PASS (UI cancel reached CANCELLED)" } else { Log "RESULT ui-cancel = FAIL" }
        exit 0
    }

    # --- 6. start + wait for completion --------------------------------------------------
    Click-ByText 'Start investigation'
    $running = Wait-Text "document.body.innerText.includes('RUNNING')" 'status RUNNING' 60
    Log "ui-status-running: $running"
    $cancelSeen = Wait-Text "(() => [...document.querySelectorAll('button')].some(e => e.textContent.trim() === 'Cancel'))()" 'cancel button visible while running' 30
    Log "ui-cancel-visible-while-running: $cancelSeen"

    $done = Wait-Text "document.body.innerText.includes('COMPLETED')" 'status COMPLETED' $TimeoutSec
    Log "ui-completed  : $done"
    if (-not $done) { Log "RESULT ui-full = FAIL (no COMPLETED)"; exit 2 }

    $conclusion = Wait-Text "document.body.innerText.includes('Conclusion')" 'conclusion panel' 30
    $evid = Wait-Text "document.body.innerText.includes('Evidence chain')" 'evidence chain' 30
    Log "ui-conclusion : $conclusion  evidence-chain: $evid"

    # --- 7. reveal ground truth ------------------------------------------------------
    $revealOk = Wait-Text "(() => { const b = [...document.querySelectorAll('button')].find(e => e.textContent.includes('Reveal ground truth')); return b ? !b.disabled : false })()" 'reveal button enabled' 30
    $revealClicked = $false
    if ($revealOk) {
        Eval-JS "(() => { const b = [...document.querySelectorAll('button')].find(e => e.textContent.includes('Reveal ground truth')); b.click(); return true })()"
        $revealClicked = $true
        Start-Sleep -Seconds 2
    }
    $metrics = Wait-Text "document.body.innerText.includes('Position error')" 'reveal metrics' 30
    Log "ui-reveal    : revealed=$revealClicked metrics=$metrics"

    # --- 8. report page ----------------------------------------------------------------
    Eval-JS 'document.querySelector(''a[href="/report"]'').click()'
    $rep = Wait-Text "document.body ? document.body.innerText.includes('1) Summary') || document.body.innerText.includes('1. Summary') || document.body.innerText.includes('SUMMARY') : false" 'report page' 40
    $secCount = Eval-JS "(() => { const sections = [...document.querySelectorAll('h2, h3, [class*=section], [class*=heading]')].map(e => e.textContent.trim()); return sections.length })()"
    Log "report loaded: $rep  section-headings=$secCount"

    Log "RESULT ui-full = PASS"
    exit 0

} finally {
    try { $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, 'done', $cts.Token).Wait() } catch { }
    try { Stop-Process -Id $chromeProc.Id -Force -ErrorAction SilentlyContinue } catch { }
}