[CmdletBinding()]
param(
    [int]$Port = 8000,
    [string]$FrontendOrigin = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$python = Join-Path $root ".venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
    throw "Python virtual environment not found at $python. Create it with: python -m venv .venv"
}

Push-Location $backend
try {
    $env:FRONTEND_ORIGIN = $FrontendOrigin
    Write-Host "Allowing CORS origin: $FrontendOrigin" -ForegroundColor Cyan
    & $python -m uvicorn app.main:app --host 0.0.0.0 --port $Port --log-level info
} finally {
    Pop-Location
}
