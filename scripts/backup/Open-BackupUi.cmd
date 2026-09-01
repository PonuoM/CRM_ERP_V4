@echo off
setlocal
cd /d "%~dp0"
set "PHP=C:\xampp\php\php.exe"
if not exist "%PHP%" (
  echo ไม่พบ php.exe ที่ %PHP%
  pause
  exit /b 1
)
start "ERP backup UI" "%PHP%" -S 127.0.0.1:8787 -t "%~dp0"
timeout /t 1 /nobreak >nul
start http://127.0.0.1:8787/
