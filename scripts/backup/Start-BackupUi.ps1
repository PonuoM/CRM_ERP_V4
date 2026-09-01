# Start the office-only backup UI on 127.0.0.1 (never bind 0.0.0.0).
$php = 'C:\xampp\php\php.exe'
if (-not (Test-Path $php)) { throw "php.exe not found at $php" }
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Start-Process $php -ArgumentList @('-S','127.0.0.1:8787','-t', $dir)
Start-Sleep -Seconds 1
Start-Process 'http://127.0.0.1:8787/'
