@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not exist "ABRIR-PAINEL-INTEGRADO.cmd" (
  echo ABRIR-PAINEL-INTEGRADO.cmd nao encontrado nesta pasta.
  pause
  exit /b 1
)

set "TAREFA=Painel H.B"
schtasks /Create /TN "%TAREFA%" /SC ONLOGON /TR "\"%CD%\ABRIR-PAINEL-INTEGRADO.cmd\"" /RL LIMITED /F
if errorlevel 1 (
  echo Nao foi possivel criar a tarefa de inicializacao.
  echo Abra o Prompt de Comando como o mesmo usuario e tente novamente.
  pause
  exit /b 1
)

echo.
echo Tarefa "%TAREFA%" criada por solicitacao sua.
echo O servico pode consultar com a aba fechada, mas nao com o computador desligado.
echo Para remover, execute REMOVER-INICIALIZACAO.cmd.
pause
