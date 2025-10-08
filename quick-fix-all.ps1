# Quick Fix - Start all required services and verify setup
# Run this as Administrator

$ErrorActionPreference = 'Stop'

Write-Host "=== Quick Fix: Starting All Services ===" -ForegroundColor Cyan
Write-Host ""

# Check admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Run as Administrator!" -ForegroundColor Red
    pause
    exit 1
}

# 1. Start MySQL
Write-Host "1. Starting MySQL..." -ForegroundColor Yellow
try {
    $mysqlService = Get-Service -Name 'mysql8' -ErrorAction Stop
    if ($mysqlService.Status -ne 'Running') {
        Start-Service -Name 'mysql8'
        Start-Sleep -Seconds 3
        Write-Host "   ✓ MySQL started" -ForegroundColor Green
    } else {
        Write-Host "   ✓ MySQL already running" -ForegroundColor Green
    }
} catch {
    Write-Host "   ✗ Failed to start MySQL: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   → Try running fix-mysql-startup.ps1" -ForegroundColor Yellow
}

# 2. Start Apache
Write-Host ""
Write-Host "2. Starting Apache..." -ForegroundColor Yellow
try {
    $apacheService = Get-Service -Name 'Apache*' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($apacheService) {
        if ($apacheService.Status -ne 'Running') {
            Start-Service -Name $apacheService.Name
            Start-Sleep -Seconds 2
            Write-Host "   ✓ Apache started" -ForegroundColor Green
        } else {
            Write-Host "   ✓ Apache already running" -ForegroundColor Green
        }
    } else {
        Write-Host "   ⚠ Apache service not found - you may be using a different web server" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ✗ Failed to start Apache: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Wait for services to fully initialize
Write-Host ""
Write-Host "3. Waiting for services to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# 4. Test connections
Write-Host ""
Write-Host "4. Testing connections..." -ForegroundColor Yellow

$mysqlOk = Test-NetConnection -ComputerName localhost -Port 3306 -WarningAction SilentlyContinue -InformationLevel Quiet
if ($mysqlOk) {
    Write-Host "   ✓ MySQL listening on port 3306" -ForegroundColor Green
} else {
    Write-Host "   ✗ MySQL not responding on port 3306" -ForegroundColor Red
}

$webOk = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost/" -TimeoutSec 3 -UseBasicParsing -ErrorAction SilentlyContinue
    $webOk = $true
    Write-Host "   ✓ Web server responding on port 80" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Web server not responding on port 80" -ForegroundColor Red
}

# 5. Setup database if needed
Write-Host ""
Write-Host "5. Checking database setup..." -ForegroundColor Yellow

$setupFile = "C:\AppServ\www\CRM_ERP_V4\setup_database.php"
if (Test-Path $setupFile) {
    $phpPath = "C:\AppServ\php\php.exe"
    if (Test-Path $phpPath) {
        try {
            Write-Host "   Running database setup..." -ForegroundColor White
            $output = & $phpPath $setupFile 2>&1
            Write-Host "   $output" -ForegroundColor White
        } catch {
            Write-Host "   ⚠ Setup may have failed: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

# Final status
Write-Host ""
Write-Host "=== Status ===" -ForegroundColor Cyan
Write-Host "MySQL: $(if ($mysqlOk) { '✓ Running' } else { '✗ Not Running' })" -ForegroundColor $(if ($mysqlOk) { 'Green' } else { 'Red' })
Write-Host "Web Server: $(if ($webOk) { '✓ Running' } else { '✗ Not Running' })" -ForegroundColor $(if ($webOk) { 'Green' } else { 'Red' })

Write-Host ""
if ($mysqlOk -and $webOk) {
    Write-Host "All services are running! Try reloading your app at http://localhost:5173" -ForegroundColor Green
} else {
    Write-Host "Some services are not running. Run diagnose-api.ps1 for detailed diagnostics." -ForegroundColor Yellow
}

Write-Host ""
pause

