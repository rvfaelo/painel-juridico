@echo off
setlocal EnableExtensions
cd /d "%~dp0"
if not exist "%~dp0central-painel-hb.ps1" (
  echo ERRO: Arquivo central-painel-hb.ps1 nao encontrado ao lado deste CMD.
  pause
  exit /b 1
)
where powershell.exe >nul 2>&1
if errorlevel 1 (
  echo Esta central requer o Windows PowerShell 5.1, incluido no Windows 10/11.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0central-painel-hb.ps1" %*
if errorlevel 1 (
  echo.
  echo Nao foi possivel abrir a central. Use os scripts CMD individuais, se necessario.
  pause
  exit /b 1
)
exit /b 0
