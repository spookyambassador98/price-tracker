# Registers an hourly Windows task that pings production /api/scrape/run-now.
# Requires scripts/.cron-secret.local (gitignored) or CRON_SECRET env var.

$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "trigger-scrape.ps1"
$secretFile = Join-Path $PSScriptRoot ".cron-secret.local"

if (-not $env:CRON_SECRET -and -not (Test-Path $secretFile)) {
  Write-Error "Create scripts/.cron-secret.local with the production CRON_SECRET first."
}

schtasks /Create /F /TN PriceTrackerHourlyScrape /SC HOURLY /MO 1 /TR "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File $script"
schtasks /Query /TN PriceTrackerHourlyScrape /FO LIST
