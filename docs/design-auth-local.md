# Autenticação local do Painel H.B — implementação e operação

> Implementado na versão 0.6.4. O desenho original permanece abaixo; as decisões efetivamente adotadas estão resumidas no item 0.

## 0. Status da implementação

- `/api/v1/session` deixou de entregar o CSRF sem sessão.
- A Central/iniciador abre uma URL com token de bootstrap de uso único; o serviço troca o token por cookie `HttpOnly` e `SameSite=Strict` e redireciona para `/`.
- O token expira em 120 segundos, é de uso único e nunca é registrado no log do serviço.
- A sessão existe apenas em memória e é invalidada quando o serviço reinicia.
- `auth-admin.secret` é criado na pasta de dados com permissão restrita (best effort `icacls` no Windows) e usado por `updates/updater.py`, `--stop` e `--status`.
- O endpoint `/api/v1/bootstrap` é administrativo e exige `X-Pauta-Admin`.
- `/api/v1/status`, escrita e leitura de dados exigem cookie de sessão + CSRF; `/health` continua aberto para a Central.
- O modo `file://` continua sem autenticação HTTP e sem serviço.
- A compatibilidade de atualização cobre a versão anterior: o updater tenta o segredo administrativo e, se receber 403, usa o CSRF de sessão antigo.

## 1. Modelo de ameaça

O serviço escuta apenas em `127.0.0.1`, mas isso não autentica quem chama a porta.

- **Outro usuário do Windows:** pode abrir `http://127.0.0.1:8766/api/v1/session` se tiver acesso à rede local/loopback da mesma máquina, dependendo da configuração do Windows e do navegador. O Host check impede DNS rebinding, não identifica o usuário.
- **Processo local malicioso:** pode chamar a API diretamente, ler a resposta de `/session` e usar o token CSRF. Também pode ler arquivos acessíveis ao mesmo usuário.
- **Página web maliciosa:** não consegue ler a resposta por same-origin/CORS, e o CSRF/Origin bloqueia escrita. Ainda assim, `/session` não deve ser tratada como autenticação.
- **Usuário legítimo:** abre o painel pela Central, pelo iniciador integrado ou manualmente em `http://127.0.0.1:8766/`.

Objetivos:

1. impedir que outro usuário/processo sem acesso aos arquivos do usuário obtenha sessão;
2. preservar o fluxo da Central, dos `.cmd`, do updater e do modo `file://`;
3. não colocar segredo em URL, log, histórico do navegador ou argumento de linha de comando visível;
4. manter CSRF, Origin e Host como camadas adicionais.

## 2. Situação atual

- `/api/v1/session` entrega o token CSRF a qualquer chamada com `Host` correto.
- O token é usado em `X-Pauta-CSRF` nas rotas de leitura/escrita.
- `updates/updater.py` obtém `/session` e usa o token para `shutdown`.
- A Central inicia o serviço, consulta `/health` e abre a URL; `--status`/`--stop` usam a API local.
- O modo `file://` não usa o serviço nem autenticação HTTP.

## 3. Opções

### Opção A — token de bootstrap de uso único + cookie de sessão

Fluxo proposto:

1. A Central gera um segredo aleatório por execução e o entrega ao serviço por arquivo temporário restrito ou variável de ambiente herdada.
2. A Central abre `http://127.0.0.1:8766/?bootstrap=<token>` (ou faz POST para `/api/v1/bootstrap`).
3. O serviço valida o token, marca-o como usado, define um cookie de sessão `HttpOnly; SameSite=Strict; Path=/` e redireciona para `/`.
4. O cookie identifica a sessão; o CSRF continua em cabeçalho para operações que mudam estado.
5. Token expira em poucos segundos e não é reutilizável.

Vantagens: não exige que o navegador leia arquivo local; protege contra outro usuário que não tenha o token; funciona com a Central.  
Riscos: token na URL pode aparecer em histórico/log do servidor; mitigar com uso único, expiração curta, `Referrer-Policy: no-referrer` e remoção imediata da URL via `history.replaceState`. O serviço não deve registrar a URL.

### Opção B — segredo administrativo em arquivo restrito

Criar um arquivo na pasta de dados (`%LOCALAPPDATA%\PautaJuridico`) com ACL restrita ao usuário, por exemplo `auth-admin.secret`. A Central e o updater leem o arquivo; a API aceita o segredo em cabeçalho para rotas administrativas (`shutdown`, `status` detalhado) e para criar sessões.

Vantagens: simples, funciona para `--status`/`--stop`, updater e Central; não depende de cookie.  
Riscos: qualquer processo do mesmo usuário pode ler o arquivo; não protege contra malware local. Deve ser combinado com a Opção A para o navegador.

### Opção C — IPC local (named pipe) para comandos administrativos

A Central e o updater usam um named pipe do Windows com ACL do usuário para `status`, `shutdown` e renovação de sessão. A API HTTP não expõe `shutdown`.

Vantagens: não trafega segredo por HTTP; separa plano administrativo do plano do navegador.  
Riscos: mais código específico de Windows; não resolve sozinho a sessão do navegador.

### Opção D — validação do SID/usuário do processo

Verificar o proprietário do processo chamador no Windows. Complexo, frágil e não cobre navegador no mesmo usuário. Não recomendada como única camada.

## 4. Recomendação

Adotar **A + B** em fases:

- **A** para a sessão do navegador: token de bootstrap de uso único, curto, trocado por cookie `HttpOnly`, `SameSite=Strict`, `Secure` quando aplicável (em HTTP loopback, `Secure` não é viável; manter `HttpOnly`/`SameSite` e CSRF).
- **B** para administração: segredo em arquivo com ACL restrita para `shutdown` e `status` administrativo, usado pela Central/updater.
- Manter `/health` aberto (sem dados sensíveis), mas remover o token CSRF de `/session` sem autenticação. `/session` passa a exigir bootstrap/cookie.
- CSRF continua obrigatório em POST e nas leituras locais; `secrets.compare_digest` permanece.
- `shutdown` deixa de aceitar apenas CSRF de `/session`; exige segredo administrativo ou cookie de sessão autenticado.
- Rotacionar segredos a cada início do serviço e invalidar tokens após uso.

## 5. Impacto por componente

### `updates/updater.py`

- `LocalService.request('session')` deixa de ser suficiente para obter o token.
- `LocalService.stop()` deve ler o segredo administrativo do arquivo restrito ou receber o token do processo que iniciou o serviço.
- `request('shutdown')` deve enviar o segredo administrativo (e não apenas o CSRF de sessão).
- `health()` continua aberto para identificar a instalação; `locate_data()` pode continuar usando `status` se ele não expuser dados sensíveis.
- Testes de updater precisam simular o arquivo/segredo e a rotação.

### Central (`central-painel-hb.ps1`)

- Gera o token de bootstrap e inicia o serviço com o segredo administrativo.
- Abre a URL com o token de bootstrap, sem gravar o token em log ou arquivo persistente.
- `status`/`stop` usam o segredo administrativo.
- Deve limpar o token temporário após a troca e tratar serviço já em execução.

### `.cmd` (`ABRIR-PAINEL-INTEGRADO.cmd`, `PREPARAR-SERVICO.cmd`, `STATUS-SERVICO.cmd`, `PARAR-SERVICO.cmd`, `ATUALIZAR-LOCAL.cmd`)

- Repassam o segredo administrativo/token sem imprimir em tela.
- `PARAR-SERVICO.cmd` e `STATUS-SERVICO.cmd` precisam do segredo; se ausente, orientar a abrir a Central.
- `ABRIR-PAINEL-INTEGRADO.cmd` deve abrir a URL de bootstrap, não a URL nua.

### `--status` / `--stop`

- `--status` pode continuar consultando `/health`; se precisar de detalhes, usa o segredo administrativo.
- `--stop` exige segredo administrativo; sem ele, não deve encerrar o serviço.
- `request_status()` em `service/main.py` precisa acompanhar o novo contrato.

### Abrir a URL manualmente

- Sem token/cookie, a página deve mostrar instrução para abrir pela Central, ou uma tela de bootstrap que peça o token.
- O modo `file://` continua sem autenticação HTTP e sem serviço; não deve ser quebrado.
- Links diretos para `http://127.0.0.1:8766/` podem ser aceitos apenas se houver cookie de sessão válido.

### Modo `file://`

- Não usa `/session`, CSRF HTTP nem cookie.
- O backup local e o IndexedDB continuam independentes.
- A documentação deve deixar claro que `file://` não é autenticado e não executa consultas.

## 6. Migração

1. Introduzir o novo contrato atrás de uma variável (`PAUTA_AUTH=1`) e manter o comportamento antigo apenas durante a transição.
2. Atualizar Central, `.cmd`, updater e testes juntos; a checagem de versão já exige HTML/serviço compatíveis.
3. Na primeira execução autenticada, criar o segredo administrativo com ACL restrita; nunca sobrescrever um segredo existente sem confirmação.
4. Invalidar sessões antigas ao reiniciar o serviço; não persistir token de bootstrap.
5. Remover o caminho legado após uma versão de transição, com aviso no changelog.

## 7. Plano de testes

- token de bootstrap: válido uma vez; expirado; reutilizado; token errado; token ausente.
- cookie: `HttpOnly`, `SameSite=Strict`, expiração, invalidação após reinício.
- CSRF: POST sem token/cookie; leitura protegida sem sessão; Origin/Host inválidos.
- outro usuário/processo: sem arquivo/segredo não obtém sessão; com acesso ao arquivo do mesmo usuário, o modelo assume comprometimento.
- Central: abre, consulta status, para e reinicia; token não aparece em log.
- updater: `shutdown` com segredo; falha segura sem segredo; atualização com validação.
- `--status`/`--stop` e `.cmd` com e sem segredo.
- URL manual e `file://` sem regressão.
- concorrência: duas abas, duas instâncias, serviço reiniciado.
- testes negativos: token em URL não fica no histórico/log; `Referrer-Policy`; CORS.
