$ErrorActionPreference = "Stop"

$healthUrl = "http://localhost:8787/health"

try {
  $response = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 3
  Write-Output $response.Content
} catch {
  Write-Error "Bridge is not reachable at $healthUrl"
  exit 1
}
