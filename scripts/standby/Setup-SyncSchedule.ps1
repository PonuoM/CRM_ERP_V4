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
    [int]$IntervalMin = 30,
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
    -At $StartTime `
    -DaysInterval 1

# Add repetition (every N minutes for M hours)
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
    -Description "Auto-sync 7 critical order tables from production every $IntervalMin min ($StartTime - $($DurationHours)h window)" `
    -Force

Write-Host ""
Write-Host "✅ Task '$taskName' registered successfully!" -ForegroundColor Green
Write-Host "   Schedule: Every $IntervalMin min, $StartTime - $(([datetime]$StartTime).AddHours($DurationHours).ToString('HH:mm'))"
Write-Host "   Script:   $scriptPath"
Write-Host ""
Write-Host "To view:   Get-ScheduledTask -TaskName '$taskName'"
Write-Host "To remove: Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
