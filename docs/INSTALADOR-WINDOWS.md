# Instalador Windows do Painel H.B

O instalador por usuário fica em `dist\Instalar-Painel-HB-<versao>.exe`.
Ele não pede administrador, cria atalho no desktop e no menu Iniciar,
registra desinstalador e inclui Python 3.12.10, bibliotecas offline e
Node.js para a validação local dos cadastros.

## Como gerar

Pré-requisitos na máquina de desenvolvimento:

- Node.js 24 ou superior (para `npm run build`).
- Python 3.12 com as dependências de desenvolvimento.
- Inno Setup 6.7.4 (o compilador `ISCC.exe`).
- `release-offline-deps\` com o instalador oficial do Python e as wheels.
- `node.exe` x64 versão 24 ou superior. O build usa o Node do `PATH` ou
  `C:\Program Files\nodejs\node.exe`; para fixar uma versão específica,
  informe `--node`.

Comando:

```powershell
.\.venv\Scripts\python.exe tools\build-installer.py
```

Para manter o EXE abaixo de 100 MB, o build de referência usa o binário
do Node.js 24.22.3 LTS (89,59 MB), que resulta em cerca de 97,9 MB:

```powershell
.\.venv\Scripts\python.exe tools\build-installer.py `
  --node "C:\caminho\para\node-v24.22.3.exe"
```

O script executa `npm run build`, gera o ZIP de release com
`tools\package.py`, monta `build\installer-stage`, compila o `.iss` e
grava em `dist\`:

- `Instalar-Painel-HB-<versao>.exe`
- `Instalar-Painel-HB-<versao>.sha256.txt`
- `LEIA-ME-PRIMEIRO.txt`

Para reutilizar o ZIP e o bundle já gerados:

```powershell
.\.venv\Scripts\python.exe tools\build-installer.py --skip-build --skip-package
```

Se o Inno Setup estiver em outro caminho:

```powershell
.\.venv\Scripts\python.exe tools\build-installer.py --iscc "C:\...\ISCC.exe"
```

## O que o instalador faz

1. Copia o painel para `%LOCALAPPDATA%\Programs\PainelHB`.
2. Copia `node.exe` para `runtime\` e as dependências para `dependencias\`.
3. Executa `tools\installer\install-runtime.ps1`, que:
   - reutiliza um Python 3.12 x64 já instalado ou instala uma cópia
     privada em `%LOCALAPPDATA%\Programs\PainelHB-Python312`;
   - cria o `.venv` e instala as wheels sem internet;
   - registra o Node embutido no `PATH` do `.venv` via `sitecustomize.py`;
   - valida imports, `pip check`, Node e fuso horário;
   - apaga a pasta temporária `dependencias`.
4. Cria atalhos e o desinstalador.
5. Oferece a instalação opcional do conector TJSP e-SAJ.

## Teste rápido

Instalação silenciosa em pasta temporária:

```powershell
$app = "$env:TEMP\painel-teste\app"
Start-Process .\dist\Instalar-Painel-HB-0.6.11.exe -Wait -ArgumentList `
  '/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART',('/DIR="' + $app + '"')
```

Validações:

```powershell
& "$app\.venv\Scripts\python.exe" -c "import shutil; print(shutil.which('node'))"
& "$app\.venv\Scripts\python.exe" -m pip check
& "$app\CENTRAL-PAINEL-HB.cmd" -SelfTest
```

Desinstalação:

```powershell
Start-Process "$app\unins000.exe" -Wait -ArgumentList '/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART'
```

## Limitações conhecidas

- O EXE não é assinado. O Windows pode mostrar o aviso do SmartScreen na
  primeira execução; o leia-me do cliente explica como continuar.
- A instalação é offline; DJEN e DataJud continuam exigindo internet.
- Se o computador já tiver um Python 3.12 x64, ele será reutilizado em vez
  de criar uma segunda cópia. Se esse Python for removido depois, o `.venv`
  do painel deixa de funcionar e o instalador precisa ser executado de novo.
- Os dados ficam em `%LOCALAPPDATA%\PautaJuridico` e não são apagados pelo
  desinstalador.
- O pacote não inclui dados, banco, anexos, tokens ou credenciais.
