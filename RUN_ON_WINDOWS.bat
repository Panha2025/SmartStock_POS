@echo off
cd /d "%~dp0"
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo Install Node.js 20 or newer, then open this launcher again.
  pause
  exit /b 1
)
start "SmartStock Local Server" cmd /k "node server.mjs"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173/"
