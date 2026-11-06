@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo O servico ainda nao foi preparado. Execute PREPARAR-SERVICO.cmd primeiro.
  pause
  exit /b 1
)
if not exist "app.bundle.js" (
  echo Falta app.bundle.js. Execute npm run build.
  pause
  exit /b 1
)
echo Iniciando Painel H.B em http://127.0.0.1:8766/
echo Mantenha esta janela aberta enquanto desejar monitoramento.
echo Para parar com seguranca execute PARAR-SERVICO.cmd.
".venv\Scripts\python.exe" -m service.main --open
if errorlevel 1 (
  echo Nao foi possivel iniciar o servico. Confira a porta e a instalacao.
  pause
  exit /b 1
)
