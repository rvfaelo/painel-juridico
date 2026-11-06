# Migração para o aplicativo local (0.3.0)

> **Registro histórico da transição para a versão 0.3.0.** Na versão atual
> **0.4.0**, consultas não são mais executadas por temporizador do navegador:
> exigem o serviço Python local em `127.0.0.1:8765`. Para operação atual e
> migração de `file://` para `localhost`, leia
> `LEIA-ME.md` e `docs/SERVICO-LOCAL-0.4.0.md` antes de seguir passos antigos.

O Pauta deixou de ser uma extensão do Chrome/Edge. Agora é um aplicativo
estático: basta abrir `dashboard.html` no Chrome ou no Edge. Não há servidor,
service worker, auxiliar nativo nem mensagens `chrome.*`.

## O que mudou

| Antes (extensão 0.2.16) | Agora (aplicativo 0.3.0) |
| --- | --- |
| `manifest.json` + `background.js` | `engine.js` executado na própria página |
| `chrome.runtime.sendMessage` | chamadas diretas às funções do aplicativo |
| `chrome.alarms` a cada minuto | temporizador da página a cada minuto |
| auxiliar Native Messaging (`native.js`/`companion/`) | `transport.js` com `fetch` direto |
| dados em `chrome-extension://<id>` | dados em `file:///.../dashboard.html` |
| sem atualização automática de fontes | horários configuráveis, padrão 08:00 e 18:00 |

O código-fonte continua separado em módulos (`core.js`, `db.js`, `runner.js`,
`sources.js` etc.). Para abrir por `file://`, o navegador não aceita imports de
módulos ES; por isso `tools/build-app.mjs` gera `app.bundle.js` com esbuild.
**Edite os módulos, não o bundle.**

## Como abrir

1. Dê dois cliques em `ABRIR-PAINEL.cmd` (procura Chrome e depois Edge e abre em
   modo aplicativo), ou
2. abra `dashboard.html` diretamente no Chrome/Edge.

O primeiro acesso começa vazio. O banco usa IndexedDB no perfil do navegador.
Chrome e Edge mantêm bancos separados, e o caminho do arquivo faz parte da
origem local: evite mover a pasta depois de cadastrar dados. Se precisar mover,
exporte um backup protegido antes.

Se `app.bundle.js` estiver ausente ou desatualizado após uma alteração no
código, execute na pasta do projeto:

```powershell
npm run build
```

## Migrar os dados da extensão

O IndexedDB é isolado por origem. O aplicativo aberto por `file://` **não
consegue ler** o banco gravado em `chrome-extension://<id>`. Não existe
importação automática.

Antes de desinstalar a extensão antiga:

1. Abra a extensão antiga.
2. Use **Exportar backup** e escolha uma senha (mínimo de 10 caracteres).
3. Abra o novo `dashboard.html`.
4. Vá em **Fontes e ajustes → Dados sob seu controle → Restaurar backup**.
5. Selecione o arquivo, informe a senha e confira a prévia.
6. Confirme a substituição e verifique processos, anexos, tarefas,
   recebimentos e publicações.
7. Só então remova a extensão de `chrome://extensions` ou `edge://extensions`.

A pasta `arquivo/extensao-0.2.16/` guarda os arquivos antigos apenas para
consulta. Sem o backup exportado, os dados antigos permanecem inacessíveis ao
aplicativo local. O backup também é necessário se você trocar de navegador ou
de computador.

## Atualização automática das fontes

Em **Fontes e ajustes → Atualização automática**:

- o padrão é **08:00 e 18:00**, no fuso `America/Sao_Paulo`;
- é possível informar de 1 a 6 horários no formato `HH:MM`;
- a consulta adiciona à fila os processos com CNJ e, se configurada, a busca
  pela OAB/UF;
- ao reabrir o painel, a última janela perdida é recuperada uma vez;
- consultas já na fila não são duplicadas;
- **Consultar agora** força uma rodada manual, mesmo fora do horário.

Limitação importante: o navegador precisa estar aberto. Um aplicativo estático
não executa com o navegador fechado nem com o computador desligado. Se a janela
ficar minimizada, o navegador pode reduzir a frequência dos temporizadores,
mas a fila é persistida e retoma quando a página volta a executar.

Isso é diferente de atualizar o programa: esta versão não baixa novas versões
do Pauta sozinha. Para atualizar o aplicativo, feche a janela, substitua os
arquivos mantendo o mesmo caminho de `dashboard.html`, execute `npm run build`
se necessário e abra novamente. Faça backup antes.

## Iniciar com o Windows

Execute uma vez:

```text
INSTALAR-INICIALIZACAO.cmd
```

Ele cria a tarefa agendada **Pauta - Painel Jurídico** para o usuário atual, que
abre o painel minimizado ao entrar no Windows. Não requer administrador. Para
remover:

```text
REMOVER-INICIALIZACAO.cmd
```

Se a política da máquina bloquear `schtasks`, crie manualmente um atalho para
`ABRIR-PAINEL.cmd` na pasta de inicialização do Windows (`shell:startup`).
O navegador abrirá junto com o Windows; para economizar recursos, ele pode ser
minimizado, mas não fechado. A tarefa usa `ABRIR-PAINEL.cmd --minimized`; para
abrir uma janela visível, use o atalho normal.

## Acesso às fontes públicas

O transporte agora é `fetch` direto:

- **DJEN**: a API pública responde com `Access-Control-Allow-Origin: *`; a
  consulta funciona no modo arquivo local.
- **DataJud**: exige `Authorization` e `Content-Type: application/json`, o que
  dispara uma requisição `OPTIONS` (preflight). A API pública do CNJ não envia
  os cabeçalhos CORS necessários, então o navegador costuma bloquear a leitura
  da resposta. Isso não é um defeito do Pauta e não deve ser contornado
  desativando a segurança do navegador.
- **HTTP 429**: a fonte limitou a frequência. Aguarde alguns minutos e reduza
  os horários automáticos.
- **Timeout**: o limite por consulta é de 18 segundos.

Sem auxiliar nativo, não há caminho interno para contornar CORS. Se o DataJud
for indispensável, será necessário um componente intermediário (por exemplo,
um servidor local ou proxy autorizado) em uma entrega futura. O diagnóstico em
**Fontes e ajustes → Verificar conexão DJEN e DataJud** mostra o resultado sem
usar dados da carteira.

## Dados, backup e segurança

- O banco e os anexos ficam no IndexedDB do perfil do navegador; não há nuvem
  nem sincronização.
- Exporte backups com senha regularmente. A criptografia é AES-256-GCM com
  PBKDF2-SHA256; não existe recuperação de senha.
- A restauração substitui os dados atuais após prévia e confirmação.
- O arquivo exportado protege o conteúdo, mas o banco local não é criptografado
  por essa função. Use a senha do Windows e o perfil do navegador.
- Limpar dados de navegação, trocar de perfil ou desinstalar o navegador pode
  apagar o banco. Mantenha backups fora do computador quando apropriado.

## Verificação

```powershell
npm test          # domínio, fontes simuladas, fila e agendador
npm run test:ui   # Playwright abrindo file:// em perfil limpo
npm run probe:live # DJEN real e DataJud a partir de file:// (sem dados da carteira)
npm run build     # regenera app.bundle.js
python tools/package.py       # gera o ZIP portátil
python tools/smoke-release.py # confere o ZIP em pasta temporária
```

O teste de interface cobre abertura por `file://`, IndexedDB, cadastro,
consulta DJEN simulada, exportação de backup criptografado, restauração,
gravação dos horários automáticos e retomada de uma consulta interrompida por
fechamento da aba. O diagnóstico `probe:live` usa User-Agent
normal, porque o WAF do DJEN recusa o agente do Chromium headless. Em
05/11/2026 o DJEN retornou HTTP 200 com `Access-Control-Allow-Origin: *`; o
DataJud continuou bloqueado por CORS (`TypeError: Failed to fetch`). Respostas
simuladas não comprovam cobertura real dos tribunais.

## Arquivos removidos da pasta ativa

Foram movidos para `arquivo/extensao-0.2.16/` (e para o ZIP correspondente):
`manifest.json`, `background.js`, `native.js`, `helper-preflight.js`,
`companion/`, `INSTALAR-AUXILIAR.cmd`, `REMOVER-AUXILIAR.cmd`, ferramentas do
auxiliar e os testes da extensão. O histórico em `changelog.js` e os documentos
anteriores a esta migração permanecem como registro.
