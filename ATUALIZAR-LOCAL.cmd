@echo off
setlocal
cd /d "%~dp0"
echo Faca backup protegido, pare o servico e guarde os arquivos antigos antes de atualizar.
echo Este script NAO baixa codigo remoto nem substitui bancos.
if not exist "node_modules\esbuild" (
  echo Dependencias Node ausentes: execute npm ci manualmente.
  pause
  exit /b 1
)
npm test
if errorlevel 1 goto failed
npm run build
if errorlevel 1 goto failed
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" -m unittest discover -s tests -p "test_service*.py" -v
) else (
  python -m unittest discover -s tests -p "test_service*.py" -v
)
if errorlevel 1 goto failed
echo Validacoes concluidas. Reinicie o servico se houver mudancas no Python.
pause
exit /b 0
:failed
echo Uma validacao falhou. Nao considere a atualizacao aprovada.
pause
exit /b 1
