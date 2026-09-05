[CmdletBinding()]
param(
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
$backendUrl = "http://localhost:$Port"

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    throw "cloudflared was not found on PATH. Install it from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
}

try {
    $health = Invoke-RestMethod -Uri "$backendUrl/api/health" -TimeoutSec 5
    if ($health.status -ne "ok") { throw "Backend health did not return status=ok." }
} catch {
    throw "FastAPI is not healthy at $backendUrl. Start scripts\start-backend.ps1 first. Details: $($_.Exception.Message)"
}

Write-Host "Starting Cloudflare Quick Tunnel to $backendUrl" -ForegroundColor Cyan
Write-Host "This free URL is temporary. Copy the generated HTTPS URL into Vercel NEXT_PUBLIC_API_URL." -ForegroundColor Yellow
Write-Host "Keep this terminal running while the Vercel frontend uses the tunnel." -ForegroundColor Yellow

# cloudflared writes normal startup diagnostics to stderr. Run through cmd.exe so
# PowerShell receives both streams as text instead of treating the banner as an error.
& cmd.exe /d /c "cloudflared tunnel --url $backendUrl 2>&1" | ForEach-Object {
    $line = $_.ToString()
    if ($line -match "https://[a-z0-9-]+\.trycloudflare\.com") {
        Write-Host "`nPUBLIC API URL: $($Matches[0])`n" -ForegroundColor Green
        Write-Host "Vercel value: NEXT_PUBLIC_API_URL=$($Matches[0])" -ForegroundColor Green
    }
    Write-Output $line
}
