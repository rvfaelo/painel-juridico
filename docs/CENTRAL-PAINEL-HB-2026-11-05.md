# Painel H.B — Central de controle do Windows

## Acesso

Abra **CENTRAL-PAINEL-HB.cmd** na raiz do projeto (sem instalar software
adicional). Ele executa **central-painel-hb.ps1** no Windows PowerShell 5.1,
incluído no Windows 10/11. A interface tem abas Início, Instalação e
Manutenção, estado de serviço local e indicadores de ambiente Python.

O antigo conjunto de arquivos CMD foi mantido como implementação dos
comandos; a central é somente um ponto de acesso unificado. Não se altera
a instalação do Python, o banco jurídico, o serviço Python nem os dados do
usuário quando apenas se abre a central.

## Comandos

- Início: abrir painel simples (sem consultas), abrir integrado (serviço
  local), verificar estado e parar serviço com confirmação.
- Instalação: preparar bibliotecas offline ou online, instalar e-SAJ offline
  ou online. Ao tentar instalar offline sem extrair o ZIP correspondente,
  a central informa exatamente o pacote necessário e não executa nada.
- Manutenção: habilitar/desabilitar inicialização automática do Windows
  (com confirmação), executar validação de código local (Node.js necessário)
  e abrir a pasta do projeto.
- Dados e backup continuam no painel web. A central não migra, envia,
  sobrescreve, apaga ou restaura processos.

## Dois ZIPs, um único lugar para abrir

1. Extraia **Painel-HB-v0.4.0-Windows.zip**.
2. Extraia **Painel-HB-Dependencias-Offline-Win64-Python312.zip** na mesma
   pasta do painel, para que exista a pasta **dependencias-offline** junto a
   **dashboard.html**.
3. Execute **CENTRAL-PAINEL-HB.cmd** e use **Instalação → Instalar
   dependências offline**.
4. Após a instalação, selecione **Início → Abrir painel integrado**.

O modo simples dispensa Python; o modo integrado depende de Python e requer
internet para consultar os tribunais, não para instalar as bibliotecas offline.
O pacote de dependências foi preparado para Windows 64 bits e Python 3.12.
Os scripts CMD originais continuam disponíveis caso a interface gráfica
não seja suportada por alguma configuração do Windows.

## Verificação

- Testes de descoberta dos 11 comandos e simulação dos botões sem iniciar
  processos, além de capturas das três abas.
- A central verifica **somente** a API de saúde
  http://127.0.0.1:8766/api/v1/health; não executa consultas judiciais
  ao abrir ou atualizar o status.
- Capturas: docs/ui-test/central-painel-hb-0.png,
  docs/ui-test/central-painel-hb-1.png e
  docs/ui-test/central-painel-hb-2.png.
- Comandos de desenvolvedor: npm test, npm run build,
  python tools/package.py, python tools/smoke-release.py.
