# Painel H.B 0.4.0 — Serviço local, operação e recuperação

## 1. Arquitetura e origem estável

```text
Chrome/Edge em http://127.0.0.1:8766/
    ├── HTML/CSS/JS — cadastro e anexos no IndexedDB desta origem
    └── /api/v1/ (mesma origem, contrato versão 1)
          └── service.main — Python 3.11+ em loopback
                ├── SQLite (fila, consultas, eventos, tramitações, novidades)
                ├── DataJud público — metadados e movimentos
                ├── DJEN — publicações
                └── juscraper opcional — TJSP/e-SAJ
```

Não existe extensão, `chrome.storage`, serviço em nuvem ou MCP nativo nesta
arquitetura. Uma página HTML sozinha **não executa** código Python. O
servidor atende somente `127.0.0.1` e distribui uma lista fixa de quatro
arquivos estáticos. Não expõe diretórios, documentos arbitrários, comandos,
proxy HTTP, CORS global ou credenciais de usuário.

O `file://` ainda permite usar a carteira e restaurar/exportar backup, mas
sem consultar fontes. A página não é capaz de iniciar o Python sozinha.

**Porta fixa:** 8766. Uma porta ocupada por outro aplicativo impede o
Pauta de iniciar; não se deve encerrar processos alheios. Uma instância
compatível do próprio Painel H.B é reaproveitada sem iniciar processo duplicado.
Para mudar a porta, configure conscientemente a variável de ambiente
`PAUTA_PORT` antes de iniciar e **migre o IndexedDB por backup**, pois
cada porta é origem distinta.

## 2. Arquivos e responsabilidade

| Componente | Responsabilidade | Persistência |
| --- | --- | --- |
| `dashboard.html`, `app.js`, `integrated-ui.js` | Telas existentes, formulários e consulta do serviço | IndexedDB em cada origem |
| `integrated-case-view.js` | Formatação e agrupamento visual das tramitações/eventos, sem escrita ou deduplicação | Nenhuma; somente leitura |
| `integrated.js` | Contrato v1, sessão CSRF, sincronização apenas do índice de processos | Não guarda segredos fixos |
| `service/main.py` | HTTP same-origin, validação de origem/Host, fila em thread | Nenhum estado manual |
| `service/connectors.py` | Um DataJud, DJEN e adaptador e-SAJ opcional | Nenhum |
| `service/store.py` | SQLite, resultados, tramitacões, deduplicação e scheduler | `%LOCALAPPDATA%\PautaJuridico\pauta-monitoramento.sqlite3` |
| `app.bundle.js` | Bundle clássico para browser `file://` | Gerado por esbuild; não edite |
| `tests/test_service.py` | Testes de lógica e API em pasta temporária | Sem alterar dados reais |

O IndexedDB permanece **fonte de verdade dos cadastros manuais**, incluindo
clientes, observações, tarefas, decisões de classificação, valores e anexos.
O servidor mantém um **índice de consulta** (id, CNJ, tribunal/grau/sistema e
ativo/arquivado) enviado pelo navegador, sem transferir campos financeiros
ou nomes de partes. O SQLite é a fonte de verdade dos resultados processuais
do **novo monitoramento**, não uma segunda carteira manual.

Se mudar de perfil, navegador ou origem, a nova origem não recupera o
IndexedDB anterior sem backup. Com a aba fechada, o serviço consulta os
processos do último índice sincronizado. Mudanças locais ainda não
sincronizadas com a API só aparecem após reconectar o painel.

## 3. Preparar e abrir no Windows

1. `PREPARAR-SERVICO.cmd`: cria `.venv` local. Python 3.11+ com módulo
   `venv` é necessário. Não modifica Python global.
2. `ABRIR-PAINEL-INTEGRADO.cmd`: inicia Python e abre
   `http://127.0.0.1:8766/`.
3. `STATUS-SERVICO.cmd` ou no terminal
   `.venv\Scripts\python.exe -m service.main --status`: lê o estado.
4. `PARAR-SERVICO.cmd`: para o serviço que responde como Painel H.B na porta
   configurada. Não encerra programa diferente.
5. Para iniciar em login do Windows **apenas se solicitado**:
   `INSTALAR-INICIALIZACAO.cmd`; para cancelar,
   `REMOVER-INICIALIZACAO.cmd`.

O modo normal de DataJud/DJEN usa a biblioteca padrão do Python
3.11+, com `tzdata==2026.6` adicional no Windows para o fuso de Brasília.
O instalador fixa e verifica essa dependência. Sem Python, abra
`dashboard.html` para gestão manual. Para compilar
alterações feitas nos módulos do painel, execute `npm ci` (apenas no
desenvolvimento, respeitando `package-lock.json`) e `npm run build`.
O arquivo `app.bundle.js` gerado já faz parte do projeto em execução.

Para TJSP/e-SAJ, se necessário, execute
`INSTALAR-ESAJ-OPCIONAL.cmd`. O instalador fixa
`juscraper==0.5.0` e salva `requirements-esaj.lock` com versões
resolvidas; **verifique e aprove as dependências transitivas antes de usar em
produção**. Reinicie o serviço depois. O código de terceiros não é copiado
para os módulos próprios. Nenhuma senha ou sessão Jus.br é capturada.

## 4. Limites das fontes (por sistema e grau)

| Fonte | Abrangência pretendida | Conteúdo normalizado | Situação verificada |
| --- | --- | --- | --- |
| DataJud | 91 aliases documentados do CNJ: 27 TJs, 6 TRFs, 24 TRTs, 27 TREs, 4 superiores e 3 TJMs; exclui STF | Tramitações por ID e grau, classe, assunto, órgão e movimentos disponíveis | Roteamento e fixtures verificados; cada tribunal ainda requer conferência com processos reais |
| DJEN/Comunica | Publicações por CNJ ou OAB/UF, somente período solicitado | ID, data, conteúdo textual, CNJ e link se fornecido | Adaptador e fixtures verificados; não equivale a acompanhamento integral |
| TJSP/e-SAJ primeiro grau | Consulta pública via juscraper `cpopg` | Tabelas brutas com proveniência, resultado parcial | Dependência opcional; sem validação de campos em consulta real |
| TJSP/e-SAJ segundo grau | Consulta pública via `cposg` | Tabelas brutas com proveniência, resultado parcial | Dependência opcional; sem validação de campos em consulta real |
| TJRJ/PJe/eproc/Projudi específicos | Não incluídos | Nenhum | Não suportado |
| TRF2/eproc/PJe específicos | Não incluídos | Nenhum | Não suportado |
| TJSP/eproc | Não incluído | Nenhum | Não suportado |
| STF | Portais oficiais manuais | Nenhum conector automático | Não há alias STF na API pública DataJud verificado |
| Jus.br/PDPJ autenticado | Acesso depende de login e autorização | Nenhum | Não implementado; não reutilizar tokens entre conectores |

O botão de diagnóstico em **Fontes e ajustes** chama `POST /api/v1/diagnostics`
com CSRF e faz duas requisições remotas sem dados da carteira: uma consulta
`match_none` no DataJud/TJRJ e uma consulta mínima por data no DJEN. A aplicação
retém apenas o estado e a mensagem (não salva nem exibe conteúdo recebido).
Isso verifica acesso e formato, não cobertura processual por tribunal, OAB ou CNJ.

### Consulta avulsa de metadados para formulário

`POST /api/v1/datajud/preview` (JSON `{ "cnj": "..." }`) usa a mesma política
de Host, Origin, CSRF, segurança same-origin e o mesmo conector
`consult_datajud` da fila. Recebe apenas número CNJ válido, não ID da carteira.
Lê a chave configurada exclusivamente do SQLite local, ou usa a chave pública
do CNJ, sem serializá-la nas respostas ou logs. A resposta contém a versão do
contrato, CNJ, status (success/not_found/partial), mensagem e até 100 registros
com tribunal, grau, sistema, classe, assuntos, órgão julgador, data de
ajuizamento e data de atualização na fonte. Eventos detalhados, movimentos e
credenciais não são retornados por essa rota.

A chamada não usa a fila e não salva nada no SQLite. No frontend, a seleção
de um registro preenche somente campos sem valor. Classe, assuntos e órgão
julgador são preservados como `datajudDetails` na ficha do processo no
IndexedDB somente quando o usuário clica em **Salvar caso**. O backup inclui
os metadados com validação do CNJ de origem; a troca de CNJ elimina os dados
anteriores. Erros de HTTP/limite, bloqueio e estrutura incompatível não viram
sucesso e não alteram o formulário. O endpoint não calcula prazos processuais.
Para processos de tribunais ainda não apresentados como opção específica no
formulário manual, selecione **Outro tribunal** e informe o CNJ válido; o
roteamento de DataJud utiliza o próprio número CNJ.

DataJud fornece apenas **metadados públicos** e movimentos disponíveis.
Não contém autos completos, nem garante defasagem constante ou atualização
em tempo real. Campo ausente **não** significa ausência comprovada no
processo. Sistemas diferentes e graus diferentes não são achatados em
um único status. Recurso STJ/STF com número próprio deve ter vínculo
manual comprovado; não é relacionado automaticamente por semelhança textual.

O adaptador e-SAJ usa tabelas sem transformar campos desconhecidos em
movimentações ou documentos; será necessário confirmar o retorno com
amostras públicas/autorizadas antes de ampliar a cobertura. CAPTCHA,
restrições de acesso ou autenticação não são contornados.

## 5. Novidades, falhas, agendamento

- A primeira consulta bem-sucedida ou parcial cria referência inicial por
  processo/fonte: eventos existentes não são notificados em massa.
- Nas consultas posteriores, eventos novos recebem horário de
  **primeira identificação**, independente da data original do evento.
- Alterações em um evento já visto registram correção e preservam texto
  anterior em `corrections`. Igualdade de data/descrição não apaga eventos
  com identificadores distintos.
- Ausência temporária, bloqueio e erro não removem movimentos anteriores.
  Uma resposta parcial é registrada como tal.
- Resultados e falhas ficam em `consultations`, distinguindo tentativa,
  sucesso e atualização declarada pela fonte.
- Cada execução usa uma fila SQLite, uma consulta por vez, com pausa mínima
  entre chamadas, espera por rede de 18 segundos, até duas retentativas
  adicionais e espera progressiva; HTTP 429 é respeitado.
- O usuário pode cancelar a fila; respostas que chegam após cancelamento
  não são gravadas como sucesso.
- A rotina periódica do serviço usa o fuso `America/Sao_Paulo` e horários
  configurados. Não dispara indiscriminadamente todas as execuções perdidas.

Consultas não têm prioridade sobre atos processuais: a ferramenta não
realiza ciência de intimação nem considera movimentações como termo inicial
de prazo. A conferência nos portais oficiais continua necessária.

### Interface de acompanhamento no detalhe do processo

`integrated-ui.js` chama `integratedCaseHTML()` de
`integrated-case-view.js` com a resposta **inalterada** de
`GET /api/v1/processes/{caseId}`. Não há endpoint, migração, consulta ou
alteração de deduplicação para a nova apresentação.

- A contagem distingue movimentos, publicações e itens pendentes
  (`is_new=1` e `seen=0`). A lista exibe até 2.000 eventos mais recentes;
  no limite, a interface informa que pode haver registros adicionais.
- `Novidades por conferir` e `Histórico` são grupos visuais; a novidade
  indica **descoberta após a referência inicial** e não a data do ato.
- Data do acontecimento é a principal informação dos cartões; `first_seen`,
  `last_seen`, última tentativa/sucesso e `source_updated_at` aparecem em
  `<details>` técnico, fechado por padrão, com significado dos carimbos.
- Datas ISO com `Z` ou offset são formatadas em `America/Sao_Paulo`;
  datas sem hora mantêm apenas o dia; horas sem offset são mantidas conforme
  informadas (sem inventar timezone). Valores inválidos não são exibidos
  como códigos brutos nem confundidos com horários do painel.
- Tramitações são agrupadas visualmente pelo grau e apresentam apenas
  tribunal, sistema, classe e órgão com nome legível. Campos ausentes e
  dicionários sem nome são ocultos.
- Possível repetição exige **mesma fonte, data e descrição**, em
  tramitações de **graus conhecidos e diferentes**. É só uma etiqueta de
  aviso gerada na UI, sem modificar eventos, IDs, `seen`, `digest`, SQL ou
  histórico. A ação `events/seen` mantém a mesma API de controle interno.

### Carteira em lista, exclusão controlada e PDFs de publicações

- A carteira em `app.js` apresenta apenas a tabela de processos, com ações
  contextuais após selecionar checkboxes: arquivar, desarquivar e deletar.
- A exclusão de cadastro exige confirmação. `caseDeletionImpact()` e
  `deleteCases()` em `core.js` preservam tarefas, compromissos, honorários,
  publicações e consultas, desvinculando os registros do processo excluído;
  filas pendentes vinculadas são canceladas. Cadastros com anexos, conferências
  manuais ou comparações de cobertura não podem ser excluídos por esse fluxo.
- Em `POST /api/v1/cases/sync`, `allowEmpty=true` somente na exclusão
  explícita da última ficha permite desativar o índice SQLite sem descartar
  eventos ou consultas. A proteção anterior contra sincronizar uma origem
  vazia acidentalmente continua sendo o padrão.
- `publication-pdf.js` formata datas de publicações em português, valida URLs
  HTTPS e gera PDF **local não oficial** paginado, pesquisável, contendo o texto
  e dados recebidos. As interfaces diferenciam essa cópia da certidão original.
- O DJEN entrega o inteiro teor em `texto` e um `hash` para a certidão oficial.
  `sources.js` e `service/connectors.py` validam e preservam o identificador.
  No HTML direto, o navegador tenta baixar o PDF via `GET
  https://comunicaapi.pje.jus.br/api/v1/comunicacao/{hash}/certidao` e oferece
  link HTTPS direto quando há CORS. No integrado, o cliente usa
  `GET /api/v1/publications/{id}/certidao`: o serviço verifica se o ID DJEN e
  o hash foram previamente salvos, baixa apenas do host oficial, restringe
  redirecionamentos, tamanho (8 MB) e assinatura binária `%PDF-`, sem guardar
  o arquivo no SQLite. Falhas ou retornos HTML não são tratados como PDF.
- A versão 2 do esquema SQLite adiciona `events.certificate_hash` por migração
  sem perda dos eventos anteriores. Backups do monitoramento versão 1 continuam
  restauráveis, com hash vazio, e a versão 2 preserva o campo nas cópias.
  O identificador é atualizado também quando a API complementa uma publicação
  antiga, sem apagar o status de conferência.

### Auditoria de UI/UX e históricos compactos

- A skill UI/UX Pro Max foi instalada globalmente no padrão Universal
  (`%USERPROFILE%\.agents\skills\ui-ux-pro-max`). Sua orientação foi aplicada
  preservando a identidade visual verde e as dependências locais do Painel H.B.
- `service-job-history.js` é uma projeção somente leitura: o dashboard do
  serviço disponibiliza até 100 consultas recentes e a interface mostra
  **seis por página**. Busca, filtros e navegação operam sobre esse recorte
  sem alterar SQLite, filas nem estado de conferência.
- **Atenção** inclui estados parciais e de falha; **Em andamento**, **Concluídas**
  e **Canceladas** têm contagens e texto explícitos. Mensagens técnicas ficam
  em `<details>`. O polling atualiza regiões independentes e não deve apagar
  o foco do campo de pesquisa nem os checkboxes dos conectores e-SAJ.
- `integrated-ui.js` limita a **oito publicações por página**, com teor
  recolhido por padrão e paginação anterior/próxima. O histórico antigo do
  navegador mostra seis consultas antes do bloco recolhido com rolagem.
- `app.js` corrige a prévia de restauração para aceitar versões 1 **e 2** de
  backup do monitoramento (a aplicação ainda exige confirmação antes de salvar).
- `styles.css` amplia as adaptações de tela estreita, contraste auxiliar,
  estados de foco e preferência por movimento reduzido; `dashboard.html`
  fornece atalho de teclado para o conteúdo principal sem alterar a rota.
  Detalhes e testes: `docs/AUDITORIA-UI-UX-2026-11-05.md`.

## 6. Backup, migração e reversão

### Migrar `file://` para modo integrado

1. No painel **antigo**, exporte o backup protegido com senha e preserve o
   arquivo em local seguro.
2. Abra a URL fixa do modo integrado pela primeira vez: o IndexedDB estará
   vazio, pois a origem é nova. **Não** interprete isso como exclusão do
   banco antigo.
3. Use **Restaurar backup**, forneça a senha, confira a prévia e confirme.
4. Verifique totais de processos, clientes, tarefas, compromissos,
   recebimentos/estornos, documentos e alertas.
5. Em **Fontes e ajustes**, revise as fontes e a frequência. Novas consultas
   só serão iniciadas pelo serviço após as configurações e a fila permitirem.
6. Se os totais divergirem, **não** apague o antigo: volte ao painel antigo,
   faça nova exportação, valide o arquivo e restaure novamente.

A restauração substitui a carteira e não mescla implicitamente registros.
Repetir uma restauração não duplica linhas: ela substitui integralmente
após confirmação. O campo opcional `monitoring` no backup 0.4 contém
SQLite estruturado; backups antigos não incluem essa parte. A restauração
do servidor cria `%LOCALAPPDATA%\PautaJuridico\backups\antes-restauracao-*.sqlite3`.
Evite usar backup sem senha, pois contém dados pessoais e financeiros.

Se recuperar somente os arquivos antigos de código, o SQLite e o IndexedDB
**não** são substituídos automaticamente. Para voltar a versão anterior,
restaure código previamente salvo e só faça restore do banco quando o
schema for compatível. Contrato da API: `/api/v1/session` retorna
`contractVersion=1` e `appVersion`; versões incompatíveis são bloqueadas.

### Atualização controlada

1. Exporte backup protegido integrado e pare o serviço.
2. Guarde uma cópia da pasta de código atual.
3. Substitua somente arquivos de código por uma revisão aprovada.
4. Execute `ATUALIZAR-LOCAL.cmd`, que testa e compila localmente,
   **sem buscar e executar código automaticamente**.
5. Se HTML/JS mudar, recarregue a página. Se Python mudar, reinicie
   o serviço. Se esquema SQLite mudar, use migração explícita após backup.
6. Confirme a compatibilidade da versão e o número de registros.

As pastas de dados e a pasta `.venv` não devem ser substituídas por
atualização de HTML. Se o projeto for versionado no GitHub,
`.github/dependabot.yml` permite criar propostas de atualização semanais,
**sem merge automático**. Nesta pasta local não há repositório Git.

## 7. Segurança e recuperação de falhas

- API e HTML na mesma origem 127.0.0.1. O servidor valida `Host`,
  `Origin`, `Sec-Fetch-Site` e um token CSRF gerado por sessão para POST.
- Não responde CORS permissivo; `Origin: null` não obtém autorização.
- Apenas `dashboard.html`, `app.bundle.js` e `styles.css` são servidos
  como arquivos; rotas não expõem diretórios do computador.
- Não registra resposta completa, tokens, senhas ou conteúdo processual
  nos logs da API. Dados locais ainda exigem proteção do perfil do Windows,
  backups externos e acesso físico confiável ao computador.
- `PAUTA_DATA_DIR` altera a pasta de dados apenas quando definido
  explicitamente; não é necessário para o usuário comum.
- Para diagnosticar: execute `STATUS-SERVICO.cmd`; se estiver desligado,
  abra o iniciador integrado. Se a porta estiver ocupada por outro programa,
  corrija a configuração explicitamente. Não force encerramento de processos.

## 8. Dependências e referências

- DataJud — https://datajud-wiki.cnj.jus.br/api-publica/endpoints/
  e https://datajud-wiki.cnj.jus.br/api-publica/acesso/
- DJEN — https://comunicaapi.pje.jus.br/swagger/index.html
- `mcp-juridico-brasil` — https://github.com/DeHor-Labs/mcp-juridico-brasil
  (referência; nenhum código incorporado)
- `juscraper==0.5.0` — https://github.com/jtrecenti/juscraper
  (dependência opcional, MIT; nenhuma cópia de módulos no projeto)

As versões e as licenças incorporadas constam de
`package-lock.json`, `requirements-esaj.txt` e
`THIRD-PARTY-LICENSES.md`. A integração e-SAJ não deve ser promovida a
cobertura confirmada sem amostras reais e revisão de permissão/sistema/grau.

Os testes de `docs/VALIDACAO-0.4.0.md` usam fixtures. Nenhum processo do
advogado nem senha foi necessário para a implementação.
