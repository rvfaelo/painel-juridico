@echo off
setlocal EnableExtensions
set "TAREFA=Painel H.B"
schtasks /Delete /TN "%TAREFA%" /F
if errorlevel 1 (
  echo A tarefa nova nao foi encontrada. Verificando o nome anterior...
  schtasks /Delete /TN "Pauta - Painel Juridico" /F
  if errorlevel 1 (
    echo Nenhuma tarefa de inicializacao do painel foi encontrada ou removida.
    pause
    exit /b 1
  )
)
echo Tarefa removida. O painel nao abrira mais automaticamente ao entrar no Windows.
pause
