<#
.SYNOPSIS
  Register a Windows Task Scheduler job that runs GFS rotation cleanup
  daily at 02:00 to delete old .sql.gz dump files.

.EXAMPLE
  .\Setup-Cleanup.ps1
#>
param(
    [string]$Php  = "C:\xampp\php\php.exe",
    [string]$Root = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent)
)

$taskName   = "ERP-BackupCleanup"
$scriptPath = Join-Path $PSScriptRoot "cleanup_old_dumps.php"

if (-not (Test-Path $Php)) { Write-Error "PHP not found at: $Php"; exit 1 }
if (-not (Test-Path $scriptPath)) { Write-Error "cleanup_old_dumps.php not found at: $scriptPath"; exit 1 }

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Removing existing task '$taskName'..."
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$trigger = New-ScheduledTaskTrigger -Daily -At "02:00"

$action = New-ScheduledTaskAction `
    -Execute $Php `
    -Argument "`"$scriptPath`"" `
    -WorkingDirectory $Root

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $taskName `
    -Trigger $trigger `
    -Action $action `
    -Settings $settings `
    -Description "GFS rotation: delete daily dumps >30d, monthly dumps >6mo" `
    -Force

Write-Host ""
Write-Host "✅ Task '$taskName' registered successfully!" -ForegroundColor Green
Write-Host "   Schedule: Daily at 02:00"
Write-Host "   Policy:   Keep daily 30d, monthly 6mo, min 3 files always"
Write-Host ""
Write-Host "Tip: Test with --dry-run first:"
Write-Host "  php `"$scriptPath`" --dry-run"
