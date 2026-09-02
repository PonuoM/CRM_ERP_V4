<#
.SYNOPSIS
  Register a Windows Task Scheduler job that runs a full database dump
  automatically once per day at 06:00 (before office hours).

.DESCRIPTION
  Creates scheduled task "ERP-AutoFullDump". Does NOT upload to Google Drive.
  The dump file (.sql.gz) appears in the Backup UI for manual upload.

.EXAMPLE
  .\Setup-AutoFullDump.ps1
  .\Setup-AutoFullDump.ps1 -At "07:00"
  .\Setup-AutoFullDump.ps1 -Hourly -IntervalHours 4
#>
param(
    [string]$Php   = "C:\xampp\php\php.exe",
    [string]$Root  = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent),
    [string]$At    = "06:00",
    [switch]$Hourly,
    [int]$IntervalHours = 1,
    [int]$DurationHours = 16
)

$taskName   = "ERP-AutoFullDump"
$scriptPath = Join-Path $PSScriptRoot "auto_full_dump.php"

if (-not (Test-Path $Php)) { Write-Error "PHP not found at: $Php"; exit 1 }
if (-not (Test-Path $scriptPath)) { Write-Error "auto_full_dump.php not found at: $scriptPath"; exit 1 }

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Removing existing task '$taskName'..."
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$trigger = New-ScheduledTaskTrigger -Daily -At $At -DaysInterval 1

if ($Hourly) {
    $trigger.Repetition = (New-ScheduledTaskTrigger -Once -At $At `
        -RepetitionInterval (New-TimeSpan -Hours $IntervalHours) `
        -RepetitionDuration (New-TimeSpan -Hours $DurationHours)).Repetition
    $scheduleDesc = "Every $IntervalHours hour(s), $At - $(([datetime]$At).AddHours($DurationHours).ToString('HH:mm'))"
} else {
    $scheduleDesc = "Daily at $At"
}

$action = New-ScheduledTaskAction `
    -Execute $Php `
    -Argument "`"$scriptPath`"" `
    -WorkingDirectory $Root

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

Register-ScheduledTask `
    -TaskName $taskName `
    -Trigger $trigger `
    -Action $action `
    -Settings $settings `
    -Description "Auto full database dump (no Drive upload). Schedule: $scheduleDesc" `
    -Force

Write-Host ""
Write-Host "✅ Task '$taskName' registered successfully!" -ForegroundColor Green
Write-Host "   Schedule: $scheduleDesc"
Write-Host "   Script:   $scriptPath"
Write-Host ""
Write-Host "The dump file (.sql.gz) will appear in the Backup UI for manual Drive upload."
Write-Host ""
Write-Host "Options:"
Write-Host "  Daily (default):  .\Setup-AutoFullDump.ps1"
Write-Host "  Every 4 hours:    .\Setup-AutoFullDump.ps1 -Hourly -IntervalHours 4"
Write-Host "  Every 1 hour:     .\Setup-AutoFullDump.ps1 -Hourly -IntervalHours 1"
