<#
.SYNOPSIS
  Register a Windows Task Scheduler job that checks production server health
  every 5 minutes and sends LINE Notify alerts on down/recovery.

.EXAMPLE
  .\Setup-HealthMonitor.ps1
#>
param(
    [string]$Php   = "C:\xampp\php\php.exe",
    [string]$Root  = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent),
    [int]$IntervalMin = 5,
    [string]$StartTime = "07:00",
    [int]$DurationHours = 11
)

$taskName   = "ERP-HealthMonitor"
$scriptPath = Join-Path $PSScriptRoot "health_monitor.php"

if (-not (Test-Path $Php)) { Write-Error "PHP not found at: $Php"; exit 1 }
if (-not (Test-Path $scriptPath)) { Write-Error "health_monitor.php not found at: $scriptPath"; exit 1 }

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Removing existing task '$taskName'..."
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$trigger = New-ScheduledTaskTrigger -Daily -At $StartTime -DaysInterval 1
$trigger.Repetition = (New-ScheduledTaskTrigger -Once -At $StartTime `
    -RepetitionInterval (New-TimeSpan -Minutes $IntervalMin) `
    -RepetitionDuration (New-TimeSpan -Hours $DurationHours)).Repetition

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
    -Description "Check server health every $IntervalMin min, send LINE Notify on failure" `
    -Force

Write-Host ""
Write-Host "✅ Task '$taskName' registered successfully!" -ForegroundColor Green
Write-Host "   Schedule: Every $IntervalMin min, $StartTime - $(([datetime]$StartTime).AddHours($DurationHours).ToString('HH:mm'))"
Write-Host ""
Write-Host "⚠️  Make sure LINE_NOTIFY_TOKEN is set in scripts/backup/.env" -ForegroundColor Yellow
