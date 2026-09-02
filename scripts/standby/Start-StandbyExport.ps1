<#
.SYNOPSIS
  Launch the Standby Export web tool on localhost:8899.
  Used when the production server is down and orders need to be exported.

.EXAMPLE
  .\Start-StandbyExport.ps1
#>
param(
    [string]$Php  = "C:\xampp\php\php.exe",
    [int]$Port    = 8899
)

if (-not (Test-Path $Php)) {
    Write-Error "PHP not found at: $Php"
    exit 1
}

$webDir = Join-Path $PSScriptRoot "web"
if (-not (Test-Path $webDir)) {
    Write-Error "Web directory not found at: $webDir"
    exit 1
}

# Check if port is already in use
$listening = netstat -ano | Select-String ":$Port" | Select-String "LISTENING"
if ($listening) {
    Write-Host "Port $Port already in use — opening browser..." -ForegroundColor Yellow
    Start-Process "http://127.0.0.1:$Port/"
    exit 0
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  📦 Standby Export Tool — Emergency Order Export ║" -ForegroundColor Cyan
Write-Host "║  Use this when production server is DOWN         ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting PHP server on http://127.0.0.1:$Port/ ..."
Write-Host "Press Ctrl+C to stop."
Write-Host ""

# Open browser after a short delay
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 1
    Start-Process "http://127.0.0.1:$using:Port/"
} | Out-Null

# Run PHP built-in server (foreground — keeps terminal open)
& $Php -S "127.0.0.1:$Port" -t $webDir
