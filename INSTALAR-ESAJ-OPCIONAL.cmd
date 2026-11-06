@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Prepare o servico antes de instalar conectores opcionais.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" -m pip install -r requirements-esaj.txt
if errorlevel 1 (
  echo Instalacao nao concluida. Verifique as mensagens acima.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" -m pip freeze --all > requirements-esaj.lock
echo Dependencias instaladas e versoes efetivamente resolvidas registradas em requirements-esaj.lock.
echo Reinicie o servico para habilitar as opcoes TJSP e-SAJ.
pause
