@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 launch\server.py
  if not errorlevel 1 exit /b 0
)
where python >nul 2>nul
if not errorlevel 1 (
  python launch\server.py
  if not errorlevel 1 exit /b 0
)
echo [CHASE-404] Python no disponible. Usando servidor PowerShell integrado...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch\server-windows.ps1"
if errorlevel 1 (
 echo [ERROR] No se pudo iniciar el servidor. Revisa el mensaje anterior.
 pause
 exit /b 1
)
