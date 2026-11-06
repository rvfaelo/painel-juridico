@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Execute PREPARAR-SERVICO.cmd.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" -m service.main --status
pause
