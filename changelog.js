// Histórico local de lançamentos. Atualize ao publicar uma nova versão.
// Não acessa rede nem dados dos processos.
export const CHANGELOG = Object.freeze([
 {version:'0.6.5',date:'2026-11-07',title:'Busca rápida do DJEN com período configurado',summary:'A consulta rápida do DJEN passa a usar o período configurado, de 1 a 365 dias, e informa exatamente as datas consultadas.',changes:['Envia o período configurado na busca rápida do DJEN, em vez de fixar 30 dias.','Valida o período entre 1 e 365 dias no serviço e devolve as datas inicial e final.','Mostra na mensagem o intervalo real consultado e mantém a ressalva de que ausência de publicação não prova inexistência do processo.']},
 {version:'0.6.4',date:'2026-11-07',title:'Autenticação local e qualidade operacional',summary:'Adiciona autenticação local com bootstrap de uso único, segredo administrativo, logs estruturados, acessibilidade, carga e auditoria bloqueante.',changes:['Implementa bootstrap de uso único, cookie HttpOnly/SameSite=Strict e segredo administrativo restrito para sessão e shutdown.','Atualiza updater e compatibilidade de parada com a versão anterior sem depender do CSRF de /session.','Exige hashes na instalação opcional do e-SAJ e valida o lock no CI.','Adiciona log estruturado rotativo e diagnóstico operacional sem CNJ, texto ou credenciais.','Adiciona testes axe/WCAG em rotas e formulários e corrige contraste e rótulo acessível.','Adiciona testes de carga para carteira, backup e Store; extrai views da ficha do processo.','Torna npm audit e pip-audit bloqueantes e gera SBOM CycloneDX no CI.']},
 {version:'0.6.3',date:'2026-11-07',title:'Confiabilidade do scan e do pipeline',summary:'Protege o scan de movimentações com golden master, remove estilos inline do CSP e mede cobertura com testes de UI no CI.',changes:['Adiciona harness de regressão do scan com fixtures DataJud/DJEN e comparação exata do golden master.','Cobre parse DataJud, consulta DJEN e deduplicação no Store em testes Python.','Remove os dois últimos estilos inline e passa style-src para self, sem unsafe-inline.','Adiciona test:coverage com limites mínimos e job de UI/integração no CI.']},
 {version:'0.6.2',date:'2026-11-06',title:'Consolidação e qualidade do pacote',summary:'Remove Playwright do lock de release, centraliza a renovação de sessão, modulariza actions/views, divide validateBackup e adiciona lint, snapshots e CI.',changes:['Remove Playwright também do package-lock do release e valida npm ci --dry-run no smoke.','Centraliza a renovação de sessão para GET/HEAD com no máximo uma nova tentativa.','Atualiza licenças dos conectores Python e remove código morto sem alterar o bundle.','Separa handlers de action e views por domínio, com snapshots HTML byte a byte.','Divide validateBackup em validadores com teste diferencial de mais de 500 mutações.','Adiciona eslint/ruff, candidato de lock com hashes e workflow de CI com auditoria não bloqueante.']},
 {version:'0.6.1',date:'2026-11-06',title:'Limpeza e proteção do pacote local',summary:'Consolida helpers, remove código e estilos sem uso e reforça a API local, a CSP e o backup protegido.',changes:['Consolida o escape de HTML e a normalização de texto em módulos compartilhados, sem alterar a saída.','Remove código, imports e estilos sem uso e uniformiza os fins de linha dos scripts Windows.','Mantém o pacote de release sem testes ou Playwright e valida a versão em package.json, core.js, serviço e interface.','Exige sessão local (Origin e CSRF) também nas leituras de painel, backup, publicações, notificações, processos e certidões.','Reescreve a checagem de Origin com tabela-verdade testada e compara o token CSRF com secrets.compare_digest.','Remove o script inline do dashboard, serve boot-check.js próprio e retira unsafe-inline do script-src da CSP.','Eleva o PBKDF2 do backup protegido para 600.000 iterações, mantendo a abertura de backups antigos.']},
 {version:'0.6.0',date:'2026-11-06',title:'Atualizações assinadas pelo GitHub Releases',summary:'Amplia a Central com atualização gráfica, verificação de assinatura, backup e recuperação.',changes:['Consulta versões estáveis no repositório configurado e mostra novidades sem instalar automaticamente.','Verifica assinatura RSA do editor, SHA-256, inventário e caminhos antes de substituir arquivos do programa.','Preserva origem do navegador e dados locais; exige confirmação de backup do IndexedDB e cria backup SQLite consistente.','Prepara dependências alteradas em ambiente separado, registra etapas e permite recuperar o código anterior quando o esquema é compatível.']},
 {version:'0.5.11',date:'2026-11-06',title:'Mais espaço nos processos em atenção',summary:'Melhora a separação dos cards e o acesso à carteira na página inicial.',changes:['Organiza os cards de processos em atenção em uma lista com espaçamento consistente.','Move Ver todos os processos para o cabeçalho como botão secundário com seta e foco de teclado.']},
 {version:'0.5.10',date:'2026-11-06',title:'Publicações unificadas e tarefas por estado',summary:'Conclui a organização com uma lista de publicações e filtros de tarefas.',changes:['Reúne publicações da carteira e do serviço sem duplicar a mesma comunicação, preservando conferência, teor e PDFs.','Mostra tarefas em aberto por padrão e permite consultar concluídas ou todas, com busca e reabertura.']},
 {version:'0.5.9',date:'2026-11-06',title:'Prioridades e organização do escritório',summary:'Prioriza o trabalho diário e separa ajustes de diagnóstico, com backup de recuperação.',changes:['Coloca compromissos do dia, tarefas e revisões antes dos indicadores financeiros no Início.','Agrupa as vistas de Trabalho e organiza Ajustes em Fontes, Automação, Dados e Diagnóstico.','Substitui a carteira repetida por um resumo e concentra novidades na central de Notificações.']},
 {version:'0.5.8',date:'2026-11-06',title:'Agendamento e consultas mais claros',summary:'Reorganiza atualização automática, diferencia status e orienta o acesso oficial ao Jus.br.',changes:[
 'Destaca próxima consulta e conexão, alinha horários e separa a consulta manual das alterações do agendamento.',
 'Diferencia por texto e cor cada status do histórico, inclusive conclusão, não localizado, parcialidade e indisponibilidade.',
 'Interpreta movimentos das tabelas TJSP de primeiro grau e do retorno de segundo grau do juscraper, sem concluir êxito quando o formato é desconhecido ou incompleto.',
 'Inclui instruções e links oficiais do Jus.br, deixando claro que o login do portal não conecta essa fonte automaticamente ao painel.'
 ]},
 {version:'0.5.7',date:'2026-11-06',title:'Proteções de importação e distribuição',summary:'Reforça datas de backups, restauração do monitoramento, redirecionamentos e arquivos distribuídos.',changes:[
 'Valida datas importadas de anexos e períodos de consulta; a apresentação de datas não devolve marcação HTML.',
 'Reaplica regras de configuração e verifica tipos, datas e objetos JSON do monitoramento antes de restaurar ou criar o backup de segurança.',
 'Aplica no serviço a mesma verificação de tipos e assinaturas de anexos usada pelo navegador.',
 'Restringe redirecionamentos JSON do DJEN ao mesmo host HTTPS e troca a seleção por extensões por um inventário explícito de distribuição.'
 ]},
 {version:'0.5.6',date:'2026-11-06',title:'Conclusão da auditoria de formulários',summary:'Protege rascunhos ao sair dos formulários e preserva ajustes ainda não salvos.',changes:[
 'Pede confirmação antes de fechar formulários alterados por Cancelar, X ou Escape, e antes de sair de Ajustes por um link.',
 'Salvar conexões preserva horários em edição e salvar horários preserva conexões em edição, sem perder o outro rascunho.',
 'Rejeita linhas vazias de horários ativos e mantém a orientação de seis horários ao atualizar o estado do serviço.'
 ]},
  {version:'0.5.5',date:'2026-11-06',title:'Prevenção de erros nos ajustes',summary:'Chave protegida contra edição acidental e horários com seletores próprios.',changes:[
    'Mostra apenas o final da chave, com ações explícitas para substituir, cancelar ou preparar remoção ao salvar.',
    'Troca a lista digitada por campos de horário, com inclusão e remoção, deduplicação e limite de seis consultas diárias.',
    'Aceita valores financeiros no formato brasileiro, informa limites de contato e preserva a validação de centavos.',
    'Normaliza espaços na OAB, exige número e UF juntos e direciona o foco às mensagens de erro sem apagar o preenchimento.'
  ]},
  {
    version:'0.5.4', date:'2026-11-06',
    title:'Retorno à execução exclusivamente local',
    summary:'Remove as adaptações de nuvem da v0.5.2 e corrige a reutilização de serviço antigo pelo iniciador integrado.',
    changes:[
      'Retira a entrada de nuvem, autenticação de hospedagem, marcador HTTPS e ferramentas de empacotamento para Botkeep; o servidor escuta somente neste computador.',
      'O iniciador integrado encerra uma instância de versão antiga e inicia a atual; o aviso de incompatibilidade informa as duas versões e a ação necessária.',
      'Preserva cadastros, anexos, monitoramento e a Central de Notificações da v0.5.3, incluindo busca por trechos sem distinguir acentos e maiúsculas.'
    ]
  },
  {
    version:'0.5.3', date:'2026-11-06',
    title:'Central de notificações dos processos',
    summary:'Novo menu reúne movimentações e publicações com filtros, contador e conferência reversível.',
    changes:[
      'Reúne novidades do serviço e do histórico da carteira, sem duplicar a mesma comunicação recebida por CNJ e OAB.',
      'Oferece busca por processo, CNJ ou texto e filtros de estado, tipo, fonte, tribunal, processo e período, com paginação.',
      'Permite abrir o processo, ler o teor completo e marcar ou desmarcar a conferência individual ou das não lidas na página.',
      'Preserva o modo local, o histórico conferido e a referência inicial, com mensagens distintas para carregamento, lista vazia e falha de conexão.'
    ]
  },
  {
    version:'0.5.2', date:'2026-11-06',
    title:'Preparação para hospedagem com modo local preservado',
    summary:'Entrada de nuvem separada com acesso protegido e banco próprio, sem alterar os iniciadores locais.',
    changes:[
      'Adiciona inicialização explícita para HTTPS com autenticação, origem configurada e diretório persistente obrigatório.',
      'Reconhece o modo integrado na nuvem somente no HTML marcado pelo servidor; mantém a execução local e o modo arquivo.',
      'Inclui pacote limpo de implantação e instruções para Botkeep, sem bancos, anexos, credenciais ou sincronização automática.'
    ]
  },
  {
    version:'0.5.1',
    date:'2026-11-06',
    title:'Confirmação ao aplicar dados do DataJud',
    summary:'Aplicação dos dados informa o que foi preenchido e o changelog recupera a acentuação correta.',
    changes:[
      'O botão de aplicação passa a indicar Dados aplicados e exibe uma confirmação ao lado da ação, com campos preenchidos, dados públicos adicionados e aviso de que ainda é necessário salvar a ficha.',
      'Quando não há dados novos para preencher, a interface informa que nenhum campo foi alterado; trocar o registro ou editar tribunal, grau ou sistema libera uma nova aplicação.',
      'Corrige letras acentuadas substituídas por pontos de interrogação na entrada 0.5.0 do changelog e na documentação local.'
    ]
  },
  {
    version:'0.5.0',
    date:'2026-11-06',
    title:'Cadastros locais em segundo plano',
    summary:'Carteira e anexos passam ao serviço local no modo integrado, com API para gerenciamento sem controlar a tela.',
    changes:[
      'Migra cadastros completos e anexos do navegador para SQLite na primeira abertura integrada, preservando a cópia original e criando backup da migração.',
      'Adiciona API local de cadastro, edição, arquivamento e exclusão de processos, com as mesmas validações do painel e backup antes de cada gravação.',
      'Impede sobrescritas por revisões antigas e sincronizações de abas anteriores; formulários abertos detectam alterações feitas em segundo plano.',
      'Mantém o modo arquivo com armazenamento próprio no navegador; o modo integrado usa o banco do serviço e exige Node.js para validar cadastros.'
    ]
  },
  {
    version:'0.4.2',
    date:'2026-11-06',
    title:'Espera maior no DataJud',
    summary:'Consultas lentas do DataJud deixam de ser interrompidas pelo limite de 60 segundos.',
    changes:[
      'Amplia o limite de espera do DataJud de 60 para 120 segundos, tanto na fila de acompanhamento quanto no teste de conexão real, sem mudar endpoints nem chave pública.',
      'Mantém a consulta lenta como indisponível somente quando o DataJud não responde, evitando tratar espera longa como processo não localizado.'
    ]
  },
  {
    version:'0.4.1',
    date:'2026-11-06',
    title:'DataJud mais resistente e fontes separadas',
    summary:'Espera ampliada no DataJud, busca de publicações por nome e seções independentes por fonte.',
    changes:[
      'Integra o cliente DataJud do projeto mcp-juridico-brasil com versão fixada, endpoint /_search exato e bloqueio de consultas simultâneas entre fila, cadastro e diagnóstico.',
      'Amplia o limite de espera do DataJud para 60 segundos, inclusive no teste de conexão real, sem repetição automática em timeout ou HTTP 504.',
      'Respostas incompletas do DataJud deixam de ser tratadas como processo não localizado, e a fila não duplica consultas longas em andamento.',
      'Separa andamentos e metadados do DataJud das publicações do DJEN, cada fonte com botão, resultado e erro próprios na ficha do processo.',
      'Publicações do DJEN passam a guardar e exibir destinatários, advogados e OAB, além de texto, links e certidão disponíveis.',
      'Adiciona busca avulsa de publicações por nome da parte ou do advogado, com período de 7 a 365 dias e resultados paginados, sem cadastrar processos automaticamente.',
      'Inclui indicadores animados de espera nas consultas, no diagnóstico e no carregamento, respeitando a preferência por movimento reduzido.'
    ]
  },
  {
    version:'0.4.0',
    date:'2026-11-05',
    title:'Serviço local de acompanhamento processual',
    summary:'Acompanhamento via serviço Python local e histórico persistente sem manter a aba aberta.',
    changes:[
      'Adiciona API Python same-origin em loopback e armazenamento SQLite separado dos cadastros do IndexedDB.',
      'Consulta DataJud e DJEN com fila persistente, tratamento de falhas, novidades e separação de tramitações, sem prometer cobertura integral.',
      'A carteira utiliza somente a visualização em lista, com ações por seleção para arquivar, desarquivar e excluir com proteção do histórico.',
      'Publicações DJEN incluem o teor da comunicação, download da certidão oficial emitida pelo CNJ quando há hash válido e cópia PDF local alternativa.',
      'Revisa a UI/UX: consultas recentes com seis registros por página, busca e filtros, publicações integradas paginadas, detalhes recolhidos, foco preservado durante atualização e melhorias em telas pequenas.',
      'Agendados: processos em lista com revisão por data, próximo passo, responsável pela ação, situação, último visto, checklist de pendências e paginação de quinze registros.',
      'Inclui adaptador opcional juscraper 0.5.0 para TJSP e-SAJ primeiro e segundo graus; ainda requer validação com casos reais.',
      'Inclui iniciadores Windows, migração via backup protegido entre file:// e localhost e status do serviço.'
    ]
  },
  {
    version:'0.3.0',
    date:'2026-11-05',
    title:'Aplicativo local, sem extensão e sem servidor',
    summary:'O Painel H.B abre direto do dashboard.html, mantém o banco no navegador e ganha atualização automática configurável.',
    changes:[
      'Remove a dependência de extensão, service worker, auxiliar nativo e mensagens do Chrome; a fila e o agendador passam a rodar na própria página.',
      'Consultas usam fetch direto: o DJEN funciona pela API pública e o DataJud pode ser bloqueado por CORS no modo arquivo local, com mensagens claras de limite HTTP 429, bloqueio e tempo esgotado.',
      'Fontes e ajustes ganha horários de atualização automática (padrão 08:00 e 18:00), recuperação da última janela perdida e botão de consulta manual.',
      'Inclui ABRIR-PAINEL.cmd, inicialização opcional com o Windows e documentação de migração do backup da extensão para o aplicativo local.',
      'Mantém IndexedDB, anexos, backup com senha AES-GCM, conferências, cobertura, importação Excel/CSV e as telas existentes.'
    ]
  },
  {
    version:'0.2.16',
    date:'2026-11-05',
    title:'Revisão geral de segurança e importação',
    summary:'Corrige riscos de perda de dados, reforça o acompanhamento e permite conferir toda a importação.',
    changes:[
      'Importa recursos do STJ e STF pelo registro próprio quando não houver CNJ; detecta números superiores repetidos e mantém processos arquivados na ida e volta CSV.',
      'Prévia do Excel/CSV prioriza linhas problemáticas e disponibiliza relatório completo; identifica o número físico da linha e impede importação parcial em caso de falha.',
      'Não apaga campos de configuração em edição durante atualizações do banco; amplia o modo privacidade em detalhes, avisos e formulários.',
      'A retentativa do DJEN conserva o intervalo anterior, e consultas de processos arquivados ou de fontes desativadas são canceladas antes de gravar respostas tardias.',
      'Backup inclui consultas pendentes como interrompidas, valida vínculos de publicação por CNJ, otimiza conferência de saldos e anexos, e preserva compatibilidade criptográfica com contagens PBKDF2 suportadas.'
    ]
  },
  {
    version:'0.2.15',
    date:'2026-11-05',
    title:'Carteira pronta para organização assistida',
    summary:'Filtre processos, baixe modelo de planilha e exporte sua carteira com avisos de segurança.',
    changes:[
      'Filtros combináveis de tribunal, grau e sistema diretamente na carteira; a seleção de processos é limpa quando o filtro muda para evitar atualizar casos ocultos.',
      'Modelo CSV vazio para preencher depois e exportação da carteira (incluindo arquivados) com confirmação de privacidade e proteção contra células que podem executar fórmulas no Excel.',
      'Orientações de primeiro uso em Fontes e ajustes: identificação de cadastros incompletos, backup com senha, diagnóstico de integridade e verificação de acesso às fontes.'
    ]
  },
  {
    version:'0.2.14',
    date:'2026-11-05',
    title:'Mapa de evidências por tribunal e instância',
    summary:'Veja onde existem comparações manuais DJEN/DataJud sem confundir amostras com cobertura comprovada.',
    changes:[
      'Fontes e ajustes mostra uma matriz de amostras por tribunal, grau, sistema e fonte; destaca tribunais sem evidências registradas e não exibe percentuais de cobertura.',
      'Cada processo conta somente uma vez por fonte na matriz, usando sua última comparação, para não inflar a quantidade de processos verificados.',
      'Novas amostras preservam a classificação declarada no momento do registro. Alterações posteriores de CNJ, tribunal, grau ou sistema não reatribuem as comparações antigas; backups anteriores permanecem compatíveis.'
    ]
  },
  {
    version:'0.2.13',
    date:'2026-11-05',
    title:'Portais oficiais e conferências por tribunal',
    summary:'Acesse consultas oficiais de cada tribunal e registre conferências sem misturar os processos.',
    changes:[
      'Fichas com tribunal confirmado exibem portais oficiais para TJRJ, TRF2, TJSP, STJ e STF, com destaque para o sistema informado e sem consultas automáticas.',
      'As conferências manuais aceitam portais disponíveis em cada tribunal e preservam tribunal, CNJ e registro adicional; recursos STJ/STF podem ser conferidos por número próprio.',
      'A compatibilidade com conferências antigas do TJRJ permanece. Alterar referências mantém o histórico anterior no backup, sem tratá-lo como resultado atual.'
    ]
  },
  {
    version:'0.2.12',
    date:'2026-11-05',
    title:'Tribunais, instâncias e recursos vinculados',
    summary:'Identifique processos por tribunal, grau, sistema e vínculo de origem sem misturar históricos.',
    changes:[
      'TJRJ, TRF2, TJSP, STJ e STF com graus estaduais, federais e superiores, e sistemas separados por processo.',
      'Vínculos manuais entre processos com verificação de ciclos e preservação de números, eventos e documentos próprios.',
      'Importação Excel e CSV com mapeamento de tribunal, instância, sistema, registro adicional e referência de origem.'
    ]
  },
  {
    version:'0.2.11',
    date:'2026-11-05',
    title:'Importar carteira Excel e CSV',
    summary:'Leia planilhas locais, confira as colunas e cadastre os processos válidos.',
    changes:[
      'A área de Processos agora importa arquivos XLSX, CSV e TSV locais, com escolha de aba, mapeamento de colunas e prévia dos registros.',
      'CNJs inválidos, duplicados, fórmulas e números do Excel são separados para revisão; clientes com nomes iguais exigem confirmação adicional.',
      'Tribunal, grau e demais colunas ainda sem campo próprio são preservados nas observações. Não são feitas consultas automáticas após a importação.'
    ]
  },
  {
    version:'0.2.10',
    date:'2026-11-05',
    title:'Amostras de cobertura dos portais oficiais',
    summary:'Registre comparações por processo e fonte, sem presumir cobertura.',
    changes:[
      'Fontes e ajustes permite registrar comparações manuais com DJEN ou DataJud, informando processo, data, resultado observado e evidência textual.',
      'Uma comparação positiva ou divergente exige que exista uma consulta local concluída da mesma fonte e CNJ; falhas só podem ser inconclusivas ou indisponíveis.',
      'O histórico fica no backup protegido; um CNJ corrigido preserva os registros antigos, sem atribuí-los ao número novo.'
    ]
  },
  {
    version:'0.2.9',
    date:'2026-11-05',
    title:'Auxiliar e instalação verificados',
    summary:'Instalação revisada, com diagnóstico da pasta e pacote portátil.',
    changes:[
      'A verificação local identifica registros Chrome, Edge ou Chromium que ainda apontam para uma pasta antiga da extensão.',
      'O auxiliar informa a mesma versão do Painel H.B; o botão Verificar auxiliar avisa quando precisa ser atualizado.',
      'O empacotamento agora acompanha a versão atual e exclui caminhos absolutos, registros locais e chaves temporárias.'
    ]
  },
  {
    version:'0.2.8',
    date:'2026-11-05',
    title:'Diagnóstico manual da conexão com fontes',
    summary:'Verifique DJEN e DataJud sem consultar os seus processos.',
    changes:[
      'Fontes e ajustes oferece o botão Verificar conexão DJEN e DataJud, que testa cada API com um CNJ sintético e não modifica o banco.',
      'A resposta separa acesso válido, limites temporários HTTP 429, acesso recusado e falhas, sem tratar uma resposta vazia como prova de cobertura.',
      'O DJEN foi novamente validado em consulta pública real pelo auxiliar local; a cobertura de casos reais requer verificação independente.'
    ]
  },
  {
    version:'0.2.7',
    date:'2026-11-05',
    title:'Diagnóstico de integridade dos dados locais',
    summary:'Confira vínculos, saldos e anexos sem modificar registros.',
    changes:[
      'Fontes e ajustes inclui o botão Verificar dados e anexos, que executa somente verificações locais e não consulta tribunais.',
      'O relatório aponta possíveis inconsistências de CNJ, vínculos e saldos e confere o tamanho e hash dos anexos armazenados.',
      'Os resultados são apresentados em contagens, sem expor dados pessoais no diagnóstico nem corrigir automaticamente os registros.'
    ]
  },
  {
    version:'0.2.6',
    date:'2026-11-05',
    title:'Confirmação antes de corrigir o CNJ',
    summary:'Veja os vínculos antes de alterar o número de um processo.',
    changes:[
      'Ao alterar um CNJ já cadastrado, o Painel H.B mostra quantas tarefas, compromissos, honorários, recebimentos, anexos e conferências estão relacionados à ficha.',
      'A correção exige reconhecimento explícito dos efeitos sobre publicações e consultas antigas; sem confirmação os dados não são modificados.',
      'Dados financeiros, tarefas, agenda e anexos permanecem vinculados à ficha para revisão manual, sem exclusão automática.'
    ]
  },
  {
    version:'0.2.5',
    date:'2026-11-05',
    title:'Vínculos seguros por número CNJ',
    summary:'Publicações antigas acompanham o cadastro correto do processo.',
    changes:[
      'Publicações já encontradas por OAB são vinculadas quando o processo é cadastrado ou importado pelo mesmo número CNJ.',
      'A opção Associar por CNJ reconcilia registros antigos locais, sem nova consulta nem alterar a marcação de conferência.',
      'Corrigir um CNJ separa publicações anteriores, cancela consultas pendentes do número antigo e impede resultados atrasados no processo errado.'
    ]
  },
  {
    version:'0.2.4',
    date:'2026-11-05',
    title:'Triagem e navegação de publicações',
    summary:'Filtre e percorra todas as publicações já encontradas.',
    changes:[
      'A área de Publicações agora filtra por Todas, Novas, Conferidas e Sem processo vinculado, com contadores.',
      'O botão Mostrar mais permite acessar publicações além das primeiras 100 sem nova consulta de rede.',
      'As marcações de conferência continuam individuais e não representam ciência de intimação.'
    ]
  },
  {
    version:'0.2.3',
    date:'2026-11-05',
    title:'Busca por OAB com alerta e retentativa',
    summary:'Falhas nas publicações por OAB agora aparecem na visão geral.',
    changes:[
      'A visão geral sinaliza bloqueios e erros pendentes na busca do DJEN pela OAB e UF configuradas.',
      'O botão Tentar novamente refaz apenas aquela consulta OAB/UF e conserva o período original quando disponível.',
      'O registro histórico das tentativas permanece íntegro; trocar a OAB configurada oculta avisos da inscrição anterior.'
    ]
  },
  {
    version:'0.2.2',
    date:'2026-11-05',
    title:'Falhas de fontes visíveis na visão geral',
    summary:'Identifique falhas de consulta e repita só a fonte necessária.',
    changes:[
      'A visão geral destaca consultas DJEN ou DataJud com erro, bloqueio ou interrupção que ainda não tiveram resultado posterior concluído.',
      'O botão Tentar novamente reinicia apenas a fonte afetada daquele processo, mantendo histórico anterior e dados já encontrados.',
      'Uma consulta concluída posteriormente encerra o aviso daquela fonte; ausência de publicações não é tratada como falha.'
    ]
  },
  {
    version:'0.2.1',
    date:'2026-11-05',
    title:'Novidades dentro do Painel H.B',
    summary:'Um espaço discreto para acompanhar as atualizações.',
    changes:[
      'Cartão de novidades na barra lateral, acessível também em telas pequenas.',
      'Histórico de versões dentro da extensão, sem depender de sites externos.'
    ]
  },
  {
    version:'0.2.0',
    date:'2026-11-05',
    title:'Consultas, organização e acompanhamento',
    summary:'Evolução da gestão local de processos e conferências.',
    changes:[
      'Atualização manual pelo DJEN e DataJud, com histórico, paginação e tratamento de falhas. DataJud permanece opcional.',
      'Atalhos oficiais para conferência dos processos TJRJ e identificação manual de PJe, eproc ou Projudi.',
      'Histórico de conferências manuais e criação de tarefas vinculadas às pendências, sem cálculo de prazos.',
      'Backup protegido por senha, anexos locais, recebimentos e estornos individualizados.'
    ]
  },
  {
    version:'0.1.0',
    date:'',
    title:'Primeira versão do painel',
    summary:'Base local de gestão jurídica.',
    changes:[
      'Cadastros de clientes e processos, quadro de etapas e importação de CNJs.',
      'Tarefas, agenda manual, honorários e configuração inicial de fontes públicas.'
    ]
  }
]);
