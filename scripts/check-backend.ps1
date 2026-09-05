[CmdletBinding()]
param(
    [string]$BackendUrl = "http://localhost:8000"
)

$ErrorActionPreference = "Stop"
$base = $BackendUrl.TrimEnd("/")
$root = Invoke-WebRequest -Uri "$base/" -UseBasicParsing
$health = Invoke-RestMethod -Uri "$base/api/health"

if ($root.StatusCode -ne 200 -or -not $root.Content.Contains("ClipFetch API")) { throw "Backend root dashboard check failed." }
if ($health.status -ne "ok") { throw "Backend health check failed." }

Write-Output "Backend is reachable: $base"
Write-Output "Root dashboard: HTTP $($root.StatusCode)"
Write-Output "Health: $($health.service) [$($health.status)]"
Write-Output "yt-dlp: $($health.dependencies.yt_dlp)"
Write-Output "FFmpeg: $($health.dependencies.ffmpeg)"
