@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "PASTA=%~dp0"
set "URL=file:///%PASTA:\=/%dashboard.html"
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "[uri]::new((Resolve-Path -LiteralPath 'dashboard.html').Path).AbsoluteUri"`) do set "URL=%%I"
set "NAVEGADOR="

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "NAVEGADOR=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined NAVEGADOR if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "NAVEGADOR=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined NAVEGADOR if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "NAVEGADOR=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined NAVEGADOR if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "NAVEGADOR=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined NAVEGADOR if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "NAVEGADOR=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"

if not defined NAVEGADOR (
  echo Chrome ou Edge nao encontrado. Abra o dashboard.html manualmente no navegador.
  pause
  exit /b 1
)

if not exist "app.bundle.js" (
  echo app.bundle.js nao encontrado. Execute "npm run build" nesta pasta.
  pause
  exit /b 1
)

if /I "%~1"=="--minimized" (
  start "" /min "%NAVEGADOR%" --app="%URL%"
  exit /b 0
)

start "" "%NAVEGADOR%" --app="%URL%"
exit /b 0
