# Live-safe dump UI. Loads project-root .env then optional scripts/backup/.env overlay.
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $here '..\..')
$loaded = $false
foreach ($envFile in @(
    (Join-Path $root '.env'),
    (Join-Path $root '.env.local'),
    (Join-Path $here '.env')
  )) {
  if (-not (Test-Path $envFile)) { continue }
  $loaded = $true
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $k, $v = $_ -split '=', 2
    Set-Item -Path "Env:$($k.Trim())" -Value $v.Trim()
  }
}
if (-not $loaded) { throw "Create .env at the project root from .env.example first" }
& (Join-Path $here 'Start-BackupUi.ps1')
Write-Output 'Use the Dump button in the browser UI (progress updates by itself). POST http://127.0.0.1:8787/api.php?action=dump starts a background job.'
