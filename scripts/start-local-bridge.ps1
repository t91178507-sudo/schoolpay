$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$bridgeRoot = Join-Path $repoRoot "whatsapp-bridge"
$healthUrl = "http://localhost:8787/health"
$outLog = Join-Path $bridgeRoot "bridge-out.log"
$errLog = Join-Path $bridgeRoot "bridge-err.log"

function Test-BridgeHealth {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 300
  } catch {
    return $false
  }
}

if (-not (Test-Path $bridgeRoot)) {
  throw "Bridge folder not found: $bridgeRoot"
}

if (Test-BridgeHealth) {
  Write-Output "InvoiceHub WhatsApp bridge is already running at $healthUrl"
  exit 0
}

Start-Process `
  -FilePath "node" `
  -ArgumentList "server.js" `
  -WorkingDirectory $bridgeRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog

$started = $false

for ($attempt = 0; $attempt -lt 10; $attempt++) {
  Start-Sleep -Seconds 2

  if (Test-BridgeHealth) {
    $started = $true
    break
  }
}

if (-not $started) {
  Write-Error "Bridge did not start in time. Check logs: $outLog and $errLog"
  exit 1
}

Write-Output "InvoiceHub WhatsApp bridge started."
Write-Output "Health URL: $healthUrl"
Write-Output "QR URL pattern: http://localhost:8787/qr?sessionName=YOUR_SESSION_NAME"
Write-Output "Bridge API key: invoicehub-bridge-local"
