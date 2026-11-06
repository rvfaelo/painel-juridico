@echo off
setlocal
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
  echo Ambiente virtual do Pauta ja existe.
  goto install
)
where py >nul 2>&1
if not errorlevel 1 (
  py -3.12 -m venv .venv >nul 2>&1
  if errorlevel 1 py -3 -m venv .venv
)
if not exist ".venv\Scripts\python.exe" (
  python -m venv .venv
)
if not exist ".venv\Scripts\python.exe" (
  echo Python 3.11 ou superior com venv nao encontrado. Instale Python e execute novamente.
  pause
  exit /b 1
)
:install
".venv\Scripts\python.exe" --version
echo Instalando dependencias do fuso horario e cliente MCP DataJud fixado...
".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -r requirements.txt
if errorlevel 1 (
  echo Dependencias nao instaladas. Confira sua conexao e execute novamente.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" -c "from zoneinfo import ZoneInfo; ZoneInfo('America/Sao_Paulo')"
if errorlevel 1 (
  echo Banco de fuso horario indisponivel. Nao inicie o monitoramento.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" -c "from mcp_juridico_brasil.datajud.client import DataJudClient; print('Cliente MCP DataJud instalado.')"
if errorlevel 1 exit /b 1
echo Servico preparado. DataJud usa mcp-juridico-brasil; DJEN usa o conector local.
pause
