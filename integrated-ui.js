import {organizePanel} from './panel-organization.js';
import {integrated, serviceOnline, serviceError, serviceDashboard, serviceSettings,
  serviceConnectors, serviceSyncWarning, apiGet, apiPost, pollService, updateExtraConnectors} from './integrated.js';
import {integratedCaseHTML} from './integrated-case-view.js';
import {djenNameSearchHTML,installDjenNameSearch} from './djen-name-search.js';
import {SERVICE_JOB_FILTERS,selectServiceJobs,serviceJobRowsHTML} from './service-job-history.js';

const clean = value => String(value ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const stamp = value => {
  if (!value) return 'Não informado';
  const time = new Date(value);
  return Number.isNaN(time.valueOf()) ? clean(value) :
    new Intl.DateTimeFormat('pt-BR', {dateStyle:'short', timeStyle:'short',
      timeZone:'America/Sao_Paulo'}).format(time);
};
const labels = {queued:'Na fila',running:'Consultando',success:'Concluído',
  partial:'Parcial',not_found:'Não localizado',auth_required:'Autenticação necessária',
  access_denied:'Acesso negado',unavailable:'Indisponível',unsupported:'Não suportado',
  incompatible:'Resposta incompatível',cancelled:'Cancelado'};
const source = key => ({datajud:'DataJud',djen:'DJEN',esaj_pg:'TJSP e-SAJ · 1º grau',
  esaj_sg:'TJSP e-SAJ · 2º grau'})[key] || key;
let currentCase = '';
let caseDetailInfo=null,caseHistoryPages={};
let serviceJobFilter='all',serviceJobSearch='',serviceJobPage=1;
const setText=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};

function refreshServiceJobHistory(force=false){
  const host=document.getElementById('integrated-service-jobs');
  if(!host)return;
  if(!host.querySelector('#service-jobs-search')){
    host.innerHTML=`<div class="service-jobs-heading"><div><h3 id="service-jobs-title">Consultas recentes do serviço</h3>
      <p class="muted compact">Últimas consultas recebidas do serviço local. O histórico completo permanece no SQLite e no backup.</p></div>
      <span class="service-jobs-total" id="service-jobs-total"></span></div>
      <div class="service-jobs-controls"><div class="service-jobs-filters" role="group" aria-label="Filtrar consultas por situação">
      ${Object.entries(SERVICE_JOB_FILTERS).map(([key,label])=>`<button type="button" class="service-jobs-filter" data-integrated="jobs-filter" data-value="${key}" aria-pressed="false">${label} <span data-jobs-count="${key}">0</span></button>`).join('')}
      </div><label class="service-jobs-search">Buscar nas consultas
      <input type="search" id="service-jobs-search" autocomplete="off" placeholder="CNJ, OAB, fonte ou mensagem" aria-label="Buscar nas consultas recentes do serviço"></label></div>
      <div id="service-jobs-rows"></div>
      <div class="service-jobs-footer"><p id="service-jobs-progress" role="status" aria-live="polite" aria-atomic="true"></p>
      <div class="service-jobs-pager"><button type="button" class="button ghost small" data-integrated="jobs-prev">Anterior</button>
      <span id="service-jobs-page" aria-label="Página atual"></span>
      <button type="button" class="button secondary small" data-integrated="jobs-next">Próxima</button></div></div>`;
  }
  const model=selectServiceJobs(serviceDashboard.jobs,{filter:serviceJobFilter,query:serviceJobSearch,page:serviceJobPage});
  serviceJobPage=model.page;
  for(const key of Object.keys(SERVICE_JOB_FILTERS)){
    const button=host.querySelector(`[data-integrated="jobs-filter"][data-value="${key}"]`);
    button.classList.toggle('active',serviceJobFilter===key);
    button.setAttribute('aria-pressed',String(serviceJobFilter===key));
    setText(button.querySelector('[data-jobs-count]'),String(model.counts[key]));
  }
  const input=host.querySelector('#service-jobs-search');
  if(document.activeElement!==input&&input.value!==serviceJobSearch)input.value=serviceJobSearch;
  setText(host.querySelector('#service-jobs-total'),`${model.counts.all} registro(s)`);
  const list=host.querySelector('#service-jobs-rows'),markup=serviceJobRowsHTML(model.rows,stamp);
  if((force||!list.contains(document.activeElement))&&list._lastMarkup!==markup){
    list.innerHTML=markup;
    list._lastMarkup=markup;
  }
  setText(host.querySelector('#service-jobs-progress'),model.total
    ?`Exibindo ${model.first} a ${model.last} de ${model.total} nesta seleção (até 100 consultas recentes).`
    :'Nenhuma consulta encontrada nesta seleção.');
  setText(host.querySelector('#service-jobs-page'),`${model.page} de ${model.totalPages}`);
  host.querySelector('[data-integrated="jobs-prev"]').disabled=model.page<=1;
  host.querySelector('[data-integrated="jobs-next"]').disabled=model.page>=model.totalPages;
}

export function decorateIntegrated(route, state) {
  let banner = document.getElementById('service-status');
  if (!banner) {
    banner = document.createElement('section');
    banner.id = 'service-status';
    banner.setAttribute('aria-live','polite');
    const point = document.getElementById('job-progress');
    point.parentNode.insertBefore(banner, point);
  }
  if (!integrated) {
    document.getElementById('job-progress').innerHTML = '';
    banner.innerHTML = '<p class="compact muted">Modo HTML direto · seus registros locais estão disponíveis. '+
      'Consultas judiciais indisponíveis sem o serviço Python. Abra <strong>ABRIR-PAINEL-INTEGRADO.cmd</strong> '+
      'para atualizar processos. Consultas antigas pendentes não serão executadas neste modo.</p>';
    return;
  }
  const bannerHTML = serviceOnline
    ? '<p class="compact muted">Serviço Python local conectado · acompanhamento persiste com a aba fechada '+
      '(enquanto o serviço e o computador permanecerem ativos).</p>'+
      (serviceSyncWarning?'<p class="warning-note">'+clean(serviceSyncWarning)+'</p>':'')
    : '<p class="warning-note">Serviço desconectado: '+clean(serviceError)+
      '. Os cadastros e anexos deste navegador permanecem disponíveis. Reinicie pelo iniciador integrado.</p>';
  if(banner._lastMarkup!==bannerHTML){banner.innerHTML=bannerHTML;banner._lastMarkup=bannerHTML;}
  const old = document.getElementById('job-progress');
  if (old) {
    const waiting = (serviceDashboard.jobs || []).filter(x => ['queued','running'].includes(x.status));
    const waitingHTML = waiting.length
      ? '<div class="job-banner" '+(waiting.some(x=>x.status==='running')?'data-loading="true" data-loading-fixed aria-busy="true"':'')+'><p><strong>'+waiting.length+' consulta(s) na fila ou em andamento</strong> '+
        'Você pode fechar a aba; o serviço continua enquanto estiver ligado.</p>'+
        '<button class="button secondary small" data-integrated="cancel">Cancelar consultas</button></div>'
      : '';
    if(old._lastMarkup!==waitingHTML){old.innerHTML=waitingHTML;old._lastMarkup=waitingHTML;}
  }
  if (route === 'sources') {
    const container = document.getElementById('content');
    if (!container) return;
    const scheduler = document.querySelector('#auto-form');
    if(scheduler){
      const connection=scheduler.querySelector('[data-schedule-connection]');
      if(connection){connection.textContent=serviceOnline?'Serviço conectado':'Serviço desconectado';connection.className='schedule-state'+(serviceOnline?'':' warning');}
    }
    if (scheduler && serviceSettings) {
      const hint = scheduler.querySelector('[data-schedule-status]');
      if (hint) hint.textContent = serviceSettings.autoEnabled
        ? 'Última janela processada pelo serviço: '+(serviceSettings.autoLast||'ainda nenhuma')+
          ' · horários: '+serviceSettings.autoTimes.join(', ')+
          ' · fuso America/Sao_Paulo. O serviço precisa estar em execução.'
        : 'Agendamento no serviço desativado. As consultas manuais continuam disponíveis.';
    }
    let panel = document.getElementById('integrated-source-panel');
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'panel';
      panel.id = 'integrated-source-panel';
      container.insertBefore(panel, container.firstChild);
    }
    if(!panel.querySelector('#integrated-source-summary')){
      panel.innerHTML='<div id="integrated-source-summary"></div><section id="integrated-service-jobs" aria-labelledby="service-jobs-title"></section>';
    }
    const summary=panel.querySelector('#integrated-source-summary');
    const choices = serviceConnectors.filter(x => x.id.startsWith('esaj_')).map(item => {
      const enabled = !!serviceSettings?.enabled?.[item.id];
      return '<label class="check-field"><input type="checkbox" name="'+clean(item.id)+'" '+
        (enabled?'checked ':'')+(item.enabled?'':'disabled ')+'> '+clean(item.label)+
        (item.enabled?'':' (instalação opcional necessária)')+'</label>';
    }).join('');
    const summaryHtml =
      '<h2>Monitoramento pelo serviço Python</h2>'+
      '<p class="muted compact">No modo integrado, cadastros e anexos ficam no banco local, junto com '+ 
      'consultas, tramitações, eventos e fila no SQLite local. Sem sincronização na nuvem.</p>'+
      (serviceOnline ? '<p class="compact">Conectado · '+(serviceDashboard.unseen||0)+' novidade(s) para conferir.</p>'+
       '<form id="integrated-connectors-form"><h3>Fontes complementares</h3>'+choices+
       '<p class="muted compact">DataJud e DJEN são configurados nos cartões de fontes. O e-SAJ consulta somente processos TJSP e pode depender da disponibilidade do portal.</p><button class="button secondary" type="submit">Salvar conectores e-SAJ</button></form>'+
       '<details class="source-card"><summary>Como acessar o Jus.br/PDPJ</summary><p>Esta versão do Painel H.B não possui login integrado com o Jus.br/PDPJ. O acesso é feito no portal oficial.</p><ol><li>Abra o Portal Jus.br e escolha Entrar.</li><li>Para advogados, consulte as opções de gov.br (nível Ouro) ou certificado digital.</li><li>Conclua a verificação adicional solicitada pelo portal. Em caso de dificuldade, use o suporte do CNJ.</li></ol><p>Entrar no portal não conecta automaticamente o Jus.br ao painel.</p><div class="links"><a class="button secondary small" href="https://www.jus.br/" target="_blank" rel="noopener noreferrer">Abrir Jus.br ↗</a><a href="https://www.cnj.jus.br/tecnologia-da-informacao-e-comunicacao/justica-4-0/jus-br/perguntas-frequentes/" target="_blank" rel="noopener noreferrer">Instruções oficiais do CNJ</a><a href="https://suporteti.cnj.jus.br/" target="_blank" rel="noopener noreferrer">Suporte do CNJ</a></div></details>'
       : '<p class="warning-note">Sem conexão com o serviço local.</p>');
    // O polling não deve apagar checkboxes em edição nem o foco do usuário.
    if(!summary.contains(document.activeElement)&&summary._lastMarkup!==summaryHtml){
      summary.innerHTML=summaryHtml;summary._lastMarkup=summaryHtml;
    }
    refreshServiceJobHistory();
  }
  if (route === 'publications' && serviceOnline) {
    void loadIntegratedPublications();
  }
  organizePanel(route);
}

function loadIntegratedPublications(){
  const container=document.getElementById('content');
  if(!container||!serviceOnline||document.getElementById('djen-name-search-panel'))return;
  const search=document.createElement('section');search.id='djen-name-search-panel';search.className='panel';
  search.innerHTML=djenNameSearchHTML();container.insertBefore(search,container.firstChild);
}

export async function loadIntegratedCase(caseId, background=false) {
  if (!integrated || !serviceOnline) return;
  if(currentCase!==caseId){caseHistoryPages={};caseDetailInfo=null;}
  currentCase = caseId;
  const body = document.getElementById('dialog-body');
  if (!body) return;
  let element = body.querySelector('#integrated-case-detail');
  if (background && (!element || element.dataset.caseId !== caseId)) return;
  if (!background) {element?.remove();element=null;}
  element ||= document.createElement('section');
  element.dataset.caseId = caseId;
  element.className = 'detail-section';
  element.id = 'integrated-case-detail';
  if (!background) {
    element.innerHTML = '<h3>Acompanhamento integrado</h3><p>Consultando o histórico salvo no serviço...</p>';
    body.appendChild(element);
  }
  try {
    const info = await apiGet('processes/'+encodeURIComponent(caseId));
    if (currentCase !== caseId || !element.isConnected) return;
    caseDetailInfo=info;
    const html=integratedCaseHTML(info,caseId,caseHistoryPages);
    if (element._lastHTML !== html) {
      const openEventKeys=new Set([...element.querySelectorAll('.integrated-event:has(details[open])')]
        .map(x=>x.dataset.eventSource+'\u0000'+x.dataset.eventId));
      const technicalOpen=!!element.querySelector('.integrated-technical[open]');
      element.innerHTML=html;element._lastHTML=html;
      element.querySelectorAll('.integrated-event').forEach(x=>{
        x.querySelector('details').open=openEventKeys.has(x.dataset.eventSource+'\u0000'+x.dataset.eventId);
      });
      const technical=element.querySelector('.integrated-technical');
      if(technical)technical.open=technicalOpen;
    }
  } catch (error) {
    if (!background && element.isConnected) element.innerHTML='<h3>Acompanhamento integrado</h3><p class="warning-note">'+
      clean(error.message)+'</p>';
  }
}

let refreshingCase=false;
export async function refreshIntegratedCase(){
  if(refreshingCase || !document.getElementById('editor')?.open || !currentCase)return;
  refreshingCase=true;
  try{await loadIntegratedCase(currentCase,true);}finally{refreshingCase=false;}
}

export function installIntegratedActions({update, toast}) {
  installDjenNameSearch(apiPost);
  document.addEventListener('input',event=>{
    if(event.target.id!=='service-jobs-search')return;
    serviceJobSearch=event.target.value.slice(0,180);
    serviceJobPage=1;
    refreshServiceJobHistory();
  });
  document.addEventListener('click', async event => {
    const target = event.target.closest('[data-integrated]');
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      if(target.dataset.integrated==='events-page'){
        const key=target.dataset.key,next=Number(target.dataset.page);
        if(!/^(?:datajud|djen|other)-(?:news|history)$/.test(key)||!Number.isSafeInteger(next)||!caseDetailInfo)return;
        caseHistoryPages[key]=Math.max(1,next);
        const panel=document.getElementById('integrated-case-detail');
        if(!panel||panel.dataset.caseId!==currentCase)return;
        const openEventKeys=new Set([...panel.querySelectorAll('.integrated-event:has(details[open])')]
          .map(x=>x.dataset.eventSource+'\u0000'+x.dataset.eventId));
        const technicalOpen=!!panel.querySelector('.integrated-technical[open]');
        const html=integratedCaseHTML(caseDetailInfo,currentCase,caseHistoryPages);
        panel.innerHTML=html;panel._lastHTML=html;
        panel.querySelectorAll('.integrated-event').forEach(x=>{
          x.querySelector('details').open=openEventKeys.has(x.dataset.eventSource+'\u0000'+x.dataset.eventId);
        });
        const technical=panel.querySelector('.integrated-technical');
        if(technical)technical.open=technicalOpen;
        const direction=target.textContent.trim();
        const controls=[...panel.querySelectorAll(`[data-integrated="events-page"][data-key="${key}"]:not([disabled])`)];
        (controls.find(button=>button.textContent.trim()===direction)||controls[0])?.focus();
        return;
      }
      if(target.dataset.integrated==='jobs-filter'){
        if(Object.hasOwn(SERVICE_JOB_FILTERS,target.dataset.value)){
          serviceJobFilter=target.dataset.value;serviceJobPage=1;refreshServiceJobHistory();
        }
        return;
      }
      if(target.dataset.integrated==='jobs-prev'||target.dataset.integrated==='jobs-next'){
        serviceJobPage+=target.dataset.integrated==='jobs-next'?1:-1;
        refreshServiceJobHistory();return;
      }
      if (target.dataset.integrated === 'update') await update([target.dataset.id]);
      if (target.dataset.integrated === 'update-djen') {
        await update([target.dataset.id],['djen']);
        await loadIntegratedCase(target.dataset.id,true);
      }
      if (target.dataset.integrated === 'update-datajud') {
        await update([target.dataset.id],['datajud']);
        await loadIntegratedCase(target.dataset.id,true);
      }
      if (target.dataset.integrated === 'detail') {
        const id = target.dataset.id;
        document.getElementById('editor')?.showModal?.();
        document.getElementById('editor')?.classList.add('case-dialog');
        document.getElementById('dialog-title').textContent = 'Acompanhamento · '+id;
        document.getElementById('dialog-body').innerHTML = '';
        await loadIntegratedCase(id);
      }
      if (target.dataset.integrated === 'cancel') {
        const result = await apiPost('jobs/cancel');
        toast(result.count+' consulta(s) cancelada(s).');
      }
      if (target.dataset.integrated === 'seen') {
        await apiPost('events/seen', {caseId:target.dataset.caseId,source:target.dataset.source,
                                     eventId:target.dataset.id});
        if (target.dataset.caseId) {
          await loadIntegratedCase(target.dataset.caseId);
        }
      }
      await pollService();
      decorateIntegrated(location.hash.replace('#','')||'home', {});
    } catch (error) {toast(error.message);}
  }, true);
  document.addEventListener('submit', async event => {
    const form = event.target;
    if (form.id !== 'integrated-connectors-form') return;
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    try {
      await updateExtraConnectors({esaj_pg:!!data.esaj_pg,esaj_sg:!!data.esaj_sg});
      toast('Fontes complementares atualizadas.');
      await pollService();
    } catch (error) {toast(error.message);}
  });
}
