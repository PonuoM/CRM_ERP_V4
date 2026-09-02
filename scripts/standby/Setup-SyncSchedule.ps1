<#
.SYNOPSIS
  Register a Windows Task Scheduler job that syncs critical order tables
  from production MySQL into a local standby database every 30 minutes
  during business hours (08:00–13:00, Mon–Sat).

.DESCRIPTION
  Creates scheduled task "ERP-StandbySync" that runs sync_tables.php.

.EXAMPLE
  .\Setup-SyncSchedule.ps1
#>
param(
    [string]$Php   = "C:\xampp\php\php.exe",
    [string]$Root  = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent),
    [int]$IntervalMin = 1,
    [string]$StartTime = "08:00",
    [int]$DurationHours = 5
)

$taskName   = "ERP-StandbySync"
$scriptPath = Join-Path $PSScriptRoot "sync_tables.php"

if (-not (Test-Path $Php)) {
    Write-Error "PHP not found at: $Php"
    exit 1
}
if (-not (Test-Path $scriptPath)) {
    Write-Error "sync_tables.php not found at: $scriptPath"
    exit 1
}

# Remove existing task if present
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Removing existing task '$taskName'..."
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$trigger = New-ScheduledTaskTrigger `
    -Daily `
    -At "00:00" `
    -DaysInterval 1

# Add repetition (every N minutes for 24 hours)
$trigger.Repetition = (New-ScheduledTaskTrigger -Once -At "00:00" `
    -RepetitionInterval (New-TimeSpan -Minutes $IntervalMin) `
    -RepetitionDuration (New-TimeSpan -Days 1)).Repetition

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
    -Description "Auto-sync critical order tables from production every $IntervalMin min (24 hours)" `
    -Force

Write-Host ""
Write-Host "✅ Task '$taskName' registered successfully!" -ForegroundColor Green
Write-Host "   Schedule: Every $IntervalMin min, 24 hours a day"
Write-Host "   Script:   $scriptPath"
Write-Host ""
Write-Host "To view:   Get-ScheduledTask -TaskName '$taskName'"
Write-Host "To remove: Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
