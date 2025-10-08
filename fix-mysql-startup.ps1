# Fix MySQL HY000/2002 after reboot (Windows + AppServ)
# - Starts MySQL service
# - Quarantines suspicious backup .ibd files that break InnoDB
# - Sets service to delayed-auto + auto-restart on failure

$ErrorActionPreference = 'SilentlyContinue'
$ServiceName = 'mysql8'
$MyIni = 'C:\AppServ\MySQL\my.ini'
$DataDir = 'C:\AppServ\MySQL\data'
$QuarantineDir = 'C:\AppServ\MySQL\quarantine'

Write-Host "=== MySQL Startup Fix Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    pause
    exit 1
}

# Check if MySQL service exists
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $service) {
    Write-Host "ERROR: MySQL service '$ServiceName' not found!" -ForegroundColor Red
    exit 1
}

Write-Host "Step 1: Stopping MySQL service..." -ForegroundColor Yellow
Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$service.Refresh()
if ($service.Status -eq 'Stopped') {
    Write-Host "  ✓ Service stopped successfully" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Service may still be running (Status: $($service.Status))" -ForegroundColor Yellow
}

# Quarantine problematic .ibd files
Write-Host ""
Write-Host "Step 2: Scanning for problematic .ibd files..." -ForegroundColor Yellow

if (-not (Test-Path $DataDir)) {
    Write-Host "  ERROR: Data directory not found: $DataDir" -ForegroundColor Red
    exit 1
}

# Create quarantine directory if it doesn't exist
if (-not (Test-Path $QuarantineDir)) {
    New-Item -ItemType Directory -Path $QuarantineDir -Force | Out-Null
    Write-Host "  Created quarantine directory: $QuarantineDir" -ForegroundColor Cyan
}

# Find suspicious .ibd files (temp/backup files that can break InnoDB)
$suspiciousPatterns = @(
    '#sql-*.ibd',
    '#sql2-*.ibd',
    '*.ibd.bak',
    '*.ibd.tmp',
    '#ib_16384_*.ibd'
)

$quarantinedCount = 0
foreach ($pattern in $suspiciousPatterns) {
    $files = Get-ChildItem -Path $DataDir -Recurse -Filter $pattern -File -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        try {
            $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
            $newName = "$($file.Name).$timestamp"
            $destPath = Join-Path $QuarantineDir $newName
            
            Move-Item -Path $file.FullName -Destination $destPath -Force
            Write-Host "  ✓ Quarantined: $($file.FullName)" -ForegroundColor Green
            $quarantinedCount++
        } catch {
            Write-Host "  ⚠ Failed to quarantine: $($file.FullName)" -ForegroundColor Yellow
        }
    }
}

if ($quarantinedCount -eq 0) {
    Write-Host "  ✓ No problematic files found" -ForegroundColor Green
} else {
    Write-Host "  ✓ Quarantined $quarantinedCount file(s)" -ForegroundColor Green
}

# Configure service for delayed-auto start
Write-Host ""
Write-Host "Step 3: Configuring service startup..." -ForegroundColor Yellow

try {
    # Set to delayed-auto start
    sc.exe config $ServiceName start= delayed-auto | Out-Null
    Write-Host "  ✓ Set startup type to Automatic (Delayed Start)" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Failed to set delayed-auto start" -ForegroundColor Yellow
}

# Configure auto-restart on failure
Write-Host ""
Write-Host "Step 4: Configuring failure recovery..." -ForegroundColor Yellow

try {
    # Reset failure counter after 86400 seconds (1 day)
    # Restart service after 60 seconds on first failure
    # Restart service after 60 seconds on second failure  
    # Restart service after 60 seconds on subsequent failures
    sc.exe failure $ServiceName reset= 86400 actions= restart/60000/restart/60000/restart/60000 | Out-Null
    Write-Host "  ✓ Configured auto-restart on failure (60s delay)" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Failed to configure failure recovery" -ForegroundColor Yellow
}

# Start the service
Write-Host ""
Write-Host "Step 5: Starting MySQL service..." -ForegroundColor Yellow

try {
    Start-Service -Name $ServiceName -ErrorAction Stop
    Start-Sleep -Seconds 3
    
    $service.Refresh()
    if ($service.Status -eq 'Running') {
        Write-Host "  ✓ MySQL service started successfully!" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Service status: $($service.Status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ✗ Failed to start MySQL service!" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting steps:" -ForegroundColor Yellow
    Write-Host "  1. Check MySQL error log: C:\AppServ\MySQL\data\*.err" -ForegroundColor White
    Write-Host "  2. Verify my.ini configuration: $MyIni" -ForegroundColor White
    Write-Host "  3. Check disk space and permissions" -ForegroundColor White
    Write-Host "  4. Try starting manually: net start $ServiceName" -ForegroundColor White
    exit 1
}

# Verify connection (optional test)
Write-Host ""
Write-Host "Step 6: Verifying service health..." -ForegroundColor Yellow

$tcpTest = Test-NetConnection -ComputerName localhost -Port 3306 -WarningAction SilentlyContinue
if ($tcpTest.TcpTestSucceeded) {
    Write-Host "  ✓ MySQL is accepting connections on port 3306" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Port 3306 not responding (may take a moment to initialize)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Fix Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary:" -ForegroundColor White
Write-Host "  - Service Status: $($service.Status)" -ForegroundColor White
Write-Host "  - Startup Type: Automatic (Delayed)" -ForegroundColor White
Write-Host "  - Auto-restart: Enabled (on failure)" -ForegroundColor White
Write-Host "  - Files Quarantined: $quarantinedCount" -ForegroundColor White

if ($quarantinedCount -gt 0) {
    Write-Host ""
    Write-Host "NOTE: Quarantined files are in: $QuarantineDir" -ForegroundColor Cyan
    Write-Host "      You can safely delete them after confirming MySQL works properly." -ForegroundColor Cyan
}

Write-Host ""
pause

