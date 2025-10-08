# Diagnose API and MySQL Connection Issues
# Run this to check if MySQL is working and API can connect

$ErrorActionPreference = 'Continue'

Write-Host "=== CRM/ERP API Diagnostics ===" -ForegroundColor Cyan
Write-Host ""

# 1. Check MySQL Service
Write-Host "1. Checking MySQL Service Status..." -ForegroundColor Yellow
$service = Get-Service -Name 'mysql8' -ErrorAction SilentlyContinue
if ($service) {
    Write-Host "   Status: $($service.Status)" -ForegroundColor $(if ($service.Status -eq 'Running') { 'Green' } else { 'Red' })
    Write-Host "   Startup Type: $($service.StartType)" -ForegroundColor White
    
    if ($service.Status -ne 'Running') {
        Write-Host "   ✗ MySQL is not running!" -ForegroundColor Red
        Write-Host "   → Run fix-mysql-startup.ps1 to start it" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ✗ MySQL service not found!" -ForegroundColor Red
    exit 1
}

# 2. Check Port 3306
Write-Host ""
Write-Host "2. Testing MySQL Port 3306..." -ForegroundColor Yellow
$portTest = Test-NetConnection -ComputerName localhost -Port 3306 -WarningAction SilentlyContinue -InformationLevel Quiet
if ($portTest) {
    Write-Host "   ✓ Port 3306 is listening" -ForegroundColor Green
} else {
    Write-Host "   ✗ Port 3306 is not responding" -ForegroundColor Red
    Write-Host "   → MySQL may not be fully started" -ForegroundColor Yellow
}

# 3. Check if PHP is available
Write-Host ""
Write-Host "3. Checking PHP Installation..." -ForegroundColor Yellow
$phpPath = "C:\AppServ\php\php.exe"
if (Test-Path $phpPath) {
    Write-Host "   ✓ PHP found at: $phpPath" -ForegroundColor Green
    
    # Get PHP version
    $phpVersion = & $phpPath -v 2>&1 | Select-Object -First 1
    Write-Host "   Version: $phpVersion" -ForegroundColor White
} else {
    Write-Host "   ⚠ PHP not found at expected location" -ForegroundColor Yellow
    Write-Host "   Searching for PHP..." -ForegroundColor White
    
    $phpAlt = Get-Command php -ErrorAction SilentlyContinue
    if ($phpAlt) {
        Write-Host "   ✓ PHP found in PATH: $($phpAlt.Source)" -ForegroundColor Green
        $phpPath = $phpAlt.Source
    } else {
        Write-Host "   ✗ PHP not found!" -ForegroundColor Red
    }
}

# 4. Test database connection directly
Write-Host ""
Write-Host "4. Testing Database Connection..." -ForegroundColor Yellow

if ($service.Status -eq 'Running' -and (Test-Path $phpPath)) {
    $testScript = @'
<?php
try {
    $pdo = new PDO(
        'mysql:host=127.0.0.1;port=3306;charset=utf8mb4',
        'root',
        '12345678',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    echo "✓ Connected to MySQL\n";
    
    // Check if database exists
    $stmt = $pdo->query("SHOW DATABASES LIKE 'mini_erp'");
    if ($stmt->fetch()) {
        echo "✓ Database 'mini_erp' exists\n";
        
        // Try to select from it
        $pdo->exec("USE mini_erp");
        $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
        echo "✓ Found " . count($tables) . " tables\n";
        
        if (count($tables) > 0) {
            echo "Tables: " . implode(", ", array_slice($tables, 0, 5));
            if (count($tables) > 5) echo " ...";
            echo "\n";
        } else {
            echo "⚠ Database is empty - run setup_database.php\n";
        }
    } else {
        echo "✗ Database 'mini_erp' does not exist\n";
        echo "→ Run setup_database.php to create it\n";
    }
} catch (PDOException $e) {
    echo "✗ Connection failed: " . $e->getMessage() . "\n";
}
'@
    
    $tempFile = Join-Path $env:TEMP "db_test_$(Get-Date -Format 'yyyyMMddHHmmss').php"
    $testScript | Out-File -FilePath $tempFile -Encoding UTF8
    
    $result = & $phpPath $tempFile 2>&1
    Write-Host "   $result" -ForegroundColor White
    
    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "   ⊘ Skipped (prerequisites not met)" -ForegroundColor Yellow
}

# 5. Check API directory
Write-Host ""
Write-Host "5. Checking API Files..." -ForegroundColor Yellow
$apiDir = "C:\AppServ\www\CRM_ERP_V4\api"
if (Test-Path $apiDir) {
    Write-Host "   ✓ API directory exists: $apiDir" -ForegroundColor Green
    
    $requiredFiles = @('index.php', 'config.php')
    foreach ($file in $requiredFiles) {
        $filePath = Join-Path $apiDir $file
        if (Test-Path $filePath) {
            Write-Host "   ✓ $file found" -ForegroundColor Green
        } else {
            Write-Host "   ✗ $file missing!" -ForegroundColor Red
        }
    }
} else {
    Write-Host "   ✗ API directory not found!" -ForegroundColor Red
}

# 6. Check Apache/Web Server
Write-Host ""
Write-Host "6. Checking Web Server..." -ForegroundColor Yellow
$apacheService = Get-Service -Name 'Apache*' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($apacheService) {
    Write-Host "   Status: $($apacheService.Status) ($($apacheService.Name))" -ForegroundColor $(if ($apacheService.Status -eq 'Running') { 'Green' } else { 'Red' })
    
    if ($apacheService.Status -ne 'Running') {
        Write-Host "   → Start Apache to enable the API" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠ Apache service not found" -ForegroundColor Yellow
    Write-Host "   → Check if you're using a different web server" -ForegroundColor White
}

# 7. Test API endpoint
Write-Host ""
Write-Host "7. Testing API Health Endpoint..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://localhost/CRM_ERP_V4/api/index.php/health" -TimeoutSec 5 -ErrorAction Stop
    $content = $response.Content | ConvertFrom-Json
    
    Write-Host "   ✓ API is responding!" -ForegroundColor Green
    Write-Host "   Response: $($response.Content)" -ForegroundColor White
} catch {
    Write-Host "   ✗ API not responding" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Message -match "Unable to connect") {
        Write-Host "   → Make sure Apache is running and configured for this project" -ForegroundColor Yellow
    }
}

# Summary
Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host ""

$issues = @()
if ($service.Status -ne 'Running') { $issues += "MySQL service is not running" }
if (-not $portTest) { $issues += "MySQL port 3306 not responding" }
if (-not (Test-Path $phpPath)) { $issues += "PHP not found" }
if (-not $apacheService -or $apacheService.Status -ne 'Running') { $issues += "Apache not running" }

if ($issues.Count -eq 0) {
    Write-Host "All checks passed! ✓" -ForegroundColor Green
    Write-Host ""
    Write-Host "If you're still getting errors:" -ForegroundColor Yellow
    Write-Host "  1. Check browser console for detailed error messages" -ForegroundColor White
    Write-Host "  2. Check Apache error log: C:\AppServ\Apache\logs\error.log" -ForegroundColor White
    Write-Host "  3. Check MySQL error log: C:\AppServ\MySQL\data\*.err" -ForegroundColor White
} else {
    Write-Host "Issues found:" -ForegroundColor Red
    foreach ($issue in $issues) {
        Write-Host "  • $issue" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Run fix-mysql-startup.ps1 (if MySQL issues)" -ForegroundColor White
    Write-Host "  2. Start Apache service (if web server issues)" -ForegroundColor White
    Write-Host "  3. Run setup_database.php (if database not initialized)" -ForegroundColor White
}

Write-Host ""
pause

