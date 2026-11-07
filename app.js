import {escapeHTML as esc} from './html-utils.js';
import {organizePanel} from './panel-organization.js';
import {schedulePanel,scheduleRow} from './schedule-panel.js';
import {safeDateLabel} from './safe-dates.js';
import {normalizeMoneyInput} from './form-inputs.js';
import {publicationDetailsHTML} from './publication-details.js';
import {installLoadingIndicators} from './loading-indicator.js';
installLoadingIndicators();
import {readState,initializeWorkspace,mutate,addDocument,readDocument,auditLocalAttachments,removeDocument,exportBundle,decodeBundle,restoreBundle} from './db.js';
import {taskView,STAGES,JUDICIAL_SYSTEMS,COURTS,COURT_LEVELS,PROCESS_SYSTEMS,MANUAL_CHECK_RESULTS,COVERAGE_RESULTS,WORK_OWNERS,WORK_STATUSES,VERSION,saveEntity,cnjChangeImpact,auditLocalData,reconcileEventLinks,pendingManualReviews,pendingSourceIssues,pendingOabIssue,latestCoverageJob,registerCoverageSample,coverageSummary,coverageEvidenceMatrix,formatCnj,dateKey,digits,validCnj,money,overview,registerPayment,reversePayment,registerManualCheck,sameManualIdentity,now,caseDeletionImpact,deleteCases,updateCaseWorkflow,markCaseReviewed,addCasePending,toggleCasePending,removeCasePending} from './core.js';
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
import {historyPage} from './integrated-case-view.js';
import {NotificationCenter,notificationKey} from './notifications.js';

const $=selector=>document.querySelector(selector);
const paths={home:'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',cases:'M3 7h7l2-3h9v16H3Z',clients:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3a4 4 0 0 1 0 8',tasks:'M9 5h12 M9 12h12 M9 19h12 M3 5l1 1 2-2 M3 12l1 1 2-2 M3 19l1 1 2-2',agenda:'M4 5h16v16H4Z M8 3v4 M16 3v4 M4 10h16 M8 14h3 M14 14h2',agendados:'M4 5h16v16H4Z M8 3v4 M16 3v4 M4 10h16 M8 15l2 2 4-4',finance:'M3 5h18v14H3Z M12 8a3 3 0 1 0 0 8 3 3 0 0 0 0-8 M6 9v6 M18 9v6',publications:'M6 3h9l4 4v14H6Z M14 3v6h5 M9 13h7 M9 17h5',sources:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M3 12h2 M19 12h2 M12 3v2 M12 19v2 M5.6 5.6 7 7 M17 17l1.4 1.4 M5.6 18.4 7 17 M17 7l1.4-1.4',privacy:'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12 M3 3l18 18',backup:'M5 17v4h14v-4 M12 3v12 M7 10l5 5 5-5',refresh:'M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 12-1l2 3 M4 15l2 3a7 7 0 0 0 12-1',plus:'M12 5v14 M5 12h14',arrow:'M5 12h14 M13 6l6 6-6 6',check:'M5 12l4 4L19 6'};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.cases}"/></svg>`;
const routes={home:['Visão geral','Seu escritório em um só lugar'],cases:['Processos','Casos, próximos passos e histórico'],agendados:['Agendados','Próximas providências, responsáveis e revisões'],clients:['Clientes','Contatos e relacionamentos'],tasks:['Tarefas','O trabalho que precisa avançar'],agenda:['Agenda','Compromissos confirmados por você'],finance:['Honorários','Previsão, recebimentos e saldo'],publications:['Publicações','Comunicações disponíveis no DJEN'],sources:['Fontes e ajustes','Transparência em cada consulta']};
// Keep the central close to the overview, before the existing destinations.
const notificationRoutes=Object.entries(routes);Object.keys(routes).forEach(k=>delete routes[k]);
for(const [k,v] of notificationRoutes){routes[k]=v;if(k==='home')routes.notifications=['Notificações','Todas as novidades dos processos, em um só lugar'];}
paths.notifications='M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4';
const statusName={queued:'Na fila',running:'Consultando',success:'Concluído',not_found:'Não localizado',error:'Falhou',action:'Requer ação',cancelled:'Cancelado',interrupted:'Interrompido'};
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
function agendadosPanel(){
  const model=scheduledCases(state.cases,{owner:scheduledOwner,query,sort:scheduledSort,today:dateKey(),clientName});
  const ordered=Object.values(model.groups).flat(),pageSize=15,pages=Math.max(1,Math.ceil(ordered.length/pageSize));
  scheduledPage=Math.max(1,Math.min(pages,scheduledPage));
  const visibleIds=new Set(ordered.slice((scheduledPage-1)*pageSize,scheduledPage*pageSize).map(c=>c.id));
  const options=[['all','Todos'],...Object.entries(WORK_OWNERS)].map(([key,label])=>`<button type="button" data-action="scheduled-owner" data-id="${key}" class="agendados-owner ${key===scheduledOwner?'active':''}" aria-pressed="${key===scheduledOwner}">${esc(label)} <span>${model.counts[key]}</span></button>`).join('');
  const overview=`<div class="agendados-overview" aria-label="Resumo de revisões"><div><strong>${model.overview.overdue}</strong><span>Atrasadas</span></div><div><strong>${model.overview.today}</strong><span>Revisar hoje</span></div><div><strong>${model.overview.week}</strong><span>Próximos 7 dias</span></div><div><strong>${model.overview.pending}</strong><span>Pendências abertas</span></div></div>`;
  const filters=`<div class="agendados-toolbar"><div class="agendados-owners" role="group" aria-label="Responsável pela próxima ação">${options}</div><div class="agendados-toolbar-right"><label class="field">Buscar processo ou providência<input class="search" data-filter="search" aria-label="Buscar nos agendados" placeholder="Cliente, CNJ, próximo passo…" value="${esc(query)}"></label><label class="field">Ordenar por<select data-scheduled-sort="true" aria-label="Ordenar agendados">${Object.entries(SCHEDULE_SORTS).map(([key,label])=>`<option value="${key}" ${scheduledSort===key?'selected':''}>${esc(label)}</option>`).join('')}</select></label></div></div>`;
  const groups=Object.entries(model.groups).map(([key,rows])=>[key,rows.filter(c=>visibleIds.has(c.id))]).filter(([,rows])=>rows.length).map(([key,rows])=>`<section class="agendados-group" aria-label="${esc(SCHEDULE_GROUPS[key])}"><div class="agendados-group-heading"><h3>${esc(SCHEDULE_GROUPS[key])}</h3><span>${rows.length}</span></div><div class="agendados-list">${rows.map(c=>{
    const pending=(c.pendingItems||[]).filter(item=>!item.done).length,viewedToday=c.reviewedAt&&dateKey(new Date(c.reviewedAt))===dateKey(),owner=c.workOwner||'me',status=c.workStatus||'todo';
    return `<article class="agendados-row"><div class="agendados-case"><button class="cell-title private" data-action="detail" data-id="${esc(c.id)}">${esc(c.title)}</button><small class="private">${esc(clientName(c.clientId))} · ${esc(c.cnj?formatCnj(c.cnj):c.docketNumber||'Sem CNJ')}</small></div><div class="agendados-status">${tag(WORK_OWNERS[owner]||WORK_OWNERS.me,'')}${tag(WORK_STATUSES[status]||WORK_STATUSES.todo,status==='ready'?'action':status==='done'?'success':'')}</div><div class="agendados-next"><strong class="private">${esc(c.nextStep||'Próximo passo ainda não definido')}</strong><small>${esc(c.area||'Área não informada')} · ${esc(PROCESS_SYSTEMS[c.processSystem||'']||'Sistema não informado')}</small>${pending?`<span class="agendados-pending">${pending} pendência(s) aberta(s)</span>`:''}</div><div class="agendados-review"><strong>${c.review?date(c.review):'Sem data'}</strong><small>${c.reviewedAt?'Visto: '+timestamp(c.reviewedAt):'Ainda não visto'}</small></div><div class="agendados-actions">${button('detail','Abrir ficha','secondary small',c.id)}${button('workflow-viewed',viewedToday?'Visto hoje ✓':'Marcar visto','ghost small',c.id)}</div></article>`;
  }).join('')}</div></section>`).join('');
  const emptyMessage=state.cases.some(c=>!c.archived)?'<div class="empty"><h2>Nenhum processo neste filtro</h2><p>Altere o responsável ou o termo pesquisado.</p></div>':empty('Organize suas revisões','Cadastre o primeiro processo. Depois registre o próximo passo, responsável e data de revisão.','new-cases','Cadastrar processo');
  const paging=model.total?`<div class="agendados-footer"><span>Mostrando ${(scheduledPage-1)*pageSize+1} a ${Math.min(scheduledPage*pageSize,model.total)} de ${model.total} processo(s)</span><div class="line-actions"><button class="button ghost small" data-action="scheduled-prev" ${scheduledPage<=1?'disabled':''}>Anterior</button><span class="muted compact">${scheduledPage} de ${pages}</span><button class="button secondary small" data-action="scheduled-next" ${scheduledPage>=pages?'disabled':''}>Próxima</button></div></div>`:'';
  return '<p class="intro-note">As revisões e providências são planejadas manualmente. “Visto” é um controle interno e não representa ciência de intimação nem contagem automática de prazo judicial.</p>'+overview+panel(`Agendados <span class="pill">${model.total}</span>`,filters+(groups||emptyMessage)+paging);
}
function home(){
  const today=dateKey(),due=[...state.appointments.filter(a=>a.when?.slice(0,10)===today).map(a=>({title:a.title,sub:'Compromisso · '+a.when.slice(11,16),action:'edit-appointments',id:a.id})),...state.tasks.filter(t=>t.due&&t.due<=today&&t.stage!=='done').map(t=>({title:t.title,sub:'Tarefa · '+caseName(t.caseId),action:'edit-tasks',id:t.id})),...state.cases.filter(c=>!c.archived&&c.review&&c.review<=today).map(c=>({title:c.title,sub:'Revisão agendada para '+date(c.review),action:'detail',id:c.id}))];
  const attention=`<section class="attention"><div class="attention-heading"><div><p class="eyebrow">HOJE</p><h2>O que pede atenção</h2></div><span class="pill">${due.length} ponto(s) de atenção</span></div>${due.length?due.slice(0,5).map(d=>`<div class="attention-row"><span class="round-icon">${icon('arrow')}</span><div><p class="private">${esc(d.title)}</p><small class="private">${esc(d.sub)}</small></div>${button(d.action,'Abrir','ghost small',d.id)}</div>`).join(''):'<div class="attention-row"><span class="round-icon">'+icon('check')+'</span><div><p>Nenhuma pendência para hoje</p><small>Revisões e tarefas cadastradas aparecem aqui.</small></div></div>'}</section>`;
  const pending=pendingManualReviews(state);
  const reviews=pending.length?`<section class="attention" aria-label="Conferências pendentes"><div class="attention-heading"><div><p class="eyebrow">CONFERÊNCIAS MANUAIS</p><h2>Resultados para encaminhar</h2></div><span class="pill">${pending.length} pendência(s)</span></div>${pending.slice(0,5).map(x=>`<div class="attention-row"><span class="round-icon">${icon('arrow')}</span><div><p class="private">${esc(caseName(x.caseId))}</p><small class="private">${esc(MANUAL_CHECK_RESULTS[x.result])} · ${timestamp(x.checkedAt)} · ${esc(x.notes.slice(0,120))}</small></div><div class="line-actions">${button('task-from-check','Criar tarefa','secondary small',x.checkId)}${button('detail','Abrir processo','ghost small',x.caseId)}</div></div>`).join('')}${pending.length>5?'<p class="muted compact">Exibindo as cinco conferências mais recentes sem tarefa vinculada.</p>':''}<p class="muted compact">As conferências são registros feitos por você, não prazos calculados automaticamente.</p></section>`:'';
  const issues=pendingSourceIssues(state);
  const failures=issues.length?`<section class="attention" aria-label="Falhas nas fontes"><div class="attention-heading"><div><p class="eyebrow">CONSULTAS AUTOMÁTICAS</p><h2>Fontes que precisam de atenção</h2></div><span class="pill">${issues.length} fonte(s)</span></div>${issues.slice(0,5).map(x=>`<div class="attention-row"><span class="round-icon">${icon('refresh')}</span><div><p class="private">${esc(caseName(x.caseId))} · ${x.source==='datajud'?'DataJud':'DJEN'}</p><small class="private">${esc(statusName[x.status])} · ${timestamp(x.updatedAt)} · ${esc(x.message.slice(0,140))}${x.partial?' · Resultado parcial':''}${x.retrying?' · Nova tentativa em andamento':''}</small></div><div class="line-actions">${!x.retrying?button('retry-source','Tentar novamente','secondary small',x.jobId):''}${button('detail','Abrir processo','ghost small',x.caseId)}</div></div>`).join('')}${issues.length>5?'<p class="muted compact">Exibindo cinco fontes com falhas não resolvidas. Veja o histórico completo em Fontes e ajustes.</p>':''}<p class="muted compact">Falhas anteriores permanecem até uma consulta posterior ser concluída na mesma fonte. Resultados não encontrados não são tratados como erro.</p></section>`:'';
  const oabIssue=pendingOabIssue(state);
  const oabFailure=oabIssue?`<section class="attention" aria-label="Falha na busca OAB"><div class="attention-heading"><div><p class="eyebrow">PUBLICAÇÕES DJEN</p><h2>Busca por OAB precisa de atenção</h2></div><span class="pill">1 busca</span></div><div class="attention-row"><span class="round-icon">${icon('refresh')}</span><div><p class="private">OAB ${esc(oabIssue.oab)}/${esc(oabIssue.ufOab)}</p><small class="private">${esc(statusName[oabIssue.status])} · ${timestamp(oabIssue.updatedAt)} · ${esc(oabIssue.message.slice(0,140))}${oabIssue.partial?' · Resultado parcial':''}${oabIssue.retrying?' · Nova tentativa em andamento':''}</small></div><div class="line-actions">${!oabIssue.retrying?button('retry-oab','Tentar novamente','secondary small',oabIssue.jobId):''}${button('open-sources','Ver histórico','ghost small')}</div></div><p class="muted compact">A retentativa usa a mesma OAB/UF e, quando disponível, o período anterior. Não garante uma consulta completa.</p></section>`:'';
  const attentionCases=state.cases.filter(c=>!c.archived&&(c.nextStep||c.review)).slice(0,5);
  const attentionList=attentionCases.length?'<div class="record-list home-attention-list">'+attentionCases.map(c=>'<article class="record">'+button('detail',esc(c.title),'ghost small',c.id)+'<p class="private">'+esc(c.nextStep||'Revisão: '+safeDateLabel(c.review))+'</p></article>').join('')+'</div>':'<p class="muted">Nenhum processo com próximo passo ou revisão cadastrados.</p>';
  return attention+reviews+'<section class="panel"><h2>Novidades dos processos</h2><p>Confira movimentações e publicações na central.</p><a class="button secondary" href="#notifications">Abrir Notificações</a></section>'+failures+oabFailure+panel('Processos em atenção',attentionList,'<a class="button secondary small" href="#cases">Ver todos os processos '+icon('arrow')+'</a>')+metrics();
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
function documentsSection(id){const items=state.documents.filter(d=>d.caseId===id);return `<div class="detail-section"><div class="panel-heading"><h3>Anexos · ${items.length}</h3>${button('attach','Anexar documento','secondary small',id)}</div><p class="muted compact">PDF, PNG, JPEG, WebP ou TXT UTF-8. Até 5 MB por arquivo e 25 MB no total. Armazenamento local, incluído no backup.</p>${items.map(d=>`<article class="record"><div class="record-head"><div><strong class="private">${esc(d.name)}</strong><small>${(d.size/1024).toFixed(1)} KB · ${date(d.createdAt)}</small></div><div class="line-actions">${button('download-document','Baixar','secondary small',d.id)}${button('remove-document','Remover','ghost small',d.id)}</div></div></article>`).join('')||'<p class="muted">Nenhum documento anexado.</p>'}</div>`;}
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
function relatedProceedings(c){
 const parent=state.cases.find(x=>x.id===c.parentCaseId),children=state.cases.filter(x=>x.parentCaseId===c.id);
 return `<div class="detail-section"><h3>Tramitação e vínculos</h3><p class="private">${esc(jurisdictionLabel(c)||'Tribunal e grau não informados')}</p>${c.docketNumber?`<p class="private">Registro adicional: ${esc(c.docketNumber)}</p>`:''}${c.originReference?`<p class="private">Referência de origem: ${esc(c.originReference)}</p>`:''}${parent?`<p class="private">Origem: ${button('detail','Abrir '+esc(parent.title),'secondary small',parent.id)}</p>`:''}${children.map(x=>`<p class="private">Relacionado: ${button('detail','Abrir '+esc(x.title),'secondary small',x.id)}</p>`).join('')}<p class="muted compact">Vínculos manuais. Eventos e documentos permanecem associados ao processo original.</p></div>`;
}
function eventRecord(e){const actionId=e.key,baseline=e.remote&&!e.is_new&&!e.seen&&!e.localIds.length;const sourceUrl=safePublicationUrl(e.url),certificateUrl=djenCertificateUrl(e.certificateHash);return `<article class="record" data-publication-key="${esc(e.key)}"><div class="record-head"><div><h3 class="private">${esc(e.cnj?formatCnj(e.cnj):'Referência processual')}</h3><small>${esc(e.tribunal||e.source)} · ${publicationDateBR(e.date)} · ${e.kind==='publication'?'Publicação':'Movimentação'}</small></div><div class="line-actions">${e.publicationStatus==='Cancelada'?tag('Publicação cancelada','action'):''}${baseline?tag('Referência inicial'):!e.seen?tag('Nova'):tag('Conferida')}${baseline?'':button('publication-seen',e.seen?'Desmarcar':'Conferir','ghost small',actionId)}</div></div>${e.source==='djen'?publicationDetailsHTML(e):''}<details><summary>${e.kind==='publication'?'Ler teor completo da comunicação':'Ver conteúdo e origem'}</summary><p class="private">${esc(e.text)}</p><p class="muted compact">Encontrado em ${timestamp(e.discoveredAt)}${e.sourceUpdatedAt?' · Atualização da fonte: '+esc(e.sourceUpdatedAt):''}</p></details>${e.kind==='publication'?`<div class="publication-actions">${certificateUrl?`${button('unified-publication-official-pdf','Baixar certidão oficial (PDF)','primary small',actionId)}<a class="button ghost small" target="_blank" rel="noopener noreferrer" href="${esc(certificateUrl)}">Abrir certidão no CNJ</a>`:'<span class="muted compact">Certidão oficial não identificada; atualize o DJEN</span>'}${button('unified-publication-pdf','Baixar cópia do teor (PDF)','secondary small',actionId)}${sourceUrl?`<a class="button ghost small" target="_blank" rel="noopener noreferrer" href="${esc(sourceUrl)}">Abrir processo na fonte</a>`:''}</div>`:''}<div class="meta"><span class="private">${e.caseId?esc(caseName(e.caseId)):'Ainda não associado a um caso'}</span>${!e.caseId&&validCnj(e.cnj)?button('unified-register-event','Cadastrar caso com este CNJ','ghost small',actionId):''}</div></article>`;}
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
function sourcePage(){const auto=autoScheduleInfo(state.settings);return `<div class="intro-note">Fontes gratuitas. Sem assinatura, crédito pago ou contratação automática. A abrangência real precisa ser conferida nos processos da sua carteira.</div><div class="split"><section class="panel"><h2>Conexões e consultas</h2><form id="settings-form" class="settings-form"><article class="source-card"><h3>DataJud <span class="pill">Metadados e movimentos</span></h3><p>Lê a base nacional por número CNJ. Consultar novamente não força a atualização do tribunal.</p><label class="check-field"><input type="checkbox" name="datajud" ${state.settings.datajud?'checked':''}> Incluir DataJud na atualização</label><label class="field">Chave pública do CNJ<input readonly value="${state.settings.datajudKey?'••••••••'+esc(state.settings.datajudKey.slice(-4)):'Sem chave configurada'}" aria-label="Chave pública protegida" style="background:var(--soft);color:var(--muted)"><small>A chave só muda quando você escolhe substituir ou remover.</small></label><div class="links"><button type="button" class="button secondary small" data-key-edit>${state.settings.datajudKey?'Substituir chave':'Adicionar chave'}</button>${state.settings.datajudKey?'<button type="button" class="button ghost small" data-key-remove>Remover chave</button>':''}</div><div data-key-editor hidden><label class="field">Nova chave pública<input name="datajudKey" type="password" disabled autocomplete="off" spellcheck="false" maxlength="256"><small>Cole a chave completa. Ela será aplicada ao salvar configurações.</small></label><button type="button" class="button ghost small" data-key-cancel>Cancelar alteração da chave</button></div><p><a href="https://datajud-wiki.cnj.jus.br/api-publica/acesso/" target="_blank" rel="noopener noreferrer">Obter chave na documentação do CNJ ↗</a></p></article><article class="source-card"><h3>DJEN <span class="pill">Publicações</span></h3><p>Consulta publicações por processo ou OAB. Não representa todos os movimentos do processo.</p><label class="check-field"><input type="checkbox" name="djen" ${state.settings.djen?'checked':''}> Incluir DJEN na atualização</label><div class="form-grid"><label class="field">Período de consulta (dias)<input type="number" min="1" max="365" name="djenDays" value="${state.settings.djenDays}" required></label><span></span><label class="field">Número da OAB<input name="oab" value="${esc(state.settings.oab)}" placeholder="Ex.: 123456" maxlength="9"></label><label class="field">UF da OAB<select name="ufOab"><option value="">Selecione</option>${'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SE SP TO'.split(' ').map(x=>`<option ${x===state.settings.ufOab?'selected':''}>${x}</option>`).join('')}</select></label></div></article><button class="button primary" type="submit">Salvar configurações</button><p class="form-error" id="settings-error" role="alert"></p></form></section><div>${schedulePanel(state.settings)}<section class="panel"><h2>Dados sob seu controle</h2><p class="muted">No modo integrado, cadastros, anexos e monitoramento ficam no banco local deste computador. No modo arquivo, os dados ficam neste navegador. Exporte uma cópia antes de trocar de perfil ou computador.</p><div class="links">${button('backup','Exportar backup','primary')}${button('restore','Restaurar backup','secondary')}</div><p class="warning-note">O backup pode ser protegido por senha, inclui os anexos e, no modo integrado, também o monitoramento SQLite. Guarde a senha. A restauração substitui os dados após prévia e confirmação.</p></section><section class="panel"><h2>Alcance desta versão</h2><ul class="source-limits"><li>Não há busca nacional por CPF/CNPJ.</li><li>TJSP e-SAJ é opcional; não há integração específica com PJe, eproc ou Projudi.</li><li>Não há login em JusBR/PDPJ ou acesso a peças restritas.</li><li>Não há resolução automática de CAPTCHA.</li><li>Não há consulta com navegador e computador desligados.</li><li>Consultas concluídas se referem às fontes e ao período selecionados.</li></ul><p class="muted compact">Painel H.B ${VERSION} · dados locais · testes de interface com respostas simuladas são distintos dos testes de conectividade.</p></section></div></div>`+jobsPanel();}
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
  $('#content').innerHTML=({home,notifications:()=>'<div id="notification-center"></div>',agendados:agendadosPanel,cases:casesPanel,clients,tasks,agenda,finance,publications,sources:sourcePage})[route]();
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
function edit(table,id='',preset={}){
  const row={...preset,...(state[table].find(x=>x.id===id)||{})};let fields='';
  const caseOptions=[['','Sem processo vinculado'],...state.cases.map(c=>[c.id,c.title])];
  if(table==='clients')fields=field('Nome *','name',row.name,'text',true,'required maxlength="180"')+field('Telefone / WhatsApp','phone',row.phone,'tel')+field('E-mail','email',row.email,'email')+area('Observações','notes',row.notes);
  if(table==='cases')fields=field('Título do caso *','title',row.title,'text',true,'required maxlength="240"')+field('Número CNJ (opcional para pré-processual)','cnj',row.cnj?formatCnj(row.cnj):'','text',true,'placeholder="0000000-00.0000.0.00.0000" maxlength="25"')+'<p id="cnj-inference" class="cnj-inference muted compact" aria-live="polite"></p>'+field('Unidade de origem (pela tabela oficial, quando disponível)','originUnit','','text',true,'readonly aria-readonly="true" placeholder="Será identificada pelo CNJ"')+djenLookupHTML()+'<details class="datajud-lookup"><summary>Consulta complementar - DataJud</summary><button class="button secondary small" type="button" data-action="datajud-search">Buscar dados no DataJud</button><p class="muted compact">O tribunal e a unidade de origem são inferidos localmente dos dígitos. O nome da unidade vem da tabela oficial disponível para o TJRJ; para outros tribunais, consulte o respectivo cadastro. O DataJud é uma consulta separada para buscar metadados públicos.</p><p id="datajud-status" class="compact" aria-live="polite" role="status"></p><div id="datajud-preview" class="datajud-preview" hidden></div></details>'+select('Cliente','clientId',[['','Sem cliente vinculado'],...state.clients.map(c=>[c.id,c.name])],row.clientId)+field('Autor / parte autora','plaintiff',row.plaintiff,'text',true,'maxlength="400"')+field('Réu / parte ré','defendant',row.defendant,'text',true,'maxlength="400"')+field('Área','area',row.area)+select('Etapa de trabalho','stage',Object.entries(STAGES),row.stage||'todo')+select('Sistema de tramitação TJRJ (confirmado manualmente)','judicialSystem',Object.entries(JUDICIAL_SYSTEMS),row.judicialSystem||'')+field('Data para revisar','review',row.review,'date')+'<label class="field full">Próximo passo<textarea name="nextStep" maxlength="500" rows="2" placeholder="Ex.: Aguardar manifestação do cliente">'+esc(row.nextStep||'')+'</textarea></label>'+select('Responsável pela próxima ação','workOwner',Object.entries(WORK_OWNERS),row.workOwner||'me')+select('Situação do próximo passo','workStatus',Object.entries(WORK_STATUSES),row.workStatus||'todo')+area('Observações','notes',row.notes);
  if(table==='cases')fields+=select('Tribunal (inferido pelo CNJ; confira)','court',Object.entries(COURTS),row.court||'')+select('Grau / órgão judicial (não consta nos dígitos do CNJ)','courtLevel',Object.entries(COURT_LEVELS),row.courtLevel||'')+select('Sistema do processo (não consta nos dígitos do CNJ)','processSystem',Object.entries(PROCESS_SYSTEMS),row.processSystem||'')+select('Processo de origem cadastrado','parentCaseId',[['','Sem vínculo de origem'],...state.cases.filter(c=>c.id!==id).map(c=>[c.id,c.title+' · '+(c.cnj?formatCnj(c.cnj):c.docketNumber||'sem CNJ')])],row.parentCaseId||'')+field('Número de registro adicional (STJ/STF etc.)','docketNumber',row.docketNumber,'text',false,'maxlength="100"')+field('Referência externa de origem (não vinculada automaticamente)','originReference',row.originReference,'text',true,'maxlength="120"')+'<p class="muted compact">O CNJ identifica segmento, tribunal e código da unidade de origem. Grau e sistema eletrônico precisam ser confirmados por outra fonte. Vincular processos não mistura seus CNJs, publicações, anexos ou histórico.</p>';
  if(table==='tasks')fields=field('Tarefa *','title',row.title,'text',true,'required maxlength="240"')+select('Processo','caseId',caseOptions,row.caseId)+select('Etapa','stage',Object.entries(STAGES),row.stage||'todo')+field('Vencimento','due',row.due,'date',true)+area('Observações','notes',row.notes)+(row.manualCheckId?`<input type="hidden" name="manualCheckId" value="${esc(row.manualCheckId)}"><p class="muted compact">Origem: conferência manual do processo. Defina o vencimento somente após confirmar o prazo na fonte oficial.</p>`:'');
  if(table==='appointments')fields=field('Compromisso *','title',row.title,'text',true,'required maxlength="240"')+field('Data e hora (Brasília) *','when',row.when,'datetime-local',false,'required')+select('Tipo','kind',[['Reunião','Reunião'],['Audiência','Audiência'],['Revisão','Revisão'],['Prazo confirmado','Prazo confirmado']],row.kind||'Reunião')+select('Processo','caseId',caseOptions,row.caseId)+area('Observações','notes',row.notes);
  if(table==='fees')fields=field('Descrição do honorário *','title',row.title,'text',true,'required maxlength="240"')+select('Processo','caseId',caseOptions,row.caseId)+field('Vencimento','due',row.due,'date')+field('Valor total (R$) *','amount',row.amount!==undefined?(row.amount/100).toFixed(2):'','number',false,'required min="0.01" step="0.01"')+(id?'<p class="muted compact">Use Recebimentos para lançar valores e estornos.</p>':field('Recebimento inicial (R$)','paid','0','number',false,'min="0" step="0.01"'))+area('Observações','notes',row.notes);
  const names={clients:'cliente',cases:'caso',tasks:'tarefa',appointments:'compromisso',fees:'honorário'};
  dialog((id?'Editar ':'Cadastrar ')+names[table],`<form id="entity-form" data-table="${table}" data-id="${esc(id)}"><div class="form-grid">${fields}</div>${table==='cases'?'<section class="datajud-saved-panel"><h3>Dados públicos do processo · DataJud</h3><div id="datajud-fields"></div></section>':''}${id&&table==='cases'?'<section id="cnj-change-warning" class="cnj-change-panel" hidden aria-label="Confirmação da correção do CNJ"></section>':''}<p class="form-error" id="entity-error" role="alert"></p><div class="form-actions">${id&&table==='cases'?button('archive',row.archived?'Desarquivar':'Arquivar','ghost',id):''}<button class="button ghost" type="button" data-action="close">Cancelar</button><button class="button primary" type="submit">Salvar ${names[table]}</button></div></form>`);
  $('#entity-form').dataset.revision=String(state.revision);
  if(table==='cases'){initDatajudForm($('#entity-form'),row.datajudDetails);updateCnjInference($('#entity-form'));renderCnjChangeWarning();}
}
let activeDetailCaseId='',localHistoryPage=1;
function localHistoryHTML(events){
  if(!events.length)return '<p class="muted">As informações encontradas nas fontes aparecerão aqui.</p>';
  const slice=historyPage(events,localHistoryPage);
  localHistoryPage=slice.page;
  const entries=slice.items.map(e=>{
    const label=e.kind==='publication'?'Publicação':'Movimentação';
    const url=safePublicationUrl(e.url),certificate=djenCertificateUrl(e.certificateHash);
    const summary=String(e.text||'Descrição não informada').replace(/\s+/gu,' ').slice(0,145);
    return `<article class="case-history-event"><details><summary class="case-history-summary"><time class="case-history-date">${esc(publicationDateBR(e.date))}</time><span class="integrated-source">${esc(e.tribunal||e.source||'Fonte não informada')}</span><span class="integrated-degree">${label}</span>${e.publicationStatus==='Cancelada'?tag('Publicação cancelada','action'):''}${!e.seen?'<span class="integrated-pending-tag">Por conferir</span>':''}<span class="case-history-snippet private">${esc(summary)}</span><span class="integrated-event-caret" aria-hidden="true">⌄</span></summary><div class="case-history-extra private"><p>${esc(e.text||'Descrição não informada')}</p>${e.source==='djen'?publicationDetailsHTML(e):''}<p class="muted compact">Identificado em ${timestamp(e.discoveredAt)}${e.sourceUpdatedAt?' · Atualização da fonte: '+esc(e.sourceUpdatedAt):''}</p><div class="case-history-actions">${button('seen',e.seen?'Desmarcar conferência':'Marcar como conferido','ghost small',e.id)}${e.kind==='publication'?button('publication-pdf','Baixar cópia (PDF)','secondary small',e.id)+(certificate?button('publication-official-pdf','Baixar certidão oficial','secondary small',e.id):''):''}${url?`<a href="${esc(url)}" class="button ghost small" target="_blank" rel="noopener noreferrer">Abrir na fonte</a>`:''}${certificate?`<a href="${esc(certificate)}" class="button ghost small" target="_blank" rel="noopener noreferrer">Abrir certidão no CNJ</a>`:''}</div></div></details></article>`;
  }).join('');
  const pagination=slice.pages>1?`<nav class="case-history-pagination" aria-label="Páginas do histórico local"><span>Mostrando ${slice.start+1}–${slice.end} de ${slice.count} · Página ${slice.page} de ${slice.pages}</span><div><button type="button" class="button ghost small" data-case-page="${slice.page-1}" ${slice.page===1?'disabled':''}>Anterior</button><button type="button" class="button ghost small" data-case-page="${slice.page+1}" ${slice.page===slice.pages?'disabled':''}>Próxima</button></div></nav>`:'';
  return `<div class="case-history-list">${entries}</div>${pagination}`;
}
function refreshLocalHistory(){
  const section=$('#local-case-history');
  if(!section||!activeDetailCaseId)return;
  const events=state.events.filter(e=>e.caseId===activeDetailCaseId).sort((a,b)=>b.date.localeCompare(a.date));
  section.innerHTML=`<h3>Histórico · ${events.length} registro(s)</h3>${localHistoryHTML(events)}`;
}
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
async function action(name,id,caseId=''){
  if(name==='scheduled-owner'){if(id==='all'||Object.hasOwn(WORK_OWNERS,id)){scheduledOwner=id;scheduledPage=1;return render();}throw Error('Filtro de responsável inválido.');}
  if(name==='scheduled-prev'||name==='scheduled-next'){scheduledPage=Math.max(1,scheduledPage+(name==='scheduled-next'?1:-1));return render();}
  if(name==='workflow-viewed'){
    await change(s=>markCaseReviewed(s,id));
    if($('#editor').open&&$('#workflow-form')?.dataset.id===id){const y=$('#editor').scrollTop;fullDetail(id);$('#editor').scrollTop=y;}
    return toast('Processo marcado como visto hoje (controle interno).');
  }
  if(name==='workflow-pending-remove'){
    if(!caseId)throw Error('Processo da pendência não identificado.');
    await change(s=>removeCasePending(s,caseId,id));
    if($('#editor').open&&state.cases.some(c=>c.id===caseId)){const y=$('#editor').scrollTop;fullDetail(caseId);$('#editor').scrollTop=y;}
    return toast('Pendência removida da ficha.');
  }
  if(name==='djen-search')return searchDjen($('#entity-form'),apiPost,integrated&&serviceOnline);
  if(name==='djen-process'){await update([id],['djen']);return fullDetail(id);}
  if(name==='datajud-search')return searchDatajud($('#entity-form'),apiPost,integrated&&serviceOnline);
  if(name==='datajud-apply')return applyDatajudSelection($('#entity-form'));
  if(name==='changelog')return showChangelog();
  if(name.startsWith('new-')&&['clients','cases','tasks','appointments','fees'].includes(name.slice(4)))return edit(name.slice(4));
  if(name.startsWith('edit-'))return edit(name.slice(5),id);
  if(name==='detail')return fullDetail(id);
  if(name==='copy-cnj'){const c=state.cases.find(c=>c.id===id),info=officialConsultation(c);if(!info?.number)throw Error('Número CNJ válido não disponível para copiar.');await navigator.clipboard.writeText(info.number);return toast('Número CNJ copiado.');}
  if(name==='copy-docket'){const c=state.cases.find(c=>c.id===id),info=officialConsultation(c);if(!info?.docket)throw Error('Registro adicional indisponível.');await navigator.clipboard.writeText(info.docket);return toast('Registro adicional copiado.');}
  if(name==='manual-check')return manualCheckDialog(id);
  if(name==='close'){pendingRestore=null;pendingEncrypted=null;pendingWorkbook=null;pendingSheetPlan=null;pendingDeletion=null;return $('#editor').close();}
  if(name==='payments')return paymentDialog(id);
  if(name==='reverse-payment'){const p=state.payments.find(p=>p.id===id);return dialog('Estornar recebimento',`<p>O lançamento original de ${money(p.amount)} continuará no histórico.</p><form id="reversal-form" data-id="${esc(id)}"><div class="form-grid">${field('Data do estorno','date',dateKey(),'date',false,'required')}${area('Motivo obrigatório','notes')}</div><p class="form-error" role="alert"></p><div class="form-actions"><button type="button" class="button ghost" data-action="close">Cancelar</button><button type="submit" class="button danger">Confirmar estorno</button></div></form>`);}
  if(name==='attach')return attachDocument(id);
  if(name==='download-document'){const d=state.documents.find(d=>d.id===id),blob=await readDocument(id),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=d.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);return;}
  if(name==='remove-document'){const d=state.documents.find(d=>d.id===id);return dialog('Remover anexo',`<p class="private">${esc(d.name)}</p><div class="notice">O arquivo será removido deste banco local. Cópias em backups já exportados permanecerão disponíveis.</div>${button('confirm-remove-document','Confirmar remoção','danger',id)}`);}
  if(name==='confirm-remove-document'){const d=state.documents.find(d=>d.id===id);if(!d)return;await removeDocument(id);await refresh(true);fullDetail(d.caseId);toast('Anexo removido.');return;}
  if(name==='new-task-for')return edit('tasks','',{caseId:id});
  if(name==='task-from-check'){
    const c=state.cases.find(c=>(c.manualChecks||[]).some(x=>x.id===id&&sameManualIdentity(c,x)));
    const check=c?.manualChecks.find(x=>x.id===id);
    if(!check||!['attention','change','unavailable'].includes(check.result))throw Error('Conferência não encontrada ou sem pendência.');
    const linked=state.tasks.find(t=>t.caseId===c.id&&t.manualCheckId===check.id);
    if(linked)return edit('tasks',linked.id);
    return edit('tasks','',{caseId:c.id,manualCheckId:check.id,title:'Conferir resultado da consulta processual',notes:`Conferência manual em ${timestamp(check.checkedAt)} no ${PROCESS_SYSTEMS[check.source]||JUDICIAL_SYSTEMS[check.source]||'portal oficial'}: ${MANUAL_CHECK_RESULTS[check.result]}. ${check.notes}`});
  }
  if(name==='retry-source'){const response=await send('retry-source',{jobId:id});toast(response.count?'Nova consulta adicionada para esta fonte.':'Essa fonte já está em consulta.');return refresh(true);}
  if(name==='retry-oab'){const response=await send('retry-oab',{jobId:id});toast(response.count?'Busca por OAB adicionada novamente à fila.':'Esta OAB já está em consulta.');return refresh(true);}
  if(name==='open-sources'){location.hash='#sources';return;}
  if(name==='task-filter'){if(!['open','done','all'].includes(id))return;taskFilter=id;render();document.querySelector(`[data-action="task-filter"][data-id="${id}"]`)?.focus();return;}
  if(name==='refresh-publications')return refreshPublications(true);
  if(name==='publication-seen'||name.startsWith('unified-')){
    const e=unifiedPublications(state,publicationEvents).find(e=>e.key===id);if(!e)throw Error('Publicação não encontrada. Atualize a lista.');
    if(name==='unified-publication-pdf'){downloadPublicationPdf(e);return;}
    if(name==='unified-publication-official-pdf')return downloadOfficialCertificate(e,{integrated:e.remote,...(e.remote?{fetcher:apiFetch}:{})});
    if(name==='unified-register-event'){if(!validCnj(e.cnj))throw Error('CNJ inválido.');const existing=state.cases.find(c=>c.cnj===e.cnj);return existing?fullDetail(existing.id):edit('cases','',{cnj:e.cnj,title:'Processo '+formatCnj(e.cnj)});}
    const seen=!e.seen;publicationWriteEpoch++;
    if(e.remote){if(seen&&!e.is_new&&!e.seen){for(const ref of e.serviceRefs)await apiPost('events/seen',{caseId:ref.caseId,source:ref.source,eventId:ref.eventId});}else await apiPost('notifications/seen',{events:[{id:e.id,source:e.source,cnj:e.cnj}],seen});}
    publicationEvents=publicationEvents.map(x=>notificationKey(x)===e.key?{...x,seen:Number(seen),is_new:Number(!seen)}:x);
    if(e.localIds.length)await mutate(s=>{for(const x of s.events)if(notificationKey(x)===e.key)x.seen=seen;});
    notificationCenter.lastFetch=0;void notificationCenter.refresh(true);
    await refresh(true);toast(seen?'Publicação conferida.':'Conferência desmarcada.');return;
  }
  if(name==='publication-filter'){if(!Object.hasOwn(PUBLICATION_FILTERS,id))throw Error('Filtro de publicações inválido.');publicationFilter=id;publicationLimit=PUBLICATION_BATCH_SIZE;render();document.querySelector(`[data-action="publication-filter"][data-id="${id}"]`)?.focus();return;}
  if(name==='publication-more'){publicationLimit+=PUBLICATION_BATCH_SIZE;return render();}
  if(name==='publication-pdf'){
    const publication=state.events.find(e=>e.id===id&&e.kind==='publication');
    if(!publication)throw Error('Publicação não encontrada para exportar.');
    downloadPublicationPdf(publication);return;
  }
  if(name==='publication-official-pdf'){
    const publication=state.events.find(e=>e.id===id&&e.kind==='publication');
    if(!publication)throw Error('Publicação não encontrada para baixar certidão.');
    return downloadOfficialCertificate(publication,{integrated:false});
  }
  if(name==='filter-active'||name==='filter-archived'){filter=name.slice(7);selected.clear();return render();}
  if(name==='clear-case-filters'){caseCourtFilter='';caseLevelFilter='';caseSystemFilter='';selected.clear();return render();}
  if(name==='update-selected')return update([...selected]);
  if(name==='archive-selected'||name==='unarchive-selected'){
    const ids=[...selected],archived=name==='archive-selected';
    await change(s=>{for(const c of s.cases)if(ids.includes(c.id))c.archived=archived;},archived?'Processos arquivados.':'Processos desarquivados.');
    selected.clear();return render();
  }
  if(name==='delete-selected'){
    pendingDeletion=[...selected];
    const impact=caseDeletionImpact(state,pendingDeletion);
    const blocked=impact.attachments||impact.samples||impact.manualChecks;
    return dialog('Deletar '+impact.cases.length+' processo(s)',`<p class="subheading">${impact.cases.slice(0,6).map(c=>`<span class="private">${esc(c.title)}</span>`).join(' · ')}${impact.cases.length>6?' · outros '+(impact.cases.length-6):''}</p><p class="notice">Deletar remove os cadastros selecionados da carteira. Não remove publicações, consultas, tarefas, compromissos nem honorários: vínculos serão desvinculados. A exclusão não é desfeita por “Desarquivar”. Faça backup antes.</p><p class="muted compact">Vínculos preservados: ${impact.tasks} tarefa(s), ${impact.appointments} compromisso(s), ${impact.fees} honorário(s), ${impact.events} evento(s) e ${impact.jobs} consulta(s).</p>${blocked?`<p class="warning-note" role="alert">Exclusão bloqueada para não perder ${impact.attachments} anexo(s), ${impact.samples} comparação(ões) ou ${impact.manualChecks} conferência(s) manual(is). Remova anexos individualmente; para processos com conferências ou comparações, utilize Arquivar.</p>`:'<p class="warning-note">O título, observações e demais dados exclusivos da ficha serão excluídos. O histórico do serviço integrado será mantido.</p>'}<div class="form-actions"><button type="button" class="button ghost" data-action="close">Cancelar</button>${blocked?'':button('confirm-delete-selected','Confirmar exclusão','danger')}</div>`);
  }
  if(name==='confirm-delete-selected'){
    if(!pendingDeletion?.length)throw Error('Nenhum processo selecionado para exclusão.');
    const ids=pendingDeletion;
    await mutate(s=>deleteCases(s,ids));
    pendingDeletion=null;selected.clear();$('#editor').close();await refresh(true);
    if(integrated&&serviceOnline)await syncBrowser(state,true,state.cases.length===0);
    return toast(ids.length+' processo(s) removido(s) da carteira. Históricos vinculados preservados.');
  }
  if(name==='update-one'){$('#editor').close();return update([id]);}
  if(name==='backup'||name==='backup-readiness')return exportBackup();
  if(name==='template-csv'){downloadCsv(portfolioTemplateCsv(),'Painel-HB-modelo-carteira.csv');return toast('Modelo vazio gerado. Edite as colunas e mantenha o CNJ como texto.');}
  if(name==='export-portfolio')return exportPortfolioDialog();
  if(name==='download-sheet-report'){
    if(!pendingSheetPlan?.plan)throw Error('Prévia da importação não encontrada.');
    downloadCsv(exportImportReportCsv(pendingSheetPlan.plan),'Painel-HB-relatorio-importacao-'+dateKey()+'.csv');
    return toast('Relatório completo baixado. Contém dados da planilha e não tem senha.');
  }
  if(name==='confirm-export-portfolio'){downloadCsv(exportPortfolioCsv(state),'Painel-HB-carteira-'+dateKey()+'.csv');$('#editor').close();return toast('Carteira exportada. Este CSV não substitui o backup com senha.');}
  if(name==='audit-local'||name==='audit-readiness')return showLocalAudit();
  if(name==='source-diagnostics'||name==='source-readiness')return showSourceDiagnostics();
  if(name==='coverage-new')return coverageDialog();
  if(name==='auto-now'){
    if(!integrated||!serviceOnline)throw Error('Inicie o Painel H.B no modo integrado para consultar os tribunais.');
    const ids=state.cases.filter(c=>!c.archived&&c.cnj).map(c=>c.id);
    const result=await send('update',{ids});
    toast(result?.count?`${result.count} consulta(s) adicionada(s) à fila do serviço.`:'Não há novas consultas para adicionar.');
    return refresh(true);
  }
  if(name==='restore')return chooseBackup();
  if(name==='import-cnj')return importDialog();
  if(name==='import-spreadsheet')return spreadsheetFileDialog();
  if(name==='sheet-back'){if(!pendingSheetPlan)return spreadsheetFileDialog();return spreadsheetMappingDialog(pendingWorkbook.sheets.indexOf(pendingSheetPlan.sheet));}
  if(name==='confirm-import'){
    if(!pendingImport?.length)return;
    const numbers=pendingImport;await change(s=>{for(const n of numbers)if(!s.cases.some(c=>c.cnj===n))saveEntity(s,'cases',{cnj:n,title:'Processo '+formatCnj(n),stage:'todo'});},'Importação concluída.');pendingImport=null;$('#editor').close();return;
  }
  if(name==='archive'){await change(s=>{const c=s.cases.find(c=>c.id===id);if(c)c.archived=!c.archived;},'Arquivo atualizado.');selected.delete(id);if($('#editor').open)$('#editor').close();return;}
  if(name==='complete-task')return change(s=>{const t=s.tasks.find(t=>t.id===id);if(t)t.stage=t.stage==='done'?'todo':'done';},'Tarefa atualizada.');
  if(name==='seen'){await change(s=>{const e=s.events.find(e=>e.id===id);if(e)e.seen=!e.seen;});if($('#editor').open&&state.events.find(e=>e.id===id)?.caseId)fullDetail(state.events.find(e=>e.id===id).caseId);return;}
  if(name==='register-event'){const e=state.events.find(e=>e.id===id);if(!e||!validCnj(e.cnj))throw Error('Publicação sem CNJ válido.');const existing=state.cases.find(c=>c.cnj===e.cnj);return existing?fullDetail(existing.id):edit('cases','',{cnj:e.cnj,title:'Processo '+formatCnj(e.cnj)});}
  if(name==='reconcile-events'){let count=0;await change(s=>{count=reconcileEventLinks(s);});return toast(count?`${count} publicação(ões) e movimentação(ões) vinculadas ou corrigidas pelo CNJ.`:'Todos os vínculos por CNJ já estão atualizados.');}
  if(name==='oab'){const result=await send('oab');toast(result.count?'Busca de publicações adicionada à fila.':'Esta OAB já está na fila.');return refresh(true);}
  if(name==='resume'||name==='cancel'){await send(name);return refresh(true);}
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
  if(event.target.dataset.stage)change(s=>{const c=s.cases.find(c=>c.id===event.target.dataset.stage);if(c&&STAGES[event.target.value]){c.stage=event.target.value;c.updatedAt=now();}},'Etapa atualizada.').catch(e=>toast(e.message));
});
function updateTimeControls(form){
 const enabled=form.querySelector('[name=autoUpdateEnabled]').checked;
 const rows=[...form.querySelectorAll('[data-time-list] > div')];
 rows.forEach((row,i)=>{row.querySelector('label').firstChild.textContent='Horário '+(i+1);row.querySelector('button').setAttribute('aria-label','Remover horário '+(i+1));});
 const add=form.querySelector('[data-time-add]');add.disabled=rows.length>=6||!enabled;
 form.querySelector('[data-time-help]').textContent=rows.length>=6?'Limite de 6 horários atingido. Remova um horário para adicionar outro.':!enabled?'Ative para editar os horários. Os horários salvos serão preservados.':rows.length?'Horários repetidos serão reunidos e ordenados ao salvar.':'Adicione ao menos um horário antes de salvar a ativação.';
 for(const button of form.querySelectorAll('[data-time-remove]'))button.disabled=!enabled;
}
document.addEventListener('click',event=>{
  const t=event.target;
  const form=t.closest('#settings-form');
  if(form&&t.matches('[data-key-edit],[data-key-remove],[data-key-cancel]')){
    settingsDirty=true;
    const box=form.querySelector('[data-key-editor]'),input=box.querySelector('input');
    if(t.matches('[data-key-edit]')){box.hidden=false;input.disabled=false;input.value='';input.required=true;input.focus();}
    if(t.matches('[data-key-cancel]')){box.hidden=true;input.disabled=true;input.required=false;input.value='';}
    if(t.matches('[data-key-remove]')&&confirm('Remover a chave ao salvar configurações? Consultas ao DataJud ficarão indisponíveis até configurar outra chave.')){box.hidden=false;input.disabled=false;input.required=false;input.value='';input.placeholder='Remoção pendente. Salve as configurações ou cancele.';}
    updateSettingsDirty();
  }
  const auto=t.closest('#auto-form');if(!auto)return;settingsDirty=true;
  if(t.matches('[data-time-add]')){
    const list=auto.querySelector('[data-time-list]');if(list.children.length>=6){toast('Você pode configurar até 6 horários.');return;}
    const enabled=auto.querySelector('[name=autoUpdateEnabled]').checked;
    list.insertAdjacentHTML('beforeend',scheduleRow('',list.children.length+1,enabled));
    const input=list.lastElementChild.querySelector('input');if(enabled)input.focus();
    updateTimeControls(auto);
  }
  if(t.matches('[data-time-remove]')){t.parentElement.remove();updateTimeControls(auto);auto.querySelector('[data-time-add]').focus();}
  updateSettingsDirty();
});
document.addEventListener('change',event=>{
 if(event.target.name==='autoUpdateEnabled'){const f=event.target.form;for(const x of f.querySelectorAll('[name=autoTime]')){x.required=event.target.checked;x.disabled=!event.target.checked;}updateTimeControls(f);updateSettingsDirty();}
});
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
