import {escapeHTML as esc} from './html-utils.js';
import {createCaseActions} from './action-cases.js';
import {createPublicationActions} from './action-publications.js';
import {createBackupActions} from './action-backup.js';
import {createGeneralActions} from './action-general.js';
import {createBoardViews} from './view-boards.js';
import {createSourceView} from './view-sources.js';
import {createEditorView} from './view-editor.js';
import {createSettingsEvents} from './view-settings-events.js';
import {createCaseDetailView} from './view-case-detail.js';
import {contentHTML} from './view-content.js';
import {organizePanel} from './panel-organization.js';
import {schedulePanel,scheduleRow} from './schedule-panel.js';
import {safeDateLabel} from './safe-dates.js';
import {normalizeMoneyInput} from './form-inputs.js';
import {publicationDetailsHTML} from './publication-details.js';
import {installLoadingIndicators} from './loading-indicator.js';
installLoadingIndicators();
import {readState,initializeWorkspace,mutate,addDocument,readDocument,auditLocalAttachments,removeDocument,exportBundle,decodeBundle,restoreBundle} from './db.js';
import {taskView,STAGES,JUDICIAL_SYSTEMS,COURTS,COURT_LEVELS,PROCESS_SYSTEMS,MANUAL_CHECK_RESULTS,COVERAGE_RESULTS,WORK_OWNERS,WORK_STATUSES,JOB_STATUS_LABELS,VERSION,saveEntity,cnjChangeImpact,auditLocalData,reconcileEventLinks,pendingManualReviews,pendingSourceIssues,pendingOabIssue,latestCoverageJob,registerCoverageSample,coverageSummary,coverageEvidenceMatrix,formatCnj,dateKey,digits,validCnj,money,overview,registerPayment,reversePayment,registerManualCheck,sameManualIdentity,now,caseDeletionImpact,deleteCases,updateCaseWorkflow,markCaseReviewed,addCasePending,toggleCasePending,removeCasePending,setCaseStage,isBaselineEvent} from './core.js';
import {scheduledCases,SCHEDULE_GROUPS,SCHEDULE_SORTS} from './agendados.js';
import {encryptBackup,decryptBackup} from './backup-crypto.js';
import {handle,autoScheduleInfo,parseAutoTimes} from './engine.js';
import {transport} from './transport.js';
import {officialConsultation} from './official-links.js';
import {CHANGELOG} from './changelog.js';
import {unifiedPublications,publicationView,PUBLICATION_FILTERS,PUBLICATION_BATCH_SIZE} from './publications.js';
import {publicationDateBR,downloadPublicationPdf,downloadOfficialCertificate,djenCertificateUrl,safePublicationUrl} from './publication-pdf.js';
import {checkSourceConnectivity} from './source-health.js';
import {readSpreadsheet,suggestMapping,planSpreadsheetImport,commitSpreadsheetImport,IMPORT_FIELDS} from './spreadsheet-import.js';
import {portfolioTemplateCsv,exportPortfolioCsv,exportImportReportCsv} from './portfolio-csv.js';
import {integrated,serviceOnline,connect,syncBrowser,pollService,serverCommand,apiGet,apiPost,apiFetch,exportMonitoring,restoreMonitoring} from './integrated.js';
import {decorateIntegrated,loadIntegratedCase,refreshIntegratedCase,installIntegratedActions} from './integrated-ui.js';
import {initDatajudForm,getDatajudDraft,searchDatajud,chooseDatajudRecord,
  applyDatajudSelection,invalidateDatajudIfCnjChanged} from './datajud-prefill.js';
import {updateCnjInference} from './cnj-inference.js';
import {djenLookupHTML,searchDjen,invalidateDjenLookup} from './djen-lookup.js';
import {NotificationCenter,notificationKey} from './notifications.js';

const $=selector=>document.querySelector(selector);
const paths={home:'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',cases:'M3 7h7l2-3h9v16H3Z',clients:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3a4 4 0 0 1 0 8',tasks:'M9 5h12 M9 12h12 M9 19h12 M3 5l1 1 2-2 M3 12l1 1 2-2 M3 19l1 1 2-2',agenda:'M4 5h16v16H4Z M8 3v4 M16 3v4 M4 10h16 M8 14h3 M14 14h2',agendados:'M4 5h16v16H4Z M8 3v4 M16 3v4 M4 10h16 M8 15l2 2 4-4',finance:'M3 5h18v14H3Z M12 8a3 3 0 1 0 0 8 3 3 0 0 0 0-8 M6 9v6 M18 9v6',publications:'M6 3h9l4 4v14H6Z M14 3v6h5 M9 13h7 M9 17h5',sources:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M3 12h2 M19 12h2 M12 3v2 M12 19v2 M5.6 5.6 7 7 M17 17l1.4 1.4 M5.6 18.4 7 17 M17 7l1.4-1.4',privacy:'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12 M3 3l18 18',backup:'M5 17v4h14v-4 M12 3v12 M7 10l5 5 5-5',refresh:'M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 12-1l2 3 M4 15l2 3a7 7 0 0 0 12-1',plus:'M12 5v14 M5 12h14',arrow:'M5 12h14 M13 6l6 6-6 6',check:'M5 12l4 4L19 6'};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.cases}"/></svg>`;
const routes={home:['Visão geral','Seu escritório em um só lugar'],cases:['Processos','Casos, próximos passos e histórico'],agendados:['Agendados','Próximas providências, responsáveis e revisões'],clients:['Clientes','Contatos e relacionamentos'],tasks:['Tarefas','O trabalho que precisa avançar'],agenda:['Agenda','Compromissos confirmados por você'],finance:['Honorários','Previsão, recebimentos e saldo'],publications:['Publicações','Comunicações disponíveis no DJEN'],sources:['Fontes e ajustes','Transparência em cada consulta']};
// Keep the central close to the overview, before the existing destinations.
const notificationRoutes=Object.entries(routes);Object.keys(routes).forEach(k=>delete routes[k]);
for(const [k,v] of notificationRoutes){routes[k]=v;if(k==='home')routes.notifications=['Notificações','Todas as novidades dos processos, em um só lugar'];}
paths.notifications='M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4';
const statusName=JOB_STATUS_LABELS;
let taskFilter='open',publicationEvents=[],publicationLoading=false,publicationLoaded=false,publicationError='',publicationFetched=0,publicationWriteEpoch=0;
let state,route='home',query='',filter='active',caseCourtFilter='',caseLevelFilter='',caseSystemFilter='',scheduledOwner='all',scheduledSort='priority',scheduledPage=1,publicationFilter='all',publicationLimit=PUBLICATION_BATCH_SIZE,selected=new Set(),toastTimer,pendingImport=null,pendingWorkbook=null,pendingSheetPlan=null,pendingRestore=null,pendingMonitoring=null,pendingEncrypted=null,pendingDeletion=null,settingsDirty=false;
const clientName=id=>state.clients.find(x=>x.id===id)?.name||'Sem cliente vinculado';
const caseName=id=>state.cases.find(x=>x.id===id)?.title||'Sem processo vinculado';
const date=value=>esc(safeDateLabel(value));
const timestamp=value=>value?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(value)):'Ainda não consultado';
const button=(action,label,cls='secondary',id='')=>`<button class="button ${cls}" data-action="${action}"${id?` data-id="${esc(id)}"`:''}>${label}</button>`;
const tag=(label,cls='')=>`<span class="tag ${cls}">${esc(label)}</span>`;
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,6500);}
const notificationCenter=new NotificationCenter({getState:()=>state,isIntegrated:()=>integrated,apiGet,apiPost,toast,
  openCase:id=>fullDetail(id),markLocal:async(keys,seen)=>{await mutate(s=>{for(const e of s.events)if(keys.has(notificationKey(e)))e.seen=seen;});state=await readState();}});
function showChangelog(){
  dialog('Novidades e histórico',`<p class="subheading">Acompanhe as mudanças do Painel H.B. Estas informações são incluídas no aplicativo e podem ser consultadas sem internet.</p><div class="release-history">${CHANGELOG.map((release,index)=>`<details class="release-entry" ${index===0?'open':''}><summary><span class="release-summary-text"><strong>v${esc(release.version)} · ${esc(release.title)}</strong><small>${release.date?date(release.date):'Versão inicial'}</small></span><span class="release-expand">Detalhes</span></summary><p>${esc(release.summary)}</p><ul>${release.changes.map(change=>`<li>${esc(change)}</li>`).join('')}</ul></details>`).join('')}</div><p class="muted compact">Histórico de funcionalidades. Não indica disponibilidade em tempo real dos tribunais nem a instalação de atualizações automáticas.</p>`);
}
function coveragePanel(){
  const summary=coverageSummary(state),recent=[...(state.coverageSamples||[])].reverse().slice(0,8);
  const line=source=>{const row=summary.sources[source];return `<p class="muted compact"><strong>${source==='djen'?'DJEN':'DataJud'}</strong> · ${row.total} comparação(ões) atuais · ${row.match} coincidência(s) relatada(s) · ${row.difference} divergência(s) relatada(s) · ${row.inconclusive+row.unavailable} inconclusiva(s)/indisponível(is)</p>`;};
  return `<section class="panel" aria-label="Amostras de cobertura"><div class="panel-heading"><div><h2>Comparação com portais oficiais</h2><p class="muted compact">Registro manual de amostras. Não equivale a cobertura geral, certificação nem atualização automática de processos.</p></div>${button('coverage-new','Registrar comparação','secondary')}</div>${line('djen')+line('datajud')}<h3>Histórico recente · ${summary.history}</h3>${recent.map(item=>{const c=state.cases.find(c=>c.id===item.caseId);return `<article class="record"><div class="record-head"><strong>${item.source==='djen'?'DJEN':'DataJud'} · ${esc(COVERAGE_RESULTS[item.result]||'Comparação')}</strong><small>${date(item.referenceDate)} · ${timestamp(item.checkedAt)}</small></div><p class="private compact">${esc(c?.title||'Processo não encontrado')} · ${esc(formatCnj(item.cnj))}${c&&c.cnj!==item.cnj?' · CNJ anterior':''}</p><p class="private compact">${esc(item.notes)}</p></article>`}).join('')||'<p class="muted compact">Ainda não há comparações registradas. Comece com um caso público ou autorizado e confira os resultados no portal oficial.</p>'}${summary.history>8?'<p class="muted compact">Exibindo as oito comparações mais recentes. O histórico completo está no backup.</p>':''}</section>`;
}
function coverageEvidencePanel(){
  const report=coverageEvidenceMatrix(state);
  const cells=report.rows.map(item=>'<tr><td>'+esc(COURTS[item.court]||'Não informado na amostra')+'</td><td>'+esc(COURT_LEVELS[item.courtLevel]||'Não informado na amostra')+'</td><td>'+esc(PROCESS_SYSTEMS[item.processSystem]||'Não informado na amostra')+'</td><td>'+(item.source==='djen'?'DJEN':'DataJud')+'</td><td>'+item.cases+'</td><td>'+item.match+'</td><td>'+item.difference+'</td><td>'+item.unavailable+'</td><td>'+item.inconclusive+'</td></tr>').join('');
  const table=report.rows.length?'<div class="table-wrap"><table><thead><tr><th>Tribunal registrado</th><th>Grau registrado</th><th>Sistema registrado</th><th>Fonte</th><th>Processos na amostra</th><th>Coincidente</th><th>Divergência</th><th>Indisponível</th><th>Inconclusivo</th></tr></thead><tbody>'+cells+'</tbody></table></div>':'<p class="muted compact">Nenhuma comparação atual foi registrada. Comece com processos públicos ou autorizados.</p>';
  return '<section class="panel" aria-label="Mapa de evidências por tribunal"><h2>Mapa de evidências por tribunal e instância</h2><p class="muted compact">Somente comparações declaradas manualmente. Cada processo entra uma vez por fonte (sua última comparação); repetições não aumentam a quantidade de processos testados. Classificações são as informadas na data da comparação.</p><p class="compact"><strong>'+report.distinctCases+'</strong> processo(s) distintos · <strong>'+report.latestComparisons+'</strong> última(s) comparação(ões) por processo/fonte · <strong>'+report.historical+'</strong> registro(s) históricos</p>'+table+'<p class="muted compact">Sem amostras atuais atribuídas a: '+esc(report.noSamples.map(c=>COURTS[c]).join(', ')||'nenhum dos cinco tribunais previstos')+'. '+(report.outdated?report.outdated+' última(s) comparação(ões) não correspondem mais à classificação ou CNJ da ficha e foram excluídas do mapa, mas permanecem no histórico.':'')+'</p><p class="warning-note">Essas contagens não medem porcentagem de cobertura, confiabilidade de intimações nem completude de andamentos. Amostras antigas sem classificação registrada aparecem como “Não informado”, sem inferência retroativa.</p></section>';
}
function readinessPanel(){
  const total=state.cases.length,withoutCourt=state.cases.filter(c=>!c.court).length,withoutIdentifier=state.cases.filter(c=>!c.cnj&&!c.docketNumber).length;
  return `<section class="panel" aria-label="Preparação para uso local"><h2>Preparar o uso local</h2><p class="muted compact">O Painel H.B pode ser usado para organização e conferências supervisionadas. Não substitui a consulta oficial dos tribunais nem acompanha automaticamente todos os andamentos.</p><div class="record-list"><article class="record"><strong>1. Conferir a carteira</strong><p class="muted compact">${total} processo(s) cadastrado(s). ${withoutCourt} sem tribunal confirmado; ${withoutIdentifier} sem CNJ ou registro adicional. Cadastros incompletos podem ser organizados, mas não devem ser usados para concluir consultas judiciais.</p><div class="links"><a href="#cases" class="button secondary small">Abrir processos</a></div></article><article class="record"><strong>2. Salvar cópia protegida</strong><p class="muted compact">Não é possível verificar daqui se um backup foi guardado fora do perfil. Exporte com senha e confira o arquivo antes de usar com dados importantes.</p><div class="links">${button('backup-readiness','Exportar backup com senha','secondary small')}${button('audit-readiness','Verificar integridade local','secondary small')}</div></article><article class="record"><strong>3. Confirmar acesso às fontes</strong><p class="muted compact">DJEN: ${state.settings.djen?'habilitado':'desabilitado'}. DataJud: ${state.settings.datajud?'habilitado, sujeito a limites':'desabilitado por padrão'}. Faça consultas de teste apenas em processos públicos ou autorizados. A configuração não comprova cobertura.</p><div class="links">${button('source-readiness','Testar conexão pública','secondary small')}</div></article></div><p class="warning-note">Antes de usar em um perfil definitivo: mantenha a pasta do painel no mesmo caminho, teste exportação/restauração em perfil temporário e mantenha um procedimento independente para acompanhar intimações e prazos.</p></section>`;
}
function simplifySourceLimitations(){
  // Os avisos continuam acessiveis, mas nao ocupam a area principal de configuracao.
  const panel=[...document.querySelectorAll('#content .panel')].find(item=>
    item.querySelector('h2')?.textContent==='Alcance desta versão');
  if(!panel)return;
  panel.id='source-technical-info';
  panel.innerHTML=`<h2>O que cada fonte realmente oferece</h2>
    <p class="muted compact"><strong>DataJud:</strong> metadados e movimentações públicas por número CNJ nos tribunais com endpoint documentado, incluindo TJs, TRFs, TRTs e TREs. A integração não consulta diretamente PJe, eproc ou Projudi.</p>
    <p class="muted compact"><strong>DJEN:</strong> publicações por CNJ ou OAB/UF, somente no intervalo escolhido.</p>
    <details class="technical-disclosure"><summary>Limitações técnicas e como proceder</summary>
      <ul class="source-limits">
        <li><strong>Descobrir processos por CPF/CNPJ:</strong> a API pública usada não oferece pesquisa nacional por documento. Cadastre os números CNJ conhecidos ou importe uma carteira por planilha; consulte os canais oficiais para localizar outros processos.</li>
        <li><strong>PJe, eproc e Projudi:</strong> use o DataJud para metadados públicos por CNJ e os portais oficiais para conferir peças e movimentações ausentes. Integrações diretas dependem de cada tribunal.</li>
        <li><strong>Jus.br/PDPJ e autos restritos:</strong> acesso apenas com credenciais e autorização do titular, pelo portal oficial. O Painel H.B não captura sessões nem contorna autenticação.</li>
        <li><strong>CAPTCHA:</strong> quando exigido pelo tribunal, resolva manualmente no portal. O Painel H.B não o burla.</li>
        <li><strong>Computador desligado:</strong> o serviço Python precisa permanecer em execução em um computador ativo. Para monitorar 24 horas, seria necessária infraestrutura hospedada com segurança própria.</li>
        <li><strong>Resultado concluído:</strong> comprova somente a resposta da fonte e o período consultado, nunca a totalidade dos autos, intimações ou prazos.</li>
      </ul>
      <p class="muted compact"><a href="https://datajud-wiki.cnj.jus.br/api-publica/endpoints/" target="_blank" rel="noopener noreferrer">Tribunais atendidos pelo DataJud (CNJ)</a> · <a href="https://docs.pdpj.jus.br/" target="_blank" rel="noopener noreferrer">Documentação PDPJ-Br</a></p>
      <p class="muted compact">Painel H.B ${VERSION} · dados locais. Testes simulados e testes de conexão real são verificações diferentes.</p>
    </details>`;
}
function coverageJobHint(){
  const form=$('#coverage-form');if(!form)return;
  const job=latestCoverageJob(state,form.elements.caseId.value,form.elements.source.value);
  form.querySelector('#coverage-job-hint').textContent=job?`Última consulta local: ${statusName[job.status]} em ${timestamp(job.updatedAt)}. É um resultado de fonte pública, não uma comparação automática.`:'Nenhuma consulta concluída desta fonte para o CNJ atual. Você pode registrar indisponibilidade ou resultado inconclusivo; para coincidência/divergência, consulte primeiro pelo botão Atualizar.';
}
function coverageDialog(){
  const cases=state.cases.filter(c=>validCnj(c.cnj));
  if(!cases.length)throw Error('Cadastre um processo com CNJ válido antes de registrar uma comparação.');
  dialog('Registrar comparação de cobertura',`<form id="coverage-form"><p class="subheading">Depois de consultar o portal oficial, registre o que foi comparado com DJEN ou DataJud. É uma declaração manual, não uma validação automática de todos os atos.</p><div class="form-grid">${select('Processo com CNJ *','caseId',cases.map(c=>[c.id,`${c.title} · ${formatCnj(c.cnj)}`]))}${select('Fonte local comparada *','source',[['djen','DJEN · publicações'],['datajud','DataJud · metadados/movimentos']])}${select('Resultado observado *','result',Object.entries(COVERAGE_RESULTS),'inconclusive')}${field('Data da consulta ao portal oficial *','referenceDate',dateKey(),'date',false,'required')}<p class="muted compact full" id="coverage-job-hint" role="status"></p><label class="field full">O que foi comparado e onde? *<textarea name="notes" required minlength="12" maxlength="1500" placeholder="Ex.: Conferi a publicação de referência no portal oficial em 05/11/2026. A data e o teor..."></textarea></label></div><p class="form-error" role="alert"></p><div class="form-actions"><button type="button" class="button ghost" data-action="close">Cancelar</button><button type="submit" class="button primary">Registrar comparação manual</button></div></form>`);
  coverageJobHint();
}
async function showLocalAudit(){
  dialog('Diagnóstico de integridade local','<p role="status">Verificando os registros e arquivos locais, sem alterar dados...</p>');
  const data=auditLocalData(await readState());
  const attachments=await auditLocalAttachments();
  const problems=[...data.issues];
  for(const [label,count] of [['Anexos ausentes no armazenamento',attachments.missing],['Anexos com tamanho ou hash divergente',attachments.corrupted],['Arquivos sem registro correspondente',attachments.unreferenced]])if(count)problems.push({label,count});
  const result=problems.length?`<div class="warning-note"><strong>${problems.length} tipo(s) de divergência encontrado(s).</strong><p>Exporte um backup protegido e examine os registros antes de qualquer alteração.</p></div><ul class="source-limits">${problems.map(item=>`<li>${esc(item.label)}: ${item.count}</li>`).join('')}</ul>`:'<p class="notice">Nenhuma divergência detectada nas verificações locais disponíveis.</p>';
  if(!$('#editor').open||$('#dialog-title').textContent!=='Diagnóstico de integridade local')return;
  $('#dialog-body').innerHTML=`<p class="subheading">Verificação somente de leitura. Não modifica cadastros, não inicia consultas judiciais e não envia informações para servidores.</p><p class="muted compact">Verificados: ${data.counts.cases} processos, ${data.counts.clients} clientes, ${data.counts.events} registros de fontes, ${data.counts.fees} honorários e ${data.counts.documents} anexos. ${attachments.checked} anexo(s) com hash confirmado.</p>${result}<p class="muted compact">A verificação identifica algumas inconsistências estruturais e dos arquivos locais. Não valida os atos judiciais, não substitui um backup e não garante ausência de outros problemas.</p><div class="form-actions"><button type="button" class="button ghost" data-action="close">Fechar</button>${button('backup','Exportar backup','primary')}</div>`;
}
async function showSourceDiagnostics(){
  if(integrated){
    dialog('Conexão com as fontes públicas','<p class="subheading" role="status">Consultando as APIs públicas diretamente pelo serviço Python, sem enviar CNJ, OAB ou dados da carteira...</p>');
    try{
      const [status,diagnostics]=await Promise.all([apiGet('status'),apiPost('diagnostics')]);
      const labels={reachable:'Conectividade confirmada',unavailable:'Indisponível',rate_limited:'Limite de consultas (HTTP 429)',auth_required:'Chave inválida ou exigida',access_denied:'Acesso negado',incompatible:'Formato inesperado',unsupported:'Não suportado'};
      if(!$('#editor').open||$('#dialog-title').textContent!=='Conexão com as fontes públicas')return;
      $('#dialog-body').innerHTML='<p class="notice">Serviço Python conectado · contrato v'+esc(status.contractVersion)+'</p>'+
        '<div class="release-history">'+diagnostics.results.map(item=>'<div class="release-entry"><strong>'+
        esc(item.source==='djen'?'DJEN':'DataJud')+' · '+esc(labels[item.status]||item.status)+'</strong><p>'+
        esc(item.message)+'</p></div>').join('')+'</div>'+
        '<p class="muted compact">O teste usa uma consulta vazia ao DataJud e uma consulta mínima ao DJEN, sem dados da carteira; descarta o conteúdo retornado. Resposta válida confirma somente conexão e formato, não cobertura, movimentações ou resultados por processo.</p>';
    }catch(e){$('#dialog-body').textContent='Não foi possível conectar: '+e.message;}
    return;
  }
  dialog('Verificar conectividade das fontes','<p class="subheading" role="status">Consultando DJEN e DataJud com um CNJ sintético, sem usar a carteira ou alterar o banco local. A conexão pode demorar ou falhar.</p><p class="muted compact">O painel roda direto do arquivo local, sem servidor. O DJEN permite acesso direto; o DataJud pode ser bloqueado pelo navegador por CORS.</p>');
  const settings={...state.settings};
  const report=await checkSourceConnectivity(settings,(url,options)=>transport(url,options,settings));
  if(!$('#editor').open||$('#dialog-title').textContent!=='Verificar conectividade das fontes')return;
  const labels={reachable:'Resposta válida',limited:'Limite de acesso',blocked:'Acesso recusado',unavailable:'Não validada',configuration:'Falta configuração'};
  $('#dialog-body').innerHTML=`<p class="subheading">Teste realizado em ${timestamp(report.testedAt)}. Somente CNJ sintético; nenhuma consulta da carteira foi efetuada.</p><div class="release-history">${report.results.map(x=>`<div class="release-entry"><strong>${x.source==='djen'?'DJEN':'DataJud'} · ${labels[x.status]}</strong><p>${esc(x.message)}</p></div>`).join('')}</div><p class="muted compact">Uma resposta válida comprova somente o acesso e o formato deste teste. Não confirma publicações, movimentos, cobertura dos tribunais nem a atualização dos processos cadastrados.</p><p class="warning-note">Sem servidor e sem auxiliar nativo, o DataJud costuma falhar por CORS no modo arquivo local. O DJEN funciona diretamente porque a API pública libera a origem. As falhas aparecem no histórico de consultas e não apagam dados.</p><div class="form-actions"><button type="button" class="button ghost" data-action="close">Fechar</button></div>`;
}
async function send(type,extra={}) {
  if(integrated)return serverCommand(type,extra,state);
  if(type==='resume')return {};
  if(type==='cancel')return handle(type,extra);
  throw Error('Consultas indisponíveis no HTML direto. Abra ABRIR-PAINEL-INTEGRADO.cmd e mantenha o serviço Python ativo.');
}
const formBaselines=new WeakMap();
function formSnapshot(form){return JSON.stringify([...form.querySelectorAll('input[name],select[name],textarea[name]')].map(x=>[x.name,x.type==='checkbox'||x.type==='radio'?x.checked:x.value,x.disabled]));}
function rememberForm(form){if(form)formBaselines.set(form,formSnapshot(form));}
function formChanged(form){return !!form&&formBaselines.has(form)&&formBaselines.get(form)!==formSnapshot(form);}
function updateSettingsDirty(){settingsDirty=['settings-form','auto-form'].some(id=>formChanged(document.getElementById(id)));}
function editorChanged(){return !!document.getElementById('editor')?.open&&[...document.querySelectorAll('#editor form')].some(formChanged);}
async function refresh(force=false) {
  const next=await readState();if(!force&&state?.revision===next.revision)return;
  state=next;
  if(integrated&&serviceOnline)void syncBrowser(state).catch(error=>console.warn('Painel H.B: sincronização do índice de processos não concluída:',error.message));
  // A source job or another tab may change revision while the operator is
  // typing OAB/keys. Never throw away an unsaved configuration form.
  if(route==='sources'&&settingsDirty&&document.querySelector('#settings-form'))return;
  render();
}
async function change(fn,message){await mutate(fn);await refresh(true);if(message)toast(message);}
function empty(title,text,action,label){return `<div class="empty"><span class="empty-symbol">${icon(route)}</span><h2>${esc(title)}</h2><p>${esc(text)}</p>${action?button(action,esc(label),'primary'):''}</div>`;}
function panel(title,body,toolbar=''){return `<section class="panel"><div class="panel-heading"><h2>${title}</h2><div class="toolbar">${toolbar}</div></div>${body}</section>`;}
function metric(title,value,note,featured=false,type='finance') {return `<article class="metric ${featured?'featured':''}"><div class="metric-icon">${icon(type)}</div><p>${esc(title)}</p><strong class="private">${esc(value)}</strong><small>${esc(note)}</small></article>`;}
function metrics(){const o=overview(state);return `<section class="metrics" aria-label="Indicadores">${metric('Honorários previstos',money(o.expected),'Total dos honorários cadastrados',true)}${metric('Já recebido',money(o.received),'Recebimentos informados por você')}${metric('A receber',money(o.balance),'Saldo dos honorários cadastrados')}<a href="#notifications" class="notification-metric-link">${metric('Novidades para conferir',notificationCenter.rows().filter(e=>!e.seen).length,'Abrir central de notificações','', 'notifications').replace('<strong class="private">','<strong class="private" data-notification-metric>')}</a></section>`;}
function toolbar(){return `<input class="search" data-filter="search" aria-label="Buscar registros" placeholder="Buscar por cliente, processo ou assunto…" value="${esc(query)}">`;}
function filteredCases() {return state.cases.filter(c=>(filter==='archived'?c.archived:!c.archived)&&(caseCourtFilter===''||((c.court||'')===(caseCourtFilter==='unknown'?'':caseCourtFilter)))&&(caseLevelFilter===''||((c.courtLevel||'')===(caseLevelFilter==='unknown'?'':caseLevelFilter)))&&(caseSystemFilter===''||((c.processSystem||'')===(caseSystemFilter==='unknown'?'':caseSystemFilter)))&&`${c.title} ${c.cnj} ${formatCnj(c.cnj)} ${clientName(c.clientId)} ${c.area} ${COURTS[c.court||'']} ${COURT_LEVELS[c.courtLevel||'']} ${PROCESS_SYSTEMS[c.processSystem||'']} ${c.docketNumber||''}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));}
function lastResult(c){const jobs=state.jobs.filter(j=>j.caseId===c.id).slice(-2);return jobs.length?jobs.map(j=>`${j.source==='datajud'?'DataJud':'DJEN'}: ${statusName[j.status]}`).join(' · '):'Ainda não consultado';}
const jurisdictionLabel=c=>[COURTS[c.court||''],COURT_LEVELS[c.courtLevel||''],PROCESS_SYSTEMS[c.processSystem||'']].filter(x=>x&&x!=='Não informado').join(' · ');
function casesPanel(){
  const rows=filteredCases();
  const tabs=`<div class="panel-heading"><div class="segments"><button data-action="filter-active" class="${filter==='active'?'active':''}">Ativos</button><button data-action="filter-archived" class="${filter==='archived'?'active':''}">Arquivados</button></div><div class="line-actions">${button('import-spreadsheet','Importar Excel/CSV','secondary small')}${button('import-cnj','Colar CNJs','ghost small')}${button('template-csv','Modelo CSV vazio','ghost small')}${state.cases.length?button('export-portfolio','Exportar carteira CSV','secondary small'):''}${selected.size?`<span class="selection-count" role="status">${selected.size} selecionado(s)</span>${filter==='archived'?button('unarchive-selected','Desarquivar','secondary small'):button('archive-selected','Arquivar','secondary small')}${filter==='active'?button('update-selected','Atualizar selecionados','primary small'):''}${button('delete-selected','Deletar','danger small')}`:''}</div></div>`;
  const options=(items,value)=>items.map(([key,label])=>`<option value="${esc(key)}" ${key===value?'selected':''}>${esc(label)}</option>`).join('');
  const filters=`<div class="case-filters" aria-label="Filtros da carteira"><label>Tribunal<select data-case-filter="court" aria-label="Filtrar tribunal">${options([['','Todos os tribunais'],['unknown','Não informado'],...Object.entries(COURTS).filter(([key])=>key)],caseCourtFilter)}</select></label><label>Grau<select data-case-filter="level" aria-label="Filtrar grau">${options([['','Todos os graus'],['unknown','Não informado'],...Object.entries(COURT_LEVELS).filter(([key])=>key)],caseLevelFilter)}</select></label><label>Sistema<select data-case-filter="system" aria-label="Filtrar sistema">${options([['','Todos os sistemas'],['unknown','Não informado'],...Object.entries(PROCESS_SYSTEMS).filter(([key])=>key)],caseSystemFilter)}</select></label>${caseCourtFilter||caseLevelFilter||caseSystemFilter?button('clear-case-filters','Limpar filtros','ghost small'):''}</div>`;
  let body;
  if(!state.cases.length)body=empty('Seu painel começa aqui','Cadastre um caso ou importe números CNJ. As consultas só começam quando você clicar em atualizar.','new-cases','Cadastrar primeiro caso');
  else if(!rows.length)body=empty('Nenhum caso nesta seleção','Altere a busca ou o filtro para encontrar seus registros.');
  else body=`<div class="table-wrap"><table class="cases-list"><thead><tr><th><span class="sr-only">Selecionar</span></th><th>Processo / cliente</th><th>Etapa</th><th>Revisão</th><th>Últimas consultas</th><th>Ações</th></tr></thead><tbody>${rows.map(c=>`<tr><td><input type="checkbox" aria-label="Selecionar ${esc(c.title)}" data-select="${esc(c.id)}" ${selected.has(c.id)?'checked':''}></td><td><button class="cell-title private" data-action="detail" data-id="${esc(c.id)}">${esc(c.title)}</button><small class="private">${esc(c.cnj?formatCnj(c.cnj):c.docketNumber?'Registro '+c.docketNumber:'Sem CNJ')} · ${esc(clientName(c.clientId))}</small></td><td>${tag(STAGES[c.stage])}</td><td>${date(c.review)}</td><td><small>${esc(lastResult(c))}</small></td><td><div class="line-actions">${c.archived?button('archive','Desarquivar','secondary small',c.id):c.cnj?button('djen-process','Buscar no DJEN','primary small',c.id):''}${button('edit-cases','Editar','ghost small',c.id)}</div></td></tr>`).join('')}</tbody></table></div>`;
  return panel('Sua carteira <span class="pill">'+rows.length+'</span>',tabs+filters+body,toolbar());
}
function clients(){const rows=state.clients.filter(x=>`${x.name} ${x.email} ${x.phone}`.toLowerCase().includes(query.toLowerCase()));return panel('Relacionamentos',rows.length?`<div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Contato</th><th>Casos</th><th></th></tr></thead><tbody>${rows.map(c=>`<tr><td><strong class="private">${esc(c.name)}</strong><small class="private">${esc(c.notes).slice(0,120)}</small></td><td><span class="private">${esc(c.email||'—')}</span><small class="private">${esc(c.phone||'Sem telefone')}</small></td><td>${state.cases.filter(x=>x.clientId===c.id).length}</td><td><div class="line-actions">${button('edit-clients','Editar','ghost small',c.id)}${digits(c.phone).length>=10?`<a class="button secondary small" href="https://wa.me/${digits(c.phone).startsWith('55')?digits(c.phone):'55'+digits(c.phone)}" target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>`:''}</div></td></tr>`).join('')}</tbody></table></div>`:empty('Contatos com contexto','Reúna seus clientes e associe cada um aos casos que acompanha.','new-clients','Cadastrar cliente'),`<input class="search" data-filter="search" aria-label="Buscar registros" placeholder="Buscar cliente…" value="${esc(query)}">`);}
function tasks(){const {counts,rows}=taskView(state.tasks,query,taskFilter);const matched={length:counts.all};const tabs=`<div class="publication-filters" role="group" aria-label="Filtrar tarefas">${Object.entries({open:'Em aberto',done:'Concluídas',all:'Todas'}).map(([key,label])=>`<button type="button" class="publication-filter ${taskFilter===key?'active':''}" data-action="task-filter" data-id="${key}" aria-pressed="${taskFilter===key}">${label} <span>${counts[key]}</span></button>`).join('')}</div>`;return panel('Próximos passos',tabs+(rows.length?`<div class="record-list">${rows.sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')).map(t=>`<article class="record"><div class="record-head"><div><h3 class="private">${esc(t.title)}</h3><small class="private">${esc(caseName(t.caseId))}</small></div><div class="line-actions">${tag(STAGES[t.stage])}${button('complete-task',t.stage==='done'?'Reabrir':'Concluir','secondary small',t.id)}${button('edit-tasks','Editar','ghost small',t.id)}</div></div><div class="meta"><span>${t.due?'Vencimento: '+date(t.due):'Sem vencimento'}</span></div>${t.notes?`<p class="private">${esc(t.notes)}</p>`:''}</article>`).join('')}</div>`:matched.length?'<div class="empty"><h2>Nenhuma tarefa neste filtro</h2><p>Escolha outro estado para ver as demais tarefas.</p></div>':query?'<div class="empty"><h2>Nenhuma tarefa encontrada</h2><p>Altere a busca para ver as tarefas cadastradas.</p></div>':empty('Cada caso, um próximo passo','Cadastre tarefas, defina a etapa e acompanhe o que precisa ser feito.','new-tasks','Criar tarefa')),`<input type="search" class="search" data-filter="search" aria-label="Buscar tarefas" placeholder="Buscar tarefas…" value="${esc(query)}">`);}
function agenda(){const rows=[...state.appointments].sort((a,b)=>a.when.localeCompare(b.when));return '<div class="intro-note">Compromissos informados por você. Esta versão não calcula prazos processuais automaticamente. Horários de Brasília.</div>'+panel('Compromissos',rows.length?`<div class="record-list">${rows.map(a=>`<article class="record calendar-record"><div class="date-block">${date(a.when)}<br><strong>${esc(a.when.slice(11))}</strong></div><div class="record-main"><h3 class="private">${esc(a.title)}</h3><small>${esc(a.kind||'Compromisso')} · <span class="private">${esc(caseName(a.caseId))}</span></small>${a.notes?`<p class="private">${esc(a.notes)}</p>`:''}</div>${button('edit-appointments','Editar','ghost small',a.id)}</article>`).join('')}</div>`:empty('Espaço para o que vem a seguir','Cadastre audiências, reuniões, revisões e prazos que você já confirmou.','new-appointments','Agendar compromisso'));}
function finance(){return metrics()+panel('Honorários cadastrados',state.fees.length?`<div class="table-wrap"><table><thead><tr><th>Honorário / caso</th><th>Vencimento</th><th>Total</th><th>Recebido</th><th>Saldo</th><th></th></tr></thead><tbody>${state.fees.map(f=>`<tr><td><strong class="private">${esc(f.title)}</strong><small class="private">${esc(caseName(f.caseId))}</small></td><td>${date(f.due)}</td><td class="private">${money(f.amount)}</td><td class="private">${money(f.paid)}</td><td class="private">${money(f.amount-f.paid)}</td><td><div class="line-actions">${button('payments','Recebimentos','secondary small',f.id)}${button('edit-fees','Editar','ghost small',f.id)}</div></td></tr>`).join('')}</tbody></table></div>`:empty('Seu financeiro, com clareza','Registre honorários e cada recebimento, preservando o histórico de estornos.','new-fees','Cadastrar honorário'));}
function paymentDialog(id){
  const fee=state.fees.find(f=>f.id===id);if(!fee)return;
  const entries=state.payments.filter(p=>p.feeId===id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  dialog('Recebimentos · '+fee.title,`<p class="subheading private">Total ${money(fee.amount)} · Recebido ${money(fee.paid)} · Saldo ${money(fee.amount-fee.paid)}</p>${fee.paid<fee.amount?`<form id="payment-form" data-id="${esc(id)}"><div class="form-grid">${field('Valor recebido (R$)','amount','','number',false,`required min="0.01" max="${((fee.amount-fee.paid)/100).toFixed(2)}" step="0.01"`)}${field('Data do recebimento','date',dateKey(),'date',false,'required')}${area('Observações','notes')}</div><p class="form-error" role="alert"></p><div class="form-actions"><button class="button primary" type="submit">Registrar recebimento</button></div></form>`:'<div class="intro-note">Honorário integralmente recebido.</div>'}<div class="detail-section"><h3>Histórico de lançamentos</h3>${entries.map(p=>`<article class="record"><div class="record-head"><div><h3>${p.kind==='reversal'?'Estorno':'Recebimento'} · <span class="private">${p.kind==='reversal'?'− ':''}${money(p.amount)}</span></h3><small>${date(p.date)}${p.opening?' · Saldo importado da 0.1':''}</small></div>${p.kind==='receipt'?(state.payments.some(x=>x.reverses===p.id)?tag('Estornado'):button('reverse-payment','Estornar','ghost small',p.id)):tag('Estorno')}</div><p class="private">${esc(p.notes||'Sem observações')}</p></article>`).join('')||'<p class="muted">Nenhum recebimento registrado.</p>'}</div>`,true);
}

function officialSection(c){const info=officialConsultation(c);if(!info)return c.cnj||c.docketNumber?'<div class="detail-section"><h3>Consulta oficial</h3><p class="muted compact">Selecione um tribunal atendido na edição do processo para abrir os portais de consulta manual. Nenhuma consulta será executada automaticamente.</p></div>':'';
  const history=(c.manualChecks||[]).filter(x=>sameManualIdentity(c,x)).slice().reverse();
  return `<div class="detail-section"><h3>Conferência no ${esc(info.courtLabel)}</h3><p class="muted compact">Sistema informado: <strong>${esc((c.processSystem?PROCESS_SYSTEMS[c.processSystem]:JUDICIAL_SYSTEMS[c.judicialSystem||''])||'Não informado')}</strong>. Abra o portal correspondente e pesquise manualmente pelo CNJ, registro próprio ou origem, conforme os campos aceitos. Os links abrem formulários de consulta; não buscam nem importam resultados automaticamente.</p><div class="links">${info.number?button('copy-cnj','Copiar número CNJ','secondary small',c.id):''}${info.docket?button('copy-docket','Copiar registro adicional','secondary small',c.id):''}${info.links.map((link,i)=>`<a class="button ${i===0&&(c.processSystem||c.judicialSystem)?'primary':'secondary'} small" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.label)} ↗</a>`).join('')}</div><p class="muted compact">${info.number?`Número CNJ: <span class="private">${esc(info.number)}</span>.`:''}${info.docket?` Registro adicional: <span class="private">${esc(info.docket)}</span>.`:''} ${c.manualCheckedAt?'Última conferência manual registrada: '+timestamp(c.manualCheckedAt)+'.':'Nenhuma conferência manual registrada.'} O sistema correto precisa ser confirmado no tribunal.</p><div class="links">${button('manual-check','Registrar resultado da conferência','secondary small',c.id)}</div><p class="muted compact">Registros manuais são declarações do usuário; não substituem a fonte oficial, não alteram movimentações importadas nem calculam prazos.</p><h3>Histórico de conferências · ${history.length}</h3>${history.slice(0,10).map(x=>`<article class="record"><div class="record-head"><strong>${esc(MANUAL_CHECK_RESULTS[x.result]||'Conferência')}</strong><small>${timestamp(x.checkedAt)} · ${esc(PROCESS_SYSTEMS[x.source]||JUDICIAL_SYSTEMS[x.source]||x.source)}</small></div>${x.notes?`<p class="private">${esc(x.notes)}</p>`:''}</article>`).join('')||'<p class="muted compact">Nenhuma conferência detalhada registrada.</p>'}${history.length>10?'<p class="muted compact">Exibindo as últimas 10 conferências. O histórico completo permanece no backup.</p>':''}</div>`;
}
function manualCheckDialog(id){const c=state.cases.find(x=>x.id===id);const info=officialConsultation(c);if(!info)throw Error('Informe tribunal atendido e um CNJ ou registro válido antes da conferência.');
  dialog('Registrar conferência · '+c.title,`<form id="manual-check-form" data-id="${esc(id)}"><p class="subheading">Preencha após consultar o portal oficial. O registro corresponde apenas ao que você observou e não atualiza a fonte automaticamente.</p><div class="form-grid">${select('Portal consultado *','source',info.manualSources.map(source=>[source,source==='portal'?'Portal do tribunal':PROCESS_SYSTEMS[source]||JUDICIAL_SYSTEMS[source]||source]),info.manualSources.includes(c.processSystem||c.judicialSystem)?(c.processSystem||c.judicialSystem):'portal')}${select('Resultado observado *','result',Object.entries(MANUAL_CHECK_RESULTS),'no_changes')}${area('Observações (obrigatórias se houver alteração, pendência ou falha)','notes')}</div><p class="form-error" role="alert"></p><div class="form-actions"><button class="button ghost" type="button" data-action="close">Cancelar</button><button class="button primary" type="submit">Salvar conferência</button></div></form>`,true);
}
function workflowSection(c){
  const items=(c.pendingItems||[]).slice().sort((a,b)=>Number(a.done)-Number(b.done)),remaining=items.filter(item=>!item.done).length;
  const reviewed=c.reviewedAt&&dateKey(new Date(c.reviewedAt))===dateKey();
  const readonly=c.archived;
  const list=items.length?`<ul class="case-pending-list">${items.map(item=>`<li class="case-pending-item ${item.done?'is-done':''}"><label><input type="checkbox" data-workflow-pending="${esc(item.id)}" data-case-id="${esc(c.id)}" ${item.done?'checked':''} ${readonly?'disabled':''}><span class="private">${esc(item.title)}</span></label>${!readonly?`<button type="button" class="button ghost small" data-action="workflow-pending-remove" data-id="${esc(item.id)}" data-case-id="${esc(c.id)}" aria-label="Remover pendência: ${esc(item.title)}">Remover</button>`:''}</li>`).join('')}</ul>`:'<p class="muted compact">Nenhuma pendência cadastrada neste processo.</p>';
  return `<section class="detail-section case-workflow" id="case-workflow" aria-label="Próximo passo, responsável e pendências"><div class="case-workflow-heading"><div><h3>Próximo passo e revisão</h3><p class="muted compact">Organização interna. Não representa intimação lida nem prazo processual calculado.</p></div><div class="line-actions">${c.reviewedAt?tag(reviewed?'Visto hoje':'Último visto: '+date(dateKey(new Date(c.reviewedAt))),'success'):tag('Ainda não visto')}${!readonly?button('workflow-viewed','Marcar visto hoje','secondary small',c.id):''}</div></div>${readonly?'<p class="notice">Processo arquivado: desarquive para editar próximos passos e pendências.</p>':''}<form id="workflow-form" data-id="${esc(c.id)}"><div class="form-grid"><label class="field full">Próximo passo<textarea name="nextStep" maxlength="500" rows="2" placeholder="Ex.: Aguardar comprovante das custas" ${readonly?'disabled':''}>${esc(c.nextStep||'')}</textarea></label>${select('Situação do passo','workStatus',Object.entries(WORK_STATUSES),c.workStatus||'todo')}${select('Com quem está a bola?','workOwner',Object.entries(WORK_OWNERS),c.workOwner||'me')}${field('Revisar em','review',c.review,'date')}</div>${!readonly?'<div class="form-actions"><button class="button primary" type="submit">Salvar acompanhamento</button></div>':''}<p class="form-error" role="alert"></p></form><div class="case-pending-heading"><h3>Pendências · ${remaining} aberta(s)</h3><small>${items.length} registrada(s)</small></div>${list}${!readonly?`<form id="workflow-pending-form" data-id="${esc(c.id)}" class="case-pending-add"><label class="field">Nova pendência<input name="title" type="text" required maxlength="240" autocomplete="off" placeholder="Ex.: Pedir comprovante ao cliente"></label><button type="submit" class="button secondary">Adicionar pendência</button><p class="form-error" role="alert"></p></form>`:''}</section>`;
}
function fullDetail(id){detail(id);const c=state.cases.find(c=>c.id===id);if(c){if(c.archived)$('#workflow-form')?.querySelectorAll('input,select,textarea,button').forEach(field=>{field.disabled=true;});$('#dialog-body').insertAdjacentHTML('beforeend',documentsSection(id));void loadIntegratedCase(id);}}

function eventRecord(e){const actionId=e.key,baseline=isBaselineEvent(e);const sourceUrl=safePublicationUrl(e.url),certificateUrl=djenCertificateUrl(e.certificateHash);return `<article class="record" data-publication-key="${esc(e.key)}"><div class="record-head"><div><h3 class="private">${esc(e.cnj?formatCnj(e.cnj):'Referência processual')}</h3><small>${esc(e.tribunal||e.source)} · ${publicationDateBR(e.date)} · ${e.kind==='publication'?'Publicação':'Movimentação'}</small></div><div class="line-actions">${e.publicationStatus==='Cancelada'?tag('Publicação cancelada','action'):''}${baseline?tag('Referência inicial'):!e.seen?tag('Nova'):tag('Conferida')}${baseline?'':button('publication-seen',e.seen?'Desmarcar':'Conferir','ghost small',actionId)}</div></div>${e.source==='djen'?publicationDetailsHTML(e):''}<details><summary>${e.kind==='publication'?'Ler teor completo da comunicação':'Ver conteúdo e origem'}</summary><p class="private">${esc(e.text)}</p><p class="muted compact">Encontrado em ${timestamp(e.discoveredAt)}${e.sourceUpdatedAt?' · Atualização da fonte: '+esc(e.sourceUpdatedAt):''}</p></details>${e.kind==='publication'?`<div class="publication-actions">${certificateUrl?`${button('unified-publication-official-pdf','Baixar certidão oficial (PDF)','primary small',actionId)}<a class="button ghost small" target="_blank" rel="noopener noreferrer" href="${esc(certificateUrl)}">Abrir certidão no CNJ</a>`:'<span class="muted compact">Certidão oficial não identificada; atualize o DJEN</span>'}${button('unified-publication-pdf','Baixar cópia do teor (PDF)','secondary small',actionId)}${sourceUrl?`<a class="button ghost small" target="_blank" rel="noopener noreferrer" href="${esc(sourceUrl)}">Abrir processo na fonte</a>`:''}</div>`:''}<div class="meta"><span class="private">${e.caseId?esc(caseName(e.caseId)):'Ainda não associado a um caso'}</span>${!e.caseId&&validCnj(e.cnj)?button('unified-register-event','Cadastrar caso com este CNJ','ghost small',actionId):''}</div></article>`;}
function publications(){
  const {counts,total,rows,hasMore}=publicationView(unifiedPublications(state,publicationEvents),query,publicationFilter,publicationLimit);
  const tabs=`<div class="publication-filters" role="group" aria-label="Filtrar publicações">${Object.entries(PUBLICATION_FILTERS).map(([key,label])=>`<button type="button" class="publication-filter ${publicationFilter===key?'active':''}" data-action="publication-filter" data-id="${key}" aria-pressed="${publicationFilter===key}">${label} <span>${counts[key]}</span></button>`).join('')}</div>`;
  const listing=!counts.all&&integrated&&!publicationLoaded?'':rows.length?`<div class="record-list">${rows.map(eventRecord).join('')}</div>${total?`<p class="muted compact publication-progress" aria-live="polite">Exibindo ${rows.length} de ${total} publicação(ões) nesta seleção.</p>`:''}${hasMore?`<div class="publication-more">${button('publication-more','Mostrar mais publicações','secondary')}</div>`:''}`:counts.all?'<div class="empty"><h2>Nenhuma publicação neste filtro</h2><p>Escolha outro estado ou altere a busca. Os registros continuam disponíveis.</p></div>':empty('Novidades com a origem à vista','Atualize seus processos ou configure OAB/UF e busque publicações.','oab','Buscar pela OAB');
  const status=publicationError?`<p class="warning-note" role="alert">Não foi possível atualizar as publicações: ${esc(publicationError)}. Os registros já carregados permanecem disponíveis; a lista pode estar incompleta.</p>`:integrated&&!publicationLoaded?'<p role="status">Carregando publicações…</p>':'';
  return `<div class="intro-note">Busca por OAB encontra publicações no período configurado. Os resultados não comprovam a carteira completa do advogado. Marcar como conferida é apenas controle interno, não ciência de intimação.</div>`+'<div id="publication-list">'+panel('Publicações do DJEN',tabs+status+listing+'<p class="muted compact">Lista unificada da carteira e das até 400 publicações recentes disponíveis no serviço. Conferência é controle interno.</p>',`<input class="search" data-filter="search" aria-label="Buscar registros" placeholder="Buscar nas publicações…" value="${esc(query)}">${button('refresh-publications','Atualizar lista','secondary small')}${button('reconcile-events','Associar por CNJ','ghost small')}${button('oab','Buscar OAB','secondary')}`)+'</div>';
}
async function refreshPublications(force=false){
  if(route!=='publications'||!integrated||!serviceOnline||publicationLoading||!force&&Date.now()-publicationFetched<12000)return;
  publicationLoading=true;const epoch=publicationWriteEpoch;
  try{const result=await apiGet('publications');if(epoch===publicationWriteEpoch){publicationEvents=result.events;publicationLoaded=true;publicationError='';publicationFetched=Date.now();}}
  catch(error){publicationError=error.message;publicationFetched=Date.now();}
  finally{publicationLoading=false;if(route==='publications')paintPublications();}
}
function paintPublications(){
  const root=document.getElementById('publication-list');if(!root)return;
  const focus=root.contains(document.activeElement)?document.activeElement:null;
  const active=focus?{action:focus.dataset.action,id:focus.dataset.id,search:focus.dataset.filter,start:focus.selectionStart}:null;
  const opened=new Map([...root.querySelectorAll('[data-publication-key]')].map(r=>[r.dataset.publicationKey,[...r.querySelectorAll('details')].map(d=>d.open)]));
  const template=document.createElement('template');template.innerHTML=publications();
  root.innerHTML=template.content.querySelector('#publication-list').innerHTML;
  root.querySelectorAll('[data-publication-key]').forEach(r=>r.querySelectorAll('details').forEach((d,i)=>{d.open=!!opened.get(r.dataset.publicationKey)?.[i];}));
  if(active){const next=[...root.querySelectorAll('button,input')].find(x=>active.search?x.dataset.filter===active.search:x.dataset.action===active.action&&x.dataset.id===active.id);next?.focus({preventScroll:true});try{next?.setSelectionRange(active.start,active.start);}catch{}}
}

function jobsPanel(){
  const rows=state.jobs.slice(-60).reverse(),title=integrated?'Histórico anterior · navegador':'Histórico de consultas';
  if(!rows.length)return panel(title,empty('Nenhuma consulta executada','As buscas e eventuais falhas serão registradas aqui.'));
  const heads='<thead><tr><th>Processo / referência</th><th>Fonte</th><th>Resultado</th><th>Detalhes</th><th>Verificação</th></tr></thead>';
  const items=list=>list.map(j=>`<tr><td class="private">${esc(j.cnj?formatCnj(j.cnj):`OAB ${j.oab}/${j.ufOab}`)}</td><td>${j.source==='djen'?'DJEN':'DataJud'}</td><td>${tag(statusName[j.status],j.status)}</td><td class="private">${esc(j.message)}${j.periodStart?`<small>${date(j.periodStart)} a ${date(j.periodEnd)}</small>`:''}${j.count>0&&['error','action'].includes(j.status)?'<small class="warning-note">Resultado parcial; há páginas não concluídas.</small>':''}</td><td><small>${timestamp(j.updatedAt)}</small></td></tr>`).join('');
  const compact=`<div class="table-wrap"><table>${heads}<tbody>${items(rows.slice(0,6))}</tbody></table></div>`;
  const remaining=rows.length>6?`<details class="legacy-history"><summary>Ver outras ${rows.length-6} consultas anteriores</summary><div class="table-wrap legacy-history-scroll"><table>${heads}<tbody>${items(rows.slice(6))}</tbody></table></div></details>`:'';
  return panel(title,`<p class="muted compact">Exibindo as consultas mais recentes. O histórico anterior permanece preservado.</p>${compact}${remaining}`);
}
function render(){
  const oldFocus=document.activeElement?.dataset?.filter?{type:document.activeElement.dataset.filter,start:document.activeElement.selectionStart}:null;
  const [title,sub]=routes[route];$('#page-title').textContent=title;$('#eyebrow').textContent=sub;
  $('#navigation').innerHTML=Object.entries(routes).filter(([k])=>k!=='sources').map(([k,[label]])=>`<a class="nav-item ${route===k?'active':''}" href="#${k}" ${route===k?'aria-current="page"':''}>${icon(k)}${label}${k==='cases'?`<span class="nav-count">${state.cases.filter(c=>!c.archived).length}</span>`:k==='notifications'?'<span class="nav-count notification-nav-count" data-notification-count hidden>0</span>':''}</a>`).join('');
  $('#privacy').innerHTML=icon('privacy')+'Modo privacidade';$('#privacy').setAttribute('aria-pressed',String(!!state.settings.privacy));document.body.classList.toggle('privacy',!!state.settings.privacy);
  $('#backup').innerHTML=icon('backup')+'Exportar backup';$('#settings-link').innerHTML=icon('sources')+'Fontes e ajustes';$('#settings-link').classList.toggle('active',route==='sources');
  $('#release-version').textContent='v'+CHANGELOG[0].version;$('#release-title').textContent=CHANGELOG[0].summary;
  $('#today').textContent=new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'numeric',month:'long',timeZone:'America/Sao_Paulo'}).format(new Date());
  $('#update-all').innerHTML=icon('refresh')+'Atualizar tudo';
  const addMap={home:['cases','Novo caso'],agendados:['cases','Novo caso'],cases:['cases','Novo caso'],clients:['clients','Novo cliente'],tasks:['tasks','Nova tarefa'],agenda:['appointments','Agendar'],finance:['fees','Novo honorário'],publications:['cases','Novo caso'],sources:['cases','Novo caso']};
  addMap.notifications=['cases','Novo caso'];
  $('#new-record').dataset.action='new-'+addMap[route][0];$('#new-record').innerHTML=icon('plus')+addMap[route][1];
  const running=state.jobs.filter(j=>['queued','running'].includes(j.status));
  $('#job-progress').innerHTML=running.length?`<div class="job-banner">${icon('refresh')}<p><strong>${running.length} consulta(s) pendente(s)</strong>Você pode continuar usando o painel. Resultados serão salvos por fonte.</p>${button('cancel','Cancelar','ghost small')}${button('resume','Continuar','secondary small')}</div>`:'';
  $('#content').innerHTML=contentHTML(viewApp,route);
  if(route==='sources')for(const id of ['settings-form','auto-form'])rememberForm(document.getElementById(id));
  if(route==='notifications')notificationCenter.mount();
  if(route==='publications')void refreshPublications();
  notificationCenter.badge();
  if(route==='sources'){simplifySourceLimitations();updateTimeControls(document.getElementById('auto-form'));}
  $('#local-version').textContent=VERSION;
  if(route==='sources'&&!integrated)$('#content').insertAdjacentHTML('afterbegin','<div class="notice"><strong>HTML direto, sem serviço Python.</strong> Seus registros permanecem acessíveis no IndexedDB, mas novas consultas judiciais estão indisponíveis. Para integrá-las, faça backup e abra pelo iniciador integrado; os dados de file:// não aparecem automaticamente em localhost.</div>');
  // Configurações e histórico aparecem primeiro; diagnósticos e conteúdo de
  // apoio não devem obrigar o usuário a percorrer várias telas para alcançá-los.
  if(route==='sources')$('#content').insertAdjacentHTML('beforeend',coveragePanel());
  if(route==='sources')$('#content').insertAdjacentHTML('beforeend',coverageEvidencePanel());
  if(route==='sources')$('#content').insertAdjacentHTML('beforeend',`<section class="panel"><div class="panel-heading"><h2>Conectividade das fontes públicas</h2>${button('source-diagnostics','Testar conexão real DJEN e DataJud','secondary')}</div><p class="muted compact">Teste manual das APIs públicas, sem dados da carteira, sem salvar eventos ou confirmar cobertura. Pode levar alguns segundos.</p></section>`);
  if(route==='sources')$('#content').insertAdjacentHTML('beforeend',`<section class="panel"><div class="panel-heading"><h2>Integridade do banco local</h2>${button('audit-local','Verificar dados e anexos','secondary')}</div><p class="muted compact">Confere vínculos entre cadastros, saldos e arquivos armazenados. Não altera registros nem consulta os tribunais. Uma verificação sem erros não substitui backup protegido.</p></section>`);
  if(route==='sources')$('#content').insertAdjacentHTML('beforeend',readinessPanel());
  if(oldFocus){const f=document.querySelector(`[data-filter="${oldFocus.type}"]`);f?.focus();try{f?.setSelectionRange(oldFocus.start,oldFocus.start);}catch{}}
  decorateIntegrated(route,state);
  organizePanel(route);
}
const field=(label,name,value='',type='text',full=false,extra='')=>{
  const cash=['amount','paid'].includes(name)&&type==='number';
  if(cash){type='text';extra=extra.replace(/(?:min|step)="[^"]*"/g,'')+' inputmode="decimal"';}
  const limits={phone:40,email:180,area:120};
  if(limits[name]&&!extra.includes('maxlength'))extra+=' maxlength="'+limits[name]+'"';
  const complete={phone:'tel',email:'email',name:'name'}[name];
  return `<label class="field ${full?'full':''}">${label}<input name="${name}" type="${type}" value="${esc(cash?String(value).replace('.',','):value)}" ${extra} ${complete?'autocomplete="'+complete+'"':''}>${cash?'<small>Ex.: 1.250,00. Até duas casas decimais.</small>':limits[name]?'<small>Até '+limits[name]+' caracteres.</small>':''}</label>`;
};
const area=(label,name,value='')=>`<label class="field full">${label}<textarea name="${name}" maxlength="4000">${esc(value)}</textarea></label>`;
const select=(label,name,options,value='')=>`<label class="field">${label}<select name="${name}">${options.map(([k,v])=>`<option value="${esc(k)}" ${k===value?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`;
function dialog(title,body,sensitiveTitle=false){$('#editor').classList.remove('case-dialog');$('#dialog-title').textContent=title;$('#dialog-title').classList.toggle('private',sensitiveTitle);$('#dialog-body').innerHTML=body;for(const f of $('#dialog-body').querySelectorAll('form'))rememberForm(f);if(!$('#editor').open)$('#editor').showModal();}
function renderCnjChangeWarning(){
  const form=$('#entity-form');if(!form||form.dataset.table!=='cases'||!form.dataset.id)return;
  const old=state.cases.find(c=>c.id===form.dataset.id),notice=form.querySelector('#cnj-change-warning');
  if(!old||!notice)return;
  const proposed=digits(form.querySelector('[name="cnj"]')?.value);
  if(!old.cnj||old.cnj===proposed){notice.hidden=true;notice.innerHTML='';return;}
  const count=cnjChangeImpact(state,old.id);
  const items=[['tarefas',count.tasks],['compromissos',count.appointments],['honorários',count.fees],['recebimentos/estornos',count.payments],['anexos',count.documents],['conferências manuais',count.manualChecks],['publicações/movimentações',count.events],['consultas em andamento',count.jobs]];
  notice.hidden=false;
  notice.innerHTML=`<h3>Confirme a correção do CNJ</h3><p class="compact">De <strong>${esc(formatCnj(old.cnj))}</strong> para <strong>${proposed?(validCnj(proposed)?esc(formatCnj(proposed)):'número ainda inválido'):'sem CNJ'}</strong>.</p><p class="compact">Dados associados atualmente: ${items.map(([label,total])=>`${total} ${label}`).join(' · ')}.</p><p class="compact">Publicações e consultas do número anterior serão separadas; buscas pendentes serão canceladas. Tarefas, compromissos, honorários, recebimentos e anexos permanecerão nesta ficha, por isso precisam de revisão manual. As conferências antigas continuam no histórico exportado, mas não são exibidas como conferência do novo CNJ.</p><label class="check-field"><input type="checkbox" name="confirmCnjChange" value="yes" required> Conferi os números CNJ e reconheço que devo revisar os vínculos preservados.</label>`;
}
function edit(table,id='',preset={}){return viewApp.edit(table,id,preset);}

let activeDetailCaseId='',localHistoryPage=1;

function detail(id){const c=state.cases.find(x=>x.id===id);if(!c)return;
  if(activeDetailCaseId!==id){activeDetailCaseId=id;localHistoryPage=1;}
  const events=state.events.filter(e=>e.caseId===id).sort((a,b)=>b.date.localeCompare(a.date));
  dialog(c.title,`<p class="subheading private">${esc(c.cnj?formatCnj(c.cnj):c.docketNumber?'Registro '+c.docketNumber:'Pré-processual')} · ${esc(clientName(c.clientId))}</p><div class="links">${button('edit-cases','Editar caso','secondary',id)}${c.cnj?button('djen-process','Buscar publicações no DJEN','primary',id)+button('update-one','Atualizar todas as fontes','secondary',id):''}${button('new-task-for','Criar tarefa','ghost',id)}</div>${c.plaintiff||c.defendant?`<div class="detail-section"><h3>Partes do processo</h3>${c.plaintiff?`<p class="private compact"><strong>Autor:</strong> ${esc(c.plaintiff)}</p>`:' '}${c.defendant?`<p class="private compact"><strong>Réu:</strong> ${esc(c.defendant)}</p>`:' '}</div>`:''}${workflowSection(c)}${relatedProceedings(c)}${officialSection(c)}${c.datajudDetails?`<div class="detail-section"><h3>Metadados públicos · DataJud</h3><p class="compact">Classe: ${esc(c.datajudDetails.classe||'Não informada')} · Assuntos: ${esc((c.datajudDetails.assuntos||[]).join('; ')||'Não informados')} · Órgão julgador: ${esc(c.datajudDetails.orgao||'Não informado')}</p><p class="muted compact">Registro ${esc(c.datajudDetails.recordId||'sem ID')} · Fonte ${esc(c.datajudDetails.sourceUpdatedAt||'sem data de atualização')}</p></div>`:''}${c.notes?`<div class="detail-section"><h3>Observações</h3><p class="private">${esc(c.notes)}</p></div>`:''}<div class="detail-section"><h3>Consultas e alcance</h3>${state.jobs.filter(j=>j.caseId===id).slice(-4).reverse().map(j=>`<div class="record"><div class="record-head"><strong>${j.source==='datajud'?'DataJud':'DJEN'}</strong>${tag(statusName[j.status],j.status)}</div><p>${esc(j.message)}</p><small>${timestamp(j.updatedAt)}${j.periodStart?' · Período '+date(j.periodStart)+' a '+date(j.periodEnd):''}</small></div>`).join('')||'<p class="muted">Nenhuma consulta executada.</p>'}</div><div class="detail-section" id="local-case-history"><h3>Histórico · ${events.length} registro(s)</h3>${localHistoryHTML(events)||'<p class="muted">As informações encontradas nas fontes aparecerão aqui.</p>'}</div><div class="detail-section"><h3>Tarefas vinculadas</h3>${state.tasks.filter(t=>t.caseId===id).map(t=>`<p class="private">${esc(t.title)} · ${esc(STAGES[t.stage])}</p>`).join('')||'<p class="muted">Nenhuma tarefa vinculada.</p>'}</div>`,true);
  $('#editor').classList.add('case-dialog');
}
function downloadJSON(payload,name){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function downloadCsv(text,name){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function exportPortfolioDialog(){
  dialog('Exportar carteira CSV',`<p>O arquivo terá <strong>${state.cases.length} processo(s)</strong>, incluindo os arquivados, e poderá conter nomes de clientes, observações e números processuais.</p><p class="warning-note">CSV não tem criptografia e NÃO é backup completo: não inclui anexos, histórico financeiro, tarefas, consultas ou conferências. Guarde-o em local protegido. Para preservar todos os dados, use Exportar backup com senha.</p><div class="form-actions"><button type="button" class="button ghost" data-action="close">Cancelar</button>${button('confirm-export-portfolio','Confirmar download do CSV','primary')}</div>`);
}
function exportBackup(){dialog('Exportar backup',`<p class="subheading">Inclui cadastros, histórico financeiro e anexos. A chave pública DataJud não é exportada.</p><form id="backup-form"><div class="form-grid" id="password-fields">${field('Senha (mínimo 10 caracteres)','password','','password',true,'required minlength="10" maxlength="1024" autocomplete="new-password"')}${field('Confirmar senha','confirmation','','password',true,'required minlength="10" maxlength="1024" autocomplete="new-password"')}</div><label class="check-field"><input type="checkbox" name="plain"> Exportar sem senha; estou ciente de que o arquivo ficará legível.</label><p class="warning-note">Não há recuperação de senha. A proteção se aplica ao arquivo exportado; o banco local do navegador não é criptografado por esta função.</p><p class="form-error" role="alert"></p><div class="form-actions"><button class="button ghost" type="button" data-action="close">Cancelar</button><button class="button primary" type="submit">Gerar backup</button></div></form>`);}
function importDialog(){pendingImport=null;dialog('Importar números CNJ',`<form id="import-form"><p class="subheading">Cole um número por linha. Confira a prévia antes de cadastrar. Nenhuma busca será iniciada automaticamente.</p><label class="field">Números de processo<textarea name="numbers" rows="8" required placeholder="0000000-00.0000.0.00.0000"></textarea></label><p class="form-error" id="import-error" role="alert"></p><div class="form-actions"><button type="button" class="button ghost" data-action="close">Cancelar</button><button class="button primary" type="submit">Conferir números</button></div></form>`);}
function spreadsheetFileDialog(){
  pendingWorkbook=null;pendingSheetPlan=null;
  dialog('Importar carteira do Excel',`<form id="sheet-file-form"><p class="subheading">Selecione um arquivo <strong>.xlsx, .csv ou .tsv</strong> com uma linha de cabeçalho. O arquivo é lido neste navegador, sem envio à internet.</p><label class="field full">Arquivo Excel/CSV<input name="file" type="file" accept=".xlsx,.csv,.tsv" required></label><p class="muted compact">Até 6 MB, 2.000 linhas, 60 colunas por aba. Para preservar o CNJ, a coluna deve estar formatada como <strong>texto</strong> no Excel, não número ou fórmula. Formato .xls antigo não é aceito: salve como .xlsx.</p><p class="warning-note">Exporte um backup protegido antes de importar. A prévia não altera registros. Somente linhas com CNJ válido ou recurso STJ/STF com registro adicional não duplicado poderão ser criadas.</p><p class="form-error" role="alert"></p><div class="form-actions"><button type="button" class="button ghost" data-action="close">Cancelar</button><button type="submit" class="button primary">Ler arquivo local</button></div></form>`);
}
function spreadsheetMappingDialog(index=0){
  if(!pendingWorkbook?.sheets?.[index])throw Error('Aba da planilha não encontrada.');
  pendingSheetPlan=null;
  const sheet=pendingWorkbook.sheets[index],mapping=suggestMapping(sheet.headers);
  const options=(selected,includeUnmapped=true)=>`${includeUnmapped?'<option value="-1">Não mapear</option>':''}${sheet.headers.map((name,i)=>`<option value="${i}" ${selected===i?'selected':''}>${esc(name)} (coluna ${i+1})</option>`).join('')}`;
  const cells=Object.entries(IMPORT_FIELDS).map(([key,label])=>`<label class="field">${label}<select name="map-${key}">${options(mapping[key])}</select></label>`).join('');
  const tabs=pendingWorkbook.sheets.length>1?`<label class="field full">Aba a importar<select name="sheet-index">${pendingWorkbook.sheets.map((tab,i)=>`<option value="${i}" ${i===index?'selected':''}>${esc(tab.name)} · ${tab.rows.length} linhas</option>`).join('')}</select></label>`:'';
  const sample=sheet.rows.slice(0,3).map(x=>`<tr>${sheet.headers.map((_,i)=>`<td>${esc((x.cells[i]?.text||'').slice(0,90))}</td>`).join('')}</tr>`).join('');
  dialog('Relacionar colunas do Excel',`<form id="sheet-mapping-form"><p class="subheading">Aba <strong>${esc(sheet.name)}</strong> · ${sheet.rows.length} linha(s). Escolha qual coluna corresponde a cada campo do Painel H.B. As colunas Tribunal, Processo, Autor, Réu, Ação, Audiência e Hora são reconhecidas automaticamente. Autor e réu são partes, não clientes. Audiência com data e hora válidas cria compromisso vinculado; informação incompleta fica nas observações. Confira todas as colunas antes de continuar. Processo de origem importado fica como referência textual, sem vínculo automático.</p><div class="form-grid">${tabs}${cells}</div><div class="table-wrap sheet-import-table"><table><thead><tr>${sheet.headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${sample||'<tr><td>Sem dados</td></tr>'}</tbody></table></div><p class="muted compact">Importação de clientes: novos nomes serão cadastrados; clientes com nome idêntico serão reutilizados. Não modifica clientes existentes. A etapa do processo é interna. A data de audiência importada não é prazo jurídico e deve ser conferida na fonte oficial.</p><p class="form-error" role="alert"></p><div class="form-actions"><button type="button" class="button ghost" data-action="close">Cancelar</button><button type="submit" class="button primary">Conferir prévia</button></div></form>`);
}
function spreadsheetPreviewDialog(sheet,mapping,plan){
  pendingSheetPlan={sheet,mapping,plan};
  const names=plan.ready.filter(x=>x.record.client).map(x=>x.record.client.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim());
  const repeats=new Set(names.filter((name,index)=>names.indexOf(name)!==index));
  const reusing=plan.ready.filter(row=>row.clientMatches.length||repeats.has(row.record.client.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim())).length;
  const rows=[...plan.invalid,...plan.duplicates,...plan.ready].slice(0,40).map(row=>`<tr><td>${row.line}</td><td class="private">${esc(row.record.cnj?formatCnj(row.record.cnj):row.record.docketNumber?'Registro '+row.record.docketNumber:'Sem CNJ')}</td><td class="private">${esc(row.record.title.slice(0,90))}</td><td>${row.status==='ready'?'Pronto':row.status==='duplicate'?'Duplicado':'Revisar'}</td><td>${esc([row.reason,row.hearingNote].filter(Boolean).join(' · '))}</td></tr>`).join('');
  dialog('Prévia da importação Excel',`<div class="intro-note"><strong>${plan.ready.length} processo(s) novo(s)</strong> · ${plan.duplicates.length} repetido(s) · ${plan.invalid.length} linha(s) para corrigir.</div><p class="muted compact">Somente os registros marcados <strong>Pronto</strong> serão criados. Duplicidades e erros não serão sobrescritos, e a planilha original ficará intacta. Nenhuma consulta aos tribunais será iniciada. <strong>${plan.ready.filter(x=>x.record.hearingWhen).length} audiência(s)</strong> com data e hora completas serão cadastradas na agenda; informações incompletas ficam nas observações.</p><div class="table-wrap sheet-import-table"><table><thead><tr><th>Linha</th><th>CNJ / registro</th><th>Assunto</th><th>Situação</th><th>Motivo</th></tr></thead><tbody>${rows}</tbody></table></div>${plan.total>40?'<p class="muted compact">Exibindo até 40 linhas, priorizando erros e duplicatas. Baixe o relatório CSV para conferir todas.</p>':''}<p class="muted compact">Colunas não mapeadas preservadas em observações quando contêm conteúdo: ${esc(plan.unmapped.join(', ')||'nenhuma')}.</p><div class="links">${button('download-sheet-report','Baixar relatório completo CSV','secondary small')}</div><p class="warning-note">O relatório inclui dados da planilha e não tem senha. Guarde-o em local protegido.</p><form id="sheet-confirm-form"><label class="check-field"><input type="checkbox" name="confirmed" value="yes" required> Revisei a prévia, fiz backup e autorizo cadastrar apenas os processos válidos. Clientes novos serão criados quando informados.</label>${reusing?`<label class="check-field"><input type="checkbox" name="confirmedExisting" value="yes" required> Confirmei os ${reusing} processo(s) que possuem nomes de clientes iguais a outros registros da planilha ou clientes já cadastrados. Esses nomes serão agrupados; revise possíveis homônimos.</label>`:''}<p class="form-error" role="alert"></p><div class="form-actions">${button('sheet-back','Rever colunas','ghost')}<button type="button" class="button ghost" data-action="close">Cancelar</button><button type="submit" class="button primary" ${plan.ready.length?'':'disabled'}>Importar ${plan.ready.length} processo(s)</button></div></form>`);
}
async function acceptBackup(payload){
  pendingRestore=await decodeBundle(payload);
  pendingMonitoring=payload.monitoring||null;
  const candidate=pendingRestore.state,monitor=pendingMonitoring?.tables;
  if(pendingMonitoring&&(pendingMonitoring.format!=='pauta-monitoramento'||![1,2,3].includes(pendingMonitoring.version)||!monitor||!Array.isArray(monitor.events)||!Array.isArray(monitor.jobs)))throw Error('Monitoramento no backup está incompatível.');
  dialog('Conferir restauração',`<p>Este backup contém <strong>${candidate.clients.length} cliente(s), ${candidate.cases.length} caso(s), ${candidate.tasks.length} tarefa(s)</strong>, ${candidate.documents.length} anexo(s), ${candidate.payments.length} lançamento(s) financeiro(s) e ${candidate.events.length} registro(s) do histórico antigo.</p><p class="muted compact">Monitoramento integrado: ${monitor?monitor.events.length+' evento(s) e '+monitor.jobs.length+' consulta(s)':'não incluído neste backup'}. Registros locais atuais: ${state.cases.length} processo(s), ${state.documents.length} anexo(s).</p><div class="notice">A restauração substitui os dados atuais. Exporte uma cópia atual antes de selecionar o backup. Não há mesclagem automática.</div><form id="restore-form"><label class="check-field"><input type="checkbox" name="confirmed" required> Tenho uma cópia dos dados atuais e quero substituí-los.</label><div class="form-actions"><button type="button" data-action="close" class="button ghost">Cancelar</button><button type="submit" class="button danger">Substituir pelo backup</button></div><p class="form-error" id="restore-error" role="alert"></p></form>`);
}
async function chooseBackup(){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.addEventListener('change',async()=>{try{
  const file=input.files?.[0];if(!file)return;if(file.size>64*1024*1024)throw Error('Backup excede o limite de 64 MB desta versão.');
  const payload=JSON.parse(await file.text());if(payload.format==='pauta-encrypted-backup'){pendingEncrypted=payload;dialog('Abrir backup protegido',`<form id="decrypt-form">${field('Senha do backup','password','','password',true,'required maxlength="1024" autocomplete="off"')}<p class="form-error" role="alert"></p><div class="form-actions"><button type="button" data-action="close" class="button ghost">Cancelar</button><button type="submit" class="button primary">Desbloquear e conferir</button></div></form>`);}else await acceptBackup(payload);
}catch(e){pendingRestore=null;toast(e.message);}});input.click();}
async function attachDocument(caseId){const input=document.createElement('input');input.type='file';input.accept='.pdf,.png,.jpg,.jpeg,.webp,.txt';input.addEventListener('change',async()=>{try{const file=input.files?.[0];if(!file)return;await addDocument(caseId,file);await refresh(true);fullDetail(caseId);toast('Anexo salvo no computador e incluído nos próximos backups.');}catch(e){toast(e.message);}});input.click();}
async function update(ids,sources){const r=await send('update',{ids,sources});toast(r.count?`${r.count} consulta(s) adicionada(s). Acompanhe os resultados na ficha do processo.`:'Nenhuma consulta adicionada: confira as fontes habilitadas ou consultas já na fila.');await refresh(true);}
const actionApp = {
  get state(){return state;}, set state(value){state=value;},
  get selected(){return selected;}, set selected(value){selected=value;},
  get filter(){return filter;}, set filter(value){filter=value;},
  get taskFilter(){return taskFilter;}, set taskFilter(value){taskFilter=value;},
  get scheduledOwner(){return scheduledOwner;}, set scheduledOwner(value){scheduledOwner=value;},
  get scheduledPage(){return scheduledPage;}, set scheduledPage(value){scheduledPage=value;},
  get publicationFilter(){return publicationFilter;}, set publicationFilter(value){publicationFilter=value;},
  get publicationLimit(){return publicationLimit;}, set publicationLimit(value){publicationLimit=value;},
  get publicationEvents(){return publicationEvents;}, set publicationEvents(value){publicationEvents=value;},
  get publicationWriteEpoch(){return publicationWriteEpoch;}, set publicationWriteEpoch(value){publicationWriteEpoch=value;},
  get pendingRestore(){return pendingRestore;}, set pendingRestore(value){pendingRestore=value;},
  get pendingEncrypted(){return pendingEncrypted;}, set pendingEncrypted(value){pendingEncrypted=value;},
  get pendingWorkbook(){return pendingWorkbook;}, set pendingWorkbook(value){pendingWorkbook=value;},
  get pendingSheetPlan(){return pendingSheetPlan;}, set pendingSheetPlan(value){pendingSheetPlan=value;},
  get pendingDeletion(){return pendingDeletion;}, set pendingDeletion(value){pendingDeletion=value;},
  get pendingImport(){return pendingImport;}, set pendingImport(value){pendingImport=value;},
  get caseCourtFilter(){return caseCourtFilter;}, set caseCourtFilter(value){caseCourtFilter=value;},
  get caseLevelFilter(){return caseLevelFilter;}, set caseLevelFilter(value){caseLevelFilter=value;},
  get caseSystemFilter(){return caseSystemFilter;}, set caseSystemFilter(value){caseSystemFilter=value;},
  get integrated(){return integrated;}, get serviceOnline(){return serviceOnline;},
  get notificationCenter(){return notificationCenter;},
  $, render, change, toast, update, send, refresh, edit, fullDetail, dialog, field, area,
  money, esc, dateKey, timestamp, button, manualCheckDialog, paymentDialog, attachDocument,
  readDocument, removeDocument, officialConsultation, searchDjen, searchDatajud,
  applyDatajudSelection, showChangelog, chooseBackup, exportBackup, importDialog,
  spreadsheetFileDialog, spreadsheetMappingDialog, downloadCsv, portfolioTemplateCsv,
  exportPortfolioCsv, exportImportReportCsv, exportPortfolioDialog, showLocalAudit,
  showSourceDiagnostics, coverageDialog, reconcileEventLinks, deleteCases,
  caseDeletionImpact, syncBrowser, saveEntity, unifiedPublications, downloadPublicationPdf,
  downloadOfficialCertificate, apiFetch, apiPost, validCnj, formatCnj, notificationKey,
  mutate, sameManualIdentity, markCaseReviewed, removeCasePending, refreshPublications,
  WORK_OWNERS, PROCESS_SYSTEMS, JUDICIAL_SYSTEMS, MANUAL_CHECK_RESULTS,
  PUBLICATION_FILTERS, PUBLICATION_BATCH_SIZE
};
const actionHandlers={
  ...createCaseActions(actionApp),
  ...createPublicationActions(actionApp),
  ...createBackupActions(actionApp),
  ...createGeneralActions(actionApp)
};
const viewApp=Object.create(actionApp);
Object.defineProperties(viewApp,{
  query:{get:()=>query,set:value=>{query=value;}},
  scheduledSort:{get:()=>scheduledSort,set:value=>{scheduledSort=value;}},
  settingsDirty:{get:()=>settingsDirty,set:value=>{settingsDirty=value;}},
  publicationLoading:{get:()=>publicationLoading,set:value=>{publicationLoading=value;}},
  publicationLoaded:{get:()=>publicationLoaded,set:value=>{publicationLoaded=value;}},
  publicationError:{get:()=>publicationError,set:value=>{publicationError=value;}},
  publicationFetched:{get:()=>publicationFetched,set:value=>{publicationFetched=value;}},
  activeDetailCaseId:{get:()=>activeDetailCaseId,set:value=>{activeDetailCaseId=value;}},
  localHistoryPage:{get:()=>localHistoryPage,set:value=>{localHistoryPage=value;}}
});
const boardViews=createBoardViews(viewApp);
const sourceView=createSourceView(viewApp);
const editorView=createEditorView(viewApp);
Object.assign(viewApp,{
  home:boardViews.home,
  agendadosPanel:boardViews.agendadosPanel,
  sourcePage:sourceView.sourcePage,
  edit:editorView.edit,
  casesPanel,clients,tasks,agenda,finance,publications,jobsPanel,empty,panel,metric,metrics,toolbar,
  filteredCases,lastResult,caseName,clientName,date,timestamp,button,tag,icon,esc,dateKey,
  safeDateLabel,statusName,pendingManualReviews,pendingSourceIssues,pendingOabIssue,jurisdictionLabel,
  SCHEDULE_GROUPS,SCHEDULE_SORTS,routes,scheduledCases,scheduleRow,schedulePanel,djenLookupHTML,
  field,area,select,dialog,rememberForm,renderCnjChangeWarning,initDatajudForm,updateCnjInference,
  updateSettingsDirty,VERSION,CHANGELOG,STAGES,WORK_STATUSES,COURTS,COURT_LEVELS,autoScheduleInfo
});
const caseDetailView=createCaseDetailView(viewApp);
Object.assign(viewApp,{
  documentsSection:caseDetailView.documentsSection,
  relatedProceedings:caseDetailView.relatedProceedings,
  localHistoryHTML:caseDetailView.localHistoryHTML,
  refreshLocalHistory:caseDetailView.refreshLocalHistory
});
const documentsSection=id=>caseDetailView.documentsSection(id);
const relatedProceedings=item=>caseDetailView.relatedProceedings(item);
const localHistoryHTML=events=>caseDetailView.localHistoryHTML(events);
const refreshLocalHistory=()=>caseDetailView.refreshLocalHistory();
async function action(name,id,caseId=''){
  const handler=actionHandlers[name];
  if(handler)return handler({name,id,caseId});
  if(name.startsWith('new-')&&['clients','cases','tasks','appointments','fees'].includes(name.slice(4)))return edit(name.slice(4));
  if(name.startsWith('edit-'))return edit(name.slice(5),id);
  if(name.startsWith('unified-'))return actionHandlers['publication-seen']({name,id,caseId});
}
document.addEventListener('click',event=>{const paging=event.target.closest('[data-case-page]');if(paging){event.preventDefault();localHistoryPage=Number(paging.dataset.casePage)||1;refreshLocalHistory();$('#local-case-history [data-case-page]:not([disabled])')?.focus();return;}const target=event.target.closest('[data-action]');if(target){event.preventDefault();action(target.dataset.action,target.dataset.id,target.dataset.caseId).catch(e=>toast(e.message));}});
$('#update-all').addEventListener('click',()=>update(state.cases.filter(c=>!c.archived&&c.cnj).map(c=>c.id)).catch(e=>toast(e.message)));
$('#backup').addEventListener('click',exportBackup);
$('#privacy').addEventListener('click',()=>change(s=>s.settings.privacy=!s.settings.privacy).catch(e=>toast(e.message)));
$('#skip-to-content').addEventListener('click',()=>$('#content').focus());
$('#close-dialog').addEventListener('click',()=>{$('#editor').close();pendingRestore=null;});
$('#editor').addEventListener('cancel',()=>{pendingRestore=null;pendingEncrypted=null;});
document.addEventListener('input',event=>{
  if(event.target.closest('#settings-form,#auto-form'))updateSettingsDirty();
  if(event.target.dataset.filter==='search'){query=event.target.value;if(route==='publications')publicationLimit=PUBLICATION_BATCH_SIZE;else if(route==='cases')selected.clear();else if(route==='agendados')scheduledPage=1;render();}
  if(event.target.name==='cnj'&&event.target.closest('#entity-form')){
    const form=event.target.closest('#entity-form');if(form.dataset.table==='cases'){invalidateDatajudIfCnjChanged(form);invalidateDjenLookup(form);updateCnjInference(form);}
    renderCnjChangeWarning();
  }
});
document.addEventListener('change',event=>{
  if(event.target.dataset.scheduledSort){if(Object.hasOwn(SCHEDULE_SORTS,event.target.value)){scheduledSort=event.target.value;scheduledPage=1;render();}return;}
  if(event.target.dataset.workflowPending){
    const caseId=event.target.dataset.caseId,pendingId=event.target.dataset.workflowPending,scroll=$('#editor').scrollTop;
    change(s=>toggleCasePending(s,caseId,pendingId)).then(()=>{
      if($('#editor').open){fullDetail(caseId);$('#editor').scrollTop=scroll;}
    }).catch(e=>toast(e.message));return;
  }
  if(event.target.closest('#settings-form,#auto-form'))updateSettingsDirty();
  if(event.target.id==='datajud-choice'&&event.target.closest('#entity-form'))chooseDatajudRecord(event.target.closest('#entity-form'));
  if(event.target.dataset.caseFilter){
    const which=event.target.dataset.caseFilter;
    if(which==='court')caseCourtFilter=event.target.value;
    if(which==='level')caseLevelFilter=event.target.value;
    if(which==='system')caseSystemFilter=event.target.value;
    selected.clear();render();return;
  }
  if(event.target.name==='sheet-index'&&event.target.closest('#sheet-mapping-form'))spreadsheetMappingDialog(Number(event.target.value));
  if(event.target.closest('#coverage-form')&&['caseId','source'].includes(event.target.name))coverageJobHint();
  if(event.target.name==='plain'&&event.target.closest('#backup-form')){for(const field of $('#password-fields').querySelectorAll('input')){field.disabled=event.target.checked;field.required=!event.target.checked;}$('#password-fields').hidden=event.target.checked;}
  if(event.target.dataset.select){event.target.checked?selected.add(event.target.dataset.select):selected.delete(event.target.dataset.select);render();}
  if(event.target.dataset.stage)change(s=>{const c=s.cases.find(c=>c.id===event.target.dataset.stage);if(c&&Object.hasOwn(STAGES,event.target.value)){setCaseStage(c,event.target.value);c.updatedAt=now();}},'Etapa atualizada.').catch(e=>toast(e.message));
});
const settingsEvents=createSettingsEvents(viewApp);
const updateTimeControls=form=>settingsEvents.updateTimeControls(form);
document.addEventListener('click',settingsEvents.handleClick);
document.addEventListener('change',settingsEvents.handleChange);

// Captura antes dos botoes existentes, incluindo X, Cancelar e Escape.
document.addEventListener('click',event=>{
 const t=event.target.closest('[data-action="close"],#close-dialog,a[href^="#"]');if(!t)return;
 const closing=t.matches('[data-action="close"],#close-dialog');
 if((closing?editorChanged():settingsDirty)&&!confirm('Há alterações não salvas. Deseja descartá-las?')){event.preventDefault();event.stopImmediatePropagation();}
},true);
$('#editor').addEventListener('cancel',event=>{if(editorChanged()&&!confirm('Descartar as alterações não salvas?'))event.preventDefault();});
window.addEventListener('beforeunload',event=>{if(settingsDirty||editorChanged()){event.preventDefault();event.returnValue='';}});
document.addEventListener('submit',async event=>{
  const form=event.target;if(!['entity-form','settings-form','auto-form','import-form','restore-form','backup-form','decrypt-form','payment-form','reversal-form','manual-check-form','coverage-form','sheet-file-form','sheet-mapping-form','sheet-confirm-form','workflow-form','workflow-pending-form'].includes(form.id))return;event.preventDefault();const submit=form.querySelector('[type=submit]');if(submit.disabled)return;submit.disabled=true;submit.dataset.loading="true";submit.setAttribute("data-loading-fixed","");submit.setAttribute("aria-busy","true");
  try{
    const data=Object.fromEntries(new FormData(form));
    for(const name of ['amount','paid'])if(data[name]!==undefined&&String(data[name]).trim())data[name]=normalizeMoneyInput(data[name]);
    if(form.id==='workflow-form'){
      const caseId=form.dataset.id,scroll=$('#editor').scrollTop;
      await change(s=>updateCaseWorkflow(s,caseId,data));
      fullDetail(caseId);$('#editor').scrollTop=scroll;toast('Próximo passo, responsável e revisão salvos.');
    }
    if(form.id==='workflow-pending-form'){
      const caseId=form.dataset.id,scroll=$('#editor').scrollTop;
      await change(s=>addCasePending(s,caseId,data.title));
      fullDetail(caseId);$('#editor').scrollTop=scroll;toast('Pendência adicionada ao processo.');
    }
    if(form.id==='sheet-file-form'){pendingWorkbook=await readSpreadsheet(data.file);spreadsheetMappingDialog();}
    if(form.id==='sheet-mapping-form'){
      const sheet=pendingWorkbook?.sheets?.[Number(data['sheet-index']||0)];
      if(!sheet)throw Error('Aba não selecionada.');
      const mapping=Object.fromEntries(Object.keys(IMPORT_FIELDS).map(key=>[key,Number(data['map-'+key])]));
      const plan=planSpreadsheetImport(state,sheet,mapping);
      spreadsheetPreviewDialog(sheet,mapping,plan);
    }
    if(form.id==='sheet-confirm-form'){
      if(data.confirmed!=='yes'||!pendingSheetPlan?.plan)throw Error('Confirme a prévia antes de importar.');
      let result;await change(s=>{result=commitSpreadsheetImport(s,pendingSheetPlan.sheet,pendingSheetPlan.mapping,pendingSheetPlan.plan,{linkExistingClients:data.confirmedExisting==='yes'});});
      pendingSheetPlan=null;pendingWorkbook=null;$('#editor').close();
      toast(`${result.imported} processos importados, ${result.clientsAdded} cliente(s) novo(s). ${result.ignored} linha(s) ignoradas. Nenhuma consulta iniciada.${result.appointmentsAdded?` ${result.appointmentsAdded} audiência(s) adicionada(s) à agenda.`:''}`);
    }
    if(form.id==='backup-form'){if(!data.plain&&data.password!==data.confirmation)throw Error('As senhas não coincidem.');const bundle=await exportBundle();if(integrated)bundle.monitoring=await exportMonitoring();const payload=data.plain?bundle:await encryptBackup(bundle,data.password);downloadJSON(payload,`Painel-HB-backup-${data.plain?'aberto':'protegido'}-${dateKey()}.json`);$('#editor').close();toast(data.plain?'Backup sem senha exportado. Guarde em local privado.':'Backup com senha exportado, incluindo monitoramento e anexos. Guarde a senha.');}
    if(form.id==='decrypt-form'){const decoded=await decryptBackup(pendingEncrypted,data.password);pendingMonitoring=decoded.monitoring||null;await acceptBackup(decoded);pendingEncrypted=null;}
    if(form.id==='payment-form'){const feeId=form.dataset.id;await change(s=>registerPayment(s,{...data,feeId}));paymentDialog(feeId);toast('Recebimento registrado.');}
    if(form.id==='reversal-form'){let feeId;await change(s=>{feeId=reversePayment(s,form.dataset.id,data).feeId;});paymentDialog(feeId);toast('Estorno registrado sem apagar o lançamento original.');}
    if(form.id==='manual-check-form'){const caseId=form.dataset.id;await change(s=>registerManualCheck(s,{...data,caseId}));fullDetail(caseId);toast('Resultado da conferência salvo no histórico.');}
    if(form.id==='coverage-form'){await change(s=>registerCoverageSample(s,data));$('#editor').close();toast('Comparação manual salva. Confira o histórico em Fontes e ajustes.');}
    if(form.id==='entity-form'){
      if(form.dataset.table==='cases')data.datajudDetails=getDatajudDraft(form);
      await mutate(s=>{
        if(integrated&&Number(form.dataset.revision)!==s.revision)throw Error('A carteira foi alterada em segundo plano. Feche e reabra este formulário para conferir os dados atuais.');
        return saveEntity(s,form.dataset.table,{...data,id:form.dataset.id});
      });$('#editor').close();await refresh(true);toast('Registro salvo.');
    }
    if(form.id==='settings-form'){
      const days=Number(data.djenDays);if(!Number.isInteger(days)||days<1||days>365)throw Error('Informe um período de 1 a 365 dias.');
      const oab=String(data.oab||'').replace(/[\s.\-]/g,'').toUpperCase(),uf=String(data.ufOab||'');if(oab&&!uf)throw Error('Selecione a UF da OAB.');if(uf&&!oab)throw Error('Informe o número da OAB ou deixe a UF sem seleção.');if(oab&&!/^\d{1,8}[A-Za-z]?$/.test(oab))throw Error('Confira o número da OAB.');
      await mutate(s=>Object.assign(s.settings,{datajud:!!data.datajud,djen:!!data.djen,datajudKey:(data.datajudKey===undefined?s.settings.datajudKey:String(data.datajudKey)).trim().replace(/^APIKey\s+/i,'').trim(),djenDays:days,oab,ufOab:uf}));
      rememberForm(form);updateSettingsDirty();
      await refresh(true);
      toast('Configurações salvas.');
    }
    if(form.id==='auto-form'){
      const enabled=data.autoUpdateEnabled==='on';
      const values=[...form.querySelectorAll('[name=autoTime]')].map(x=>x.value);
      if(enabled&&values.some(x=>!x))throw Error('Preencha o horário vazio ou remova essa linha.');
      const times=enabled?parseAutoTimes(values.join(',')):autoScheduleInfo(state.settings).times;
      await mutate(s=>Object.assign(s.settings,{autoUpdateEnabled:data.autoUpdateEnabled==='on',autoUpdateTimes:times.join(',')}));
      rememberForm(form);updateSettingsDirty();
      await refresh(true);
      toast(data.autoUpdateEnabled==='on'?'Atualização automática ativada: '+times.join(', ')+'.':'Atualização automática desativada.');
    }
    if(form.id==='import-form'){
      const lines=String(data.numbers).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(lines.length>500)throw Error('Importe até 500 números por vez.');const seen=new Set(state.cases.map(c=>c.cnj));const preview=lines.map(line=>{const cnj=digits(line);const error=!validCnj(cnj)?'CNJ inválido':seen.has(cnj)?'Já cadastrado ou repetido':'';seen.add(cnj);return {cnj,line,error};});pendingImport=preview.filter(x=>!x.error).map(x=>x.cnj);
      dialog('Prévia da importação',`<p>${pendingImport.length} processo(s) pronto(s) para cadastrar. ${preview.length-pendingImport.length} linha(s) serão ignoradas.</p><div class="import-preview">${preview.map(x=>`<p class="${x.error?'import-error':''}">${esc(x.line)} · ${x.error||'Pronto para cadastrar'}</p>`).join('')}</div><div class="form-actions">${button('import-cnj','Voltar','ghost')}${pendingImport.length?button('confirm-import','Cadastrar '+pendingImport.length+' processo(s)','primary'):''}</div>`);
    }
    if(form.id==='restore-form'){
      if(!data.confirmed||!pendingRestore)throw Error('Confirme a substituição.');
      if(state.jobs.some(j=>['queued','running'].includes(j.status)))throw Error('Cancele e aguarde as consultas antes de restaurar.');
      if(integrated&&pendingMonitoring)await restoreMonitoring(pendingMonitoring);
      await restoreBundle(pendingRestore);pendingRestore=null;pendingMonitoring=null;selected.clear();$('#editor').close();await refresh(true);
      if(integrated&&serviceOnline)await syncBrowser(state,true);
      toast('Backup restaurado. Confira cadastros, anexos, totais e monitoramento antes de continuar.');
    }
  }catch(e){const error=form.querySelector('.form-error');if(error){error.textContent=e.message;error.tabIndex=-1;error.focus();}else toast(e.message);}finally{if(submit.isConnected){submit.disabled=false;submit.removeAttribute("data-loading");submit.removeAttribute("data-loading-fixed");submit.removeAttribute("aria-busy");}}
});
window.addEventListener('hashchange',()=>{route=Object.hasOwn(routes,location.hash.slice(1))?location.hash.slice(1):'home';query='';settingsDirty=false;scheduledPage=1;publicationFilter='all';publicationFetched=0;publicationLimit=PUBLICATION_BATCH_SIZE;selected.clear();render();});
async function start(){
  route=Object.hasOwn(routes,location.hash.slice(1))?location.hash.slice(1):'home';
  await initializeWorkspace();
  await refresh(true);
  installIntegratedActions({update,toast});
  if(integrated){
    await connect(state);
    decorateIntegrated(route,state);
  organizePanel(route);
    void notificationCenter.refresh(true);
    void refreshPublications();
    setInterval(async()=>{
      if(!document.hidden){
        await refresh().catch(()=>{});
        await pollService();
        if(!serviceOnline)await connect(state);
        decorateIntegrated(route,state);
  organizePanel(route);
        void notificationCenter.refresh();
        void refreshPublications();
        await refreshIntegratedCase();
      }
    },3500);
  }else{
    // File:// nao executa a fila antiga nem muda seu estado ao abrir.
    // O modo integrado executa uma fila SEPARADA, preservando historico local.
  }
}
globalThis.__PAUTA_BOOTED__=true;
start().catch(e=>{$('#content').textContent='Não foi possível abrir o banco local: '+e.message;});
