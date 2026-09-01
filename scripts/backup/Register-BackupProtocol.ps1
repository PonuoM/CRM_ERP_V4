# Register primaerp-backup:// so the ERP backup page can open the office dump UI.
# HKCU only — no Administrator. Run once on this PC:
#   powershell -ExecutionPolicy Bypass -File scripts\backup\Register-BackupProtocol.ps1
# Do not deploy this folder under public_html.

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcher = Join-Path $here 'Open-BackupUi.cmd'
if (-not (Test-Path -LiteralPath $launcher)) {
    throw "ไม่พบ Open-BackupUi.cmd ที่ $launcher"
}
$launcher = (Resolve-Path -LiteralPath $launcher).Path

$root = 'HKCU:\Software\Classes\primaerp-backup'
New-Item -Path $root -Force | Out-Null
Set-ItemProperty -Path $root -Name '(default)' -Value 'URL:Prima ERP Backup'
New-ItemProperty -Path $root -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null

$commandKey = Join-Path $root 'shell\open\command'
New-Item -Path $commandKey -Force | Out-Null
# cmd.exe so .cmd runs even when the browser starts us from System32
$command = 'cmd.exe /c "' + $launcher + '"'
Set-ItemProperty -Path $commandKey -Name '(default)' -Value $command

Write-Output "ลงทะเบียน primaerp-backup:// แล้ว → $launcher"
Write-Output "กดปุ่มบนหน้าสำรองใน ERP ครั้งแรก เบราว์เซอร์จะถามให้อนุญาตเปิดแอป"
