# Painel H.B — Painel Jurídico Local 0.6.8

**Planilha do escritório com Tribunal, Processo, Autor, Réu, Ação, Audiência e Hora:**
o importador reconhece essas sete colunas automaticamente, preserva as partes
em campos próprios e inclui na Agenda apenas audiências com data/hora válidas.

Aplicativo HTML local para organizar processos, clientes, tarefas, compromissos,
honorários, recebimentos/estornos, publicações e anexos. **Não é extensão de
navegador nem serviço hospedado.** As consultas judiciais usam um serviço Python
local em loopback; no modo integrado, o serviço também guarda cadastros e anexos. O modo arquivo mantém uma carteira independente no navegador.

## Como abrir no Windows

**Agora é possível gerenciar tudo pela central gráfica:** dê dois cliques em
`CENTRAL-PAINEL-HB.cmd`. Nas abas **Início**, **Instalação** e **Manutenção**
estão as opções de abrir o painel, preparar as dependências (inclusive offline),
instalar o e-SAJ, verificar/parar o serviço e controlar a inicialização automática.
O Windows PowerShell 5.1 já vem com o Windows 10/11; a central não exige Node.js.
Os antigos CMD continuam funcionando para uso avançado.

1. Para **instalação offline em outro PC**, extraia o ZIP principal e o ZIP
   `Painel-HB-Dependencias-Offline-Win64-Python312.zip` na mesma pasta,
   deixando `dependencias-offline` ao lado de `dashboard.html`. Na central,
   selecione **Instalação → Instalar dependências offline**. Não execute
   `PREPARAR-SERVICO.cmd` neste caso.
2. Como alternativa **online**, selecione **Preparar com internet** (equivale ao
   `PREPARAR-SERVICO.cmd`, usa Python/pip e Git).
3. Selecione **Abrir painel integrado**. O serviço abre a interface em
   `http://127.0.0.1:8766/`. Mantenha a janela do serviço em execução.
4. **Verificar situação** e **Parar serviço** ficam na aba Início.
5. Para abrir só a carteira, sem consultas, use **Abrir painel simples** ou abra
   `dashboard.html` diretamente no Chrome/Edge. **Não executa consultas.**

Não é necessário privilégio de administrador. O primeiro uso em uma origem nova
inicia vazio; não há processos reais pré-carregados.

### Dados antigos de file:// e da extensão

**Importante:** o IndexedDB de `file://` não é o IndexedDB de
`http://127.0.0.1:8766`. Antes de mudar de modo, abra o painel antigo,
**Exportar backup** com senha e guarde o arquivo. Depois abra o painel
integrado, selecione **Restaurar backup**, confirme e confira quantidade de
processos, clientes, tarefas, honorários, anexos e histórico. Replicar a
restauração substitui os registros após confirmação; não faz inserção duplicada.
Não declare migração concluída sem verificar. A migração da antiga extensão
usa o mesmo backup descrito acima.

## Fontes e monitoramento

- **DataJud:** metadados e movimentos públicos por CNJ, com roteamento pelos
  aliases oficiais publicados pelo CNJ: 27 TJs, seis TRFs, 24 TRTs, 27 TREs,
  STJ, TST, TSE, STM e três TJMs estaduais. Chave pública CNJ substituível;
  desativado por padrão. A inclusão do alias **não comprova** o acesso real,
  a completude ou a recência dos dados daquele tribunal.
- **DJEN:** publicações por CNJ ou OAB/UF no intervalo configurado,
  habilitado por padrão.
- **TJSP e-SAJ:** conector opcional `juscraper==0.5.0`, instalações e graus
  separados; ainda não validado em processos reais. Instale apenas se necessário
  executando `INSTALAR-ESAJ-OPCIONAL.cmd`, com verificação de hashes em `requirements-esaj.hashes.lock`.
- **Jus.br/PDPJ:** indisponível nesta versão; nenhum token ou senha solicitado.
- **STF:** mantenha a consulta oficial manual; não existe alias público
  DataJud confirmado para STF nesta integração.

Em **Fontes e ajustes**, selecione as fontes e os horários (até seis, `HH:MM`,
fuso `America/Sao_Paulo`); use **Atualizar** por processo, lote ou
**Consultar agora**. A fila de consultas, suas tentativas e os novos eventos são
persistidos em SQLite. Falha, HTTP 429, bloqueio, resposta parcial e
não localizado são estados distintos; um resultado vazio não apaga histórico.
O botão **Testar conexão real DJEN e DataJud** aciona verificações remotas
sem CNJ/OAB da carteira, somente para distinguir problemas de rede, autenticação
e estrutura da resposta. Isso não equivale a testar um processo real.
Na ficha de tribunais que não estão nas classificações manuais atuais, utilize
**Outro tribunal** e informe o CNJ válido: o conector DataJud escolhe seu
endpoint pelo número CNJ, não pelo campo de classificação manual.
Na primeira consulta cria-se uma referência inicial, evitando apresentar todo
o passado como novidade.

### Preencher dados do processo a partir do CNJ

No modo integrado, os cartões, a lista e a ficha do processo oferecem **Buscar
publicações no DJEN**. No cadastro/edição, o mesmo botão faz uma consulta avulsa
pelo CNJ antes de salvar, com prévia dos últimos 30 dias sem alterar o cadastro.
O DataJud aparece recolhido como consulta complementar de metadados.
Essa ação consulta somente o DJEN pelo CNJ, no período configurado em Fontes e
ajustes. O serviço executa o DJEN em uma fila independente: demora, bloqueio ou
falha do DataJud não impede a chegada das publicações. A ficha aberta acompanha
os resultados automaticamente e informa a situação de cada fonte. As publicações
do DJEN não equivalem ao histórico completo de movimentos ou aos documentos dos
autos; o DataJud continua como fonte complementar de movimentos públicos.

Ao digitar um CNJ válido no cadastro ou na edição, o painel identifica localmente
o segmento, o tribunal, o ano e o código da unidade de origem. Para o TJRJ, também
preenche o nome da unidade usando a [tabela oficial de códigos de serventias](https://portaltj.tjrj.jus.br/consultas/cod_serventias/cons_cod_serventias).
Quando o tribunal está entre as opções cadastradas, o campo Tribunal é sugerido
automaticamente, sem substituir uma escolha já preenchida. Códigos ausentes ou
ambíguos na tabela não recebem um nome presumido. O número CNJ não informa o grau
nem o sistema eletrônico (PJe, eproc ou Projudi); esses campos devem ser
confirmados por outra fonte. O nome da unidade é derivado do CNJ e da cópia local
da tabela TJRJ, não é gravado como um dado independente.

No cadastro ou na edição de um processo, informe um **CNJ válido** e clique
em **Buscar dados no DataJud**. O botão funciona somente em
`http://127.0.0.1:8766/`, com o serviço Python conectado, e usa a chave pública
configurada (ou o padrão público do CNJ). É uma consulta avulsa por clique,
independente de ativar o agendamento do DataJud nas configurações.

A prévia mostra os registros públicos localizados. Se houver mais de uma
tramitação, selecione o registro/grau desejado e clique em
**Aplicar apenas aos campos vazios**. O preenchimento não sobrescreve tribunal,
grau ou sistema já escolhidos. Um tribunal manual divergente exige conferência
e bloqueia o preenchimento de grau/sistema incompatíveis.

Classe, assuntos, órgão julgador, data de ajuizamento e informações de origem
aparecem na área **Dados públicos do processo · DataJud** e, após salvar,
ficam associados ao cadastro no banco local, **separados das observações
pessoais**. Dados não disponíveis aparecem como não informados. Se a fonte
retornar zero registros, o sistema apenas informa o resultado: isso **não
comprova inexistência do processo**. O próprio processo permanece como estava.

**Buscar e aplicar não salvam automaticamente:** confira a prévia, escolha
**Aplicar**, revise os campos e finalize em **Salvar caso**. Cancelar a edição
descarta alterações ainda não salvas. Corrigir um número CNJ remove os metadados
do CNJ antigo; a importação continua exigindo confirmação e validação.

### Entender o Acompanhamento integrado

Na ficha do processo, a seção **Acompanhamento integrado** mostra primeiro
o que aconteceu (data/hora do movimento, fonte, descrição), com a contagem
de movimentos/publicações e o total de itens **por conferir**. Os eventos
identificados após a linha de base ou uma consulta anterior aparecem em
**Novidades por conferir**, separados do **Histórico**. Uma novidade pode ter
data judicial antiga: é recente apenas a identificação pelo Painel H.B.

As tramitações ficam agrupadas por grau (1º, 2º e superiores), identificando
tribunal, sistema e órgão julgador quando a fonte os informa. Eventos com
mesma descrição e data em graus diferentes permanecem **separados**; o painel
pode mostrar um aviso discreto de possível repetição, sem mesclar ou excluir.

Datas/hora com fuso explícito são convertidas para
`America/Sao_Paulo` (horário de Brasília); quando a fonte omite o fuso,
o horário aparece sem conversão, com aviso explicativo. Horários técnicos
de primeira identificação, última consulta e atualização da fonte ficam em
**Informações técnicas das consultas**, recolhidas por padrão. Marcar um item
como conferido continua sendo um controle interno; não altera o movimento
nem implica ciência de intimação.

O serviço, não a aba, executa agendamentos. Aba fechada com serviço ativo:
o acompanhamento pode continuar. Serviço desligado, computador desligado ou
suspenso: **não** há consultas. Após religar, a política evita disparar todas as
janelas perdidas de uma vez. O Painel H.B não faz peticionamento, ciência de
intimações, cálculo de prazo judicial oficial, captura de autos restritos nem
sincronização remota.

### Carteira em lista e ações de processos

**Agendados** agora organiza o acompanhamento manual dos processos em lista:
revisões atrasadas, hoje, próximos sete dias, depois e sem revisão marcada.
Filtre por **Comigo**, **Com o juízo**, **Parte contrária** ou **Com o cliente**,
pesquise cliente/CNJ/providência/pendência e ordene por revisão, cliente ou
situação do passo. A tela mostra até **15 processos por página**, sem quadro.

Clique em **Abrir ficha** para preencher **Próximo passo**, **Situação**
(A fazer, Fazendo, Pronto para protocolar ou Feito), **Com quem está a bola?**
e **Revisar em**. A ficha também permite adicionar, concluir, reabrir e remover
pendências em checklist, além de **Marcar visto hoje**. Os dados ficam no
banco local e entram no backup protegido. Arquivados não aparecem nos
Agendados até serem desarquivados. **Visto é conferência interna**, não ciência
de intimação; revisão é lembrete, não prazo jurídico calculado.

A carteira usa exclusivamente a visualização **Lista**. Em **Processos**,
selecione uma ou mais caixas de marcação para **Arquivar**, **Desarquivar**
(na aba **Arquivados**) ou **Deletar**. A exclusão pede confirmação e remove
o cadastro, mas preserva publicações, consultas, tarefas, compromissos e
honorários já registrados, desvinculando-os da ficha excluída. Uma consulta
pendente relacionada é cancelada. A exclusão é bloqueada quando há anexos,
comparações de cobertura ou conferências manuais na ficha para evitar perda
desse histórico. Para esses casos, prefira arquivar; anexos podem ser removidos
individualmente. **Deletar não é o mesmo que Arquivar e não permite
desarquivamento posterior.** Exporte um backup protegido antes de excluir.

Em **Fontes e ajustes**, o painel **Consultas recentes do serviço** apresenta
seis consultas por página, com busca por CNJ/OAB/fonte/mensagem, filtros de
situacão e detalhes recolhidos. **Atenção** destaca falhas, respostas parciais
e indisponibilidade; **Em andamento**, **Concluídas** e **Canceladas** separam os
demais resultados. O recorte inclui até as 100 últimas consultas fornecidas
pelo serviço; o restante do histórico persiste no SQLite e nos backups.
Publicações vindas do serviço também têm paginação de oito registros e teor
recolhido por padrão. O histórico antigo do navegador mostra seis linhas e
oferece acesso recolhido ao restante. As configurações essenciais aparecem
antes dos relatórios e diagnósticos secundários.

As diretrizes de interface foram aplicadas sem adicionar dependências ao
Painel H.B em execução.

Em **Publicações**, as datas usam `dd/mm/aaaa`. A consulta pública
`GET https://comunicaapi.pje.jus.br/api/v1/comunicacao` fornece o campo `texto`
com o **teor da comunicação publicada**. Clique em **Ler teor completo da
comunicação** para conferi-lo. Quando a mesma resposta informa um `hash`
válido, **Baixar certidão oficial (PDF)** obtém o documento emitido pelo CNJ no
endpoint `GET /api/v1/comunicacao/{hash}/certidao`. O botão **Abrir certidão no
CNJ** abre o documento diretamente na origem oficial.

**Baixar cópia do teor (PDF)** permanece disponível como alternativa local:
gera uma cópia paginada do texto, distinta da certidão oficial. **Abrir
processo na fonte** é exibido somente quando a API informa um link HTTPS.
Publicações antigas sem `hash` devem ser atualizadas pela consulta DJEN antes
de disponibilizar a certidão. No HTML direto, o navegador pode impedir a
leitura do PDF por CORS; use **Abrir certidão no CNJ** nesse caso. O serviço
Python integrado busca e valida o arquivo antes de disponibilizar o download.
Falhas de rede, bloqueios 403/429 ou retorno não-PDF não geram arquivos falsos.

**Limite jurídico:** a certidão comprova a comunicação/publicação e seu teor,
mas não dá acesso automático aos autos completos nem aos anexos da decisão.
O painel não presume prazos nem ciência de intimação. Confira o documento
oficial antes de tomar providências jurídicas.

## Onde ficam os dados

No modo integrado, o **SQLite** em `%LOCALAPPDATA%\PautaJuridico\` guarda
cadastros completos, anexos e monitoramento. A primeira abertura da versão 0.5.0
migra a carteira da origem original do navegador; uma origem vazia não substitui
processos já monitorados. A cópia antiga no IndexedDB permanece preservada,
mas deixa de receber edições no modo integrado. O modo `file://` é independente.

O serviço requer **Node.js 24+** para reutilizar as validações de `core.js`.
Cada gravação exige a revisão atual e cria backup físico local.

No modo integrado, **Exportar backup** reúne a carteira, anexos e monitoramento
em um JSON que pode ser protegido por senha
(AES-256-GCM com PBKDF2-SHA256). Essa proteção se aplica ao arquivo
exportado, não criptografa os bancos em uso. Guarde cópias protegidas fora
do computador. Restaurar cria previamente uma cópia física do banco SQLite
anterior. Backups antigos não incluem histórico do novo serviço.

Anexos manuais seguem os limites originais: PDF, imagens e TXT, até 5 MB
por arquivo e 25 MB total. Documentos judiciais externos não foram
habilitados sem autorização e suporte confirmado.

## Atualização controlada

Exporte backup protegido, pare o serviço, guarde a versão anterior do código
e execute `ATUALIZAR-LOCAL.cmd` após substituir os arquivos por uma versão
revisada. O script executa testes e gera o bundle, **não baixa nem executa
código remoto**, não toca no banco e não instala atualizador remoto.
Recarregue a página após alterar HTML/JS; reinicie o serviço após alterar
Python; migração de schema deve ser feita apenas com backup.
Dependências Node têm versões fixadas em `package-lock.json`.

`INSTALAR-INICIALIZACAO.cmd` é opção explícita para executar o serviço ao
entrar no Windows; **não é instalado automaticamente**. Para desfazer,
`REMOVER-INICIALIZACAO.cmd`. A porta é fixa por padrão; configure
`PAUTA_PORT` explicitamente se houver conflito.

## Testes

A suíte automatizada (Node.js e Python) fica no repositório-fonte completo e
não é incluída neste pacote de distribuição. Para recompilar o bundle, use
`npm run build` com Node.js 24+.

Detalhes de arquitetura, operação e limitações estão neste LEIA-ME e em
`docs/ATUALIZACOES-GITHUB.md`.

Testes com fixtures e navegador local não comprovam cobertura ou
disponibilidade das fontes reais. Nenhum ZIP é gerado automaticamente.

## Execução local

O painel executa exclusivamente neste computador. Abra ABRIR-PAINEL-INTEGRADO.cmd para iniciar o serviço local; o iniciador renova uma instância de versão antiga antes de abrir a interface.
