# Hourly scrape trigger for production (external scheduler helper).
# Used by Windows Task Scheduler or any cron that can run PowerShell.

$ErrorActionPreference = "Stop"

$AppUrl = if ($env:APP_URL) { $env:APP_URL.TrimEnd("/") } else { "https://price-tracker-psi-red.vercel.app" }
$Secret = $env:CRON_SECRET

if (-not $Secret) {
  $localFile = Join-Path $PSScriptRoot ".cron-secret.local"
  if (Test-Path $localFile) {
    $Secret = (Get-Content $localFile -Raw).Trim()
  }
}

if (-not $Secret) {
  Write-Error "Set CRON_SECRET env var or create scripts/.cron-secret.local"
}

$uri = "$AppUrl/api/scrape/run-now"
$response = Invoke-RestMethod -Uri $uri -Method POST -Headers @{
  Authorization = "Bearer $Secret"
  "Content-Type" = "application/json"
}

Write-Output ($response | ConvertTo-Json -Compress)
