import {formatCnj} from './core.js';
import {escapeHTML as esc} from './html-utils.js';
import {safePublicationUrl,publicationDateBR} from './publication-pdf.js';
import {fold} from './text-utils.js';

export const notificationKey=e=>JSON.stringify([e.source,String(e.cnj||'').replace(/\D/g,''),e.id]);
export const notificationSource=s=>({djen:'DJEN',datajud:'DataJud',esaj_pg:'TJSP e-SAJ · 1º grau',esaj_sg:'TJSP e-SAJ · 2º grau'})[s]||s||'Fonte não informada';
const time=v=>Number.isFinite(Date.parse(v))?Date.parse(v):0;
const eventDay=value=>{const day=publicationDateBR(value);return /^\d\d\/\d\d\/\d{4}$/.test(day)?day.split('/').reverse().join('-'):'';};

export function notificationRows(state,serviceEvents=[]){
  const rows=new Map(),cases=state?.cases||[];
  const byId=new Map(cases.map(c=>[c.id,c])),byCnj=new Map();
  for(const c of cases)if(c.cnj&&!byCnj.has(c.cnj))byCnj.set(c.cnj,c);
  const append=(raw,remote)=>{
    if(!raw||!['publication','movement'].includes(raw.kind))return;
    const e={...raw,remote,date:raw.date||raw.occurred_at,discoveredAt:raw.discoveredAt||raw.first_seen,
      caseId:raw.caseId||raw.case_id||'',seen:!!raw.seen,localIds:[],serviceRefs:[]};
    const linked=byId.get(e.caseId),c=linked&&(!e.cnj||linked.cnj===e.cnj)?linked:byCnj.get(e.cnj);
    e.caseId=c?.id||'';e.title=c?.title||'Processo não vinculado';
    e.court=c?.court||'';e.tribunal=raw.tribunal||({tjrj:'TJRJ',tjsp:'TJSP',trf2:'TRF2',stj:'STJ',stf:'STF',other:'Outro tribunal'})[e.court]||e.court||'';
    e.key=notificationKey(e);
    const old=rows.get(e.key);
    if(remote)e.serviceRefs=[{caseId:raw.case_id||'',source:e.source,eventId:e.id,cnj:e.cnj}];else e.localIds=[e.id];
    if(old){
      const latest=time(e.last_seen||e.discoveredAt)>time(old.last_seen||old.discoveredAt)?e:old;
      rows.set(e.key,{...latest,remote:old.remote||remote,seen:old.seen&&e.seen,
        localIds:[...old.localIds,...e.localIds],serviceRefs:[...old.serviceRefs,...e.serviceRefs],
        text:old.remote&&!remote?old.text:e.text});
    }else rows.set(e.key,e);
  };
  for(const e of state?.events||[])append(e,false);
  for(const e of serviceEvents)append(e,true);
  return [...rows.values()].sort((a,b)=>time(b.last_seen||b.discoveredAt)-time(a.last_seen||a.discoveredAt)||a.key.localeCompare(b.key));
}

export function selectNotifications(rows,filters={},page=1,pageSize=20){
  const q=fold(filters.search).trim(),cnjQuery=String(filters.search||'').replace(/\D/g,'');
  const selected=rows.filter(e=>
    (filters.status!=='unseen'||!e.seen)&&(filters.status!=='seen'||e.seen)&&
    (!filters.source||e.source===filters.source)&&(!filters.kind||e.kind===filters.kind)&&
    (!filters.court||e.tribunal===filters.court)&&(!filters.caseId||e.caseId===filters.caseId)&&
    (!filters.from||eventDay(e.date)>=filters.from)&&
    (!filters.to||eventDay(e.date)<=filters.to)&&
    (!q||fold([e.title,e.cnj,e.text,e.tribunal,notificationSource(e.source)].join(' ')).includes(q)||
      cnjQuery.length>=7&&String(e.cnj||'').includes(cnjQuery)));
  const pages=Math.max(1,Math.ceil(selected.length/pageSize));page=Math.max(1,Math.min(page,pages));
  return {rows:selected.slice((page-1)*pageSize,page*pageSize),total:selected.length,page,pages,
    counts:{all:rows.length,unseen:rows.filter(e=>!e.seen).length,seen:rows.filter(e=>e.seen).length}};
}

export class NotificationCenter{
  constructor(options){Object.assign(this,options);this.events=[];this.filters={status:'unseen'};this.page=1;this.loaded=false;this.error='';this.lastFetch=0;this.busy=false;this.loading=false;this.details=new Map();this.writeEpoch=0;}
  rows(){return notificationRows(this.getState(),this.events);}
  mount(){this.paint();void this.refresh();}
  badge(){
    const total=this.rows().filter(e=>!e.seen).length;
    document.querySelectorAll('[data-notification-count]').forEach(x=>{x.textContent=String(total);x.hidden=!total;x.setAttribute('aria-label',total+' não conferidas');});
    document.querySelectorAll('[data-notification-metric]').forEach(x=>x.textContent=String(total));
  }
  async refresh(force=false){
    this.badge();
    if(!this.isIntegrated()){this.loaded=true;this.paint();return;}
    if(this.loading||this.busy||!force&&Date.now()-this.lastFetch<10000)return;
    this.loading=true;if(!this.loaded)this.paint();
    const epoch=this.writeEpoch;
    try{
      const result=await this.apiGet('notifications');
      if(epoch===this.writeEpoch){this.events=result.events;this.loaded=true;this.error='';this.lastFetch=Date.now();}
    }catch(e){this.error=e.message||'Não foi possível carregar as notificações.';}
    finally{this.loading=false;this.badge();this.paint();}
  }
  paint(){
    const root=document.getElementById('notification-center');if(!root)return;
    const all=this.rows(),view=selectNotifications(all,this.filters,this.page);this.page=view.page;
    const focus=root.contains(document.activeElement)?document.activeElement:null;
    const filter=focus?.dataset.notificationFilter,start=focus?.selectionStart;
    const focusAction=focus?.dataset.notificationAction,focusKey=focus?.dataset.key,focusStatus=focus?.dataset.notificationStatus;
    const open=new Set([...root.querySelectorAll('details[open]')].map(x=>x.dataset.key));
    const options=(values,current,label)=>`<option value="">${label}</option>`+values.map(([v,t])=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(t)}</option>`).join('');
    const sources=[...new Set(all.map(e=>e.source))].sort().map(s=>[s,notificationSource(s)]);
    const courts=[...new Set(all.map(e=>e.tribunal).filter(Boolean))].sort().map(s=>[s,s]);
    const cases=[...new Map(all.filter(e=>e.caseId).map(e=>[e.caseId,[e.caseId,e.title]])).values()];
    const controls=`<div class="notification-toolbar"><div class="notification-tabs" role="group" aria-label="Estado das notificações">${[['unseen','Não conferidas'],['all','Todas'],['seen','Conferidas']].map(([s,t])=>`<button type="button" data-notification-status="${s}" class="notification-tab ${this.filters.status===s?'active':''}" aria-pressed="${this.filters.status===s}">${t}<span>${view.counts[s]}</span></button>`).join('')}</div><button type="button" class="button secondary" data-notification-action="refresh" ${this.loading?'disabled':''}>${this.loading?'Atualizando…':'Atualizar lista'}</button></div>
      <form class="notification-filters" aria-label="Filtros de notificações"><label class="field notification-search">Buscar<input type="search" data-notification-filter="search" value="${esc(this.filters.search||'')}" placeholder="Processo, número CNJ ou resumo"></label>
      <label class="field">Tipo<select data-notification-filter="kind">${options([['movement','Movimentações'],['publication','Publicações']],this.filters.kind,'Todos os tipos')}</select></label>
      <label class="field">Fonte<select data-notification-filter="source">${options(sources,this.filters.source,'Todas as fontes')}</select></label>
      <div class="notification-advanced-group ${this.moreFilters?'expanded':''}"><button type="button" class="button ghost notification-more-filters" data-notification-action="filters" aria-expanded="${!!this.moreFilters}" aria-controls="notification-advanced-fields">${this.moreFilters?'Recolher filtros':'Mais filtros'}${['court','caseId','from','to'].some(k=>this.filters[k])?' · ativos':''}</button><div class="notification-advanced-fields" id="notification-advanced-fields">
      <label class="field">Tribunal<select data-notification-filter="court">${options(courts,this.filters.court,'Todos os tribunais')}</select></label>
      <label class="field notification-case-filter">Processo<select data-notification-filter="caseId">${options(cases,this.filters.caseId,'Todos os processos')}</select></label>
      <label class="field">Data do evento · de<input type="date" data-notification-filter="from" value="${esc(this.filters.from||'')}"></label>
      <label class="field">Até<input type="date" data-notification-filter="to" value="${esc(this.filters.to||'')}"></label>
      </div></div>
      <button type="button" class="button ghost" data-notification-action="clear">Limpar filtros</button></form>`;
    const status=this.error?`<div class="notification-error" role="alert"><strong>Não foi possível atualizar a lista.</strong><p>${esc(this.error)} ${this.loaded?'Os últimos registros carregados continuam abaixo.':'A lista pode estar incompleta até a conexão voltar.'}</p><button class="button secondary small" data-notification-action="refresh">Tentar novamente</button></div>`:
      !this.loaded&&this.isIntegrated()?'<p class="notification-loading" role="status">Carregando notificações do monitoramento…</p>':'';
    const records=view.rows.map(e=>{
      const url=safePublicationUrl(e.url),key=esc(e.key),type=e.kind==='publication'?'Publicação':'Movimentação';
      const fullText=this.details.get(e.key+'|'+(e.last_seen||e.discoveredAt));
      return `<article class="notification-record ${e.seen?'is-seen':'is-unseen'}" data-notification-key="${key}"><span class="notification-dot" aria-hidden="true"></span><div class="notification-record-main"><div class="notification-record-meta"><span class="notification-type">${type}</span><span>${esc(notificationSource(e.source))}</span><span class="notification-state">${e.seen?'Conferida':'Não conferida'}</span><time>${publicationDateBR(e.date)}</time></div><h3 class="private">${esc(e.title)}</h3><p class="notification-process private">${esc(formatCnj(e.cnj)||'CNJ não informado')}${e.tribunal?' · '+esc(e.tribunal):''}</p><p class="notification-preview private">${esc(e.text||'Descrição não informada.')}</p><details data-key="${key}" ${open.has(e.key)?'open':''}><summary>Ver conteúdo e origem</summary><div class="notification-detail private"><p>${esc(fullText||e.text||'Descrição não informada.')}</p>${e.remote&&!fullText?`<button class="button ghost small" data-notification-action="detail" data-key="${key}">Carregar conteúdo completo</button>`:''}<small>Identificada em ${esc(this.stamp(e.last_seen||e.discoveredAt))}. ${e.remote?'Monitoramento do serviço.':'Histórico da carteira.'}</small></div></details><div class="notification-record-actions">${e.caseId?`<button class="button secondary small" data-notification-action="case" data-key="${key}">Abrir processo</button>`:'<span class="muted compact">Sem processo vinculado à carteira</span>'}${url?`<a class="button ghost small" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir na fonte</a>`:''}<button class="button ${e.seen?'ghost':'primary'} small" data-notification-action="seen" data-key="${key}" ${this.busy?'disabled':''}>${e.seen?'Desmarcar conferência':'Marcar como conferida'}</button></div></div></article>`;
    }).join('');
    const empty=!this.loaded&&this.isIntegrated()?'':`<div class="notification-empty"><h3>${all.length?'Nenhuma notificação nesta seleção':'Suas novidades aparecerão aqui'}</h3><p>${all.length?'Altere os filtros ou consulte Todas para rever o histórico.':'Quando uma consulta detectar uma movimentação ou publicação nova, ela será reunida nesta central. O histórico da primeira consulta forma a referência inicial.'}</p>${all.length?'<button class="button secondary" data-notification-action="clear">Ver todas as notificações</button>':'<a class="button secondary" href="#sources">Configurar monitoramento</a>'}</div>`;
    root.innerHTML=`<section class="panel notification-panel" aria-label="Central de notificações"><div class="notification-heading"><div><h2>Atualizações dos processos</h2><p>Movimentações e publicações reunidas para sua conferência.</p></div><span class="notification-total">${view.counts.unseen} por conferir</span></div>${controls}${status}<div class="notification-results-heading"><p role="status" aria-live="polite">${view.total} ${view.total===1?'notificação encontrada':'notificações encontradas'}</p><button class="button ghost small" data-notification-action="seen-page" ${this.busy||!view.rows.some(e=>!e.seen)?'disabled':''}>Conferir não lidas desta página</button></div><div class="notification-list">${records||empty}</div>${view.total?`<div class="notification-pagination"><p>Exibindo ${(view.page-1)*20+1}–${Math.min(view.page*20,view.total)} de ${view.total}</p><div><button class="button ghost small" data-notification-action="prev" ${view.page<=1?'disabled':''}>Anterior</button><span>Página ${view.page} de ${view.pages}</span><button class="button secondary small" data-notification-action="next" ${view.page>=view.pages?'disabled':''}>Próxima</button></div></div>`:''}<p class="notification-footnote">Conferência é um controle interno, sem efeito de ciência de intimação. Novidades dependem das consultas e da disponibilidade das fontes.</p></section>`;
    root.querySelector('form')?.addEventListener('submit',e=>e.preventDefault());
    root.querySelectorAll('[data-notification-filter]').forEach(x=>x.addEventListener(x.tagName==='INPUT'&&x.type==='search'?'input':'change',()=>{this.filters[x.dataset.notificationFilter]=x.value;this.page=1;this.paint();}));
    root.querySelectorAll('[data-notification-status]').forEach(x=>x.addEventListener('click',()=>{this.filters.status=x.dataset.notificationStatus;this.page=1;this.paint();root.querySelector(`[data-notification-status="${this.filters.status}"]`)?.focus();}));
    root.querySelectorAll('[data-notification-action]').forEach(x=>x.addEventListener('click',()=>this.action(x).catch(e=>this.toast(e.message))));
    if(filter){const target=root.querySelector(`[data-notification-filter="${filter}"]`);target?.focus();try{target?.setSelectionRange(start,start);}catch{}}
    else if(focusAction){
      const same=[...root.querySelectorAll('[data-notification-action]')].find(x=>x.dataset.notificationAction===focusAction&&x.dataset.key===focusKey&&!x.disabled);
      (same||root.querySelector('.notification-tab.active'))?.focus({preventScroll:true});
    }else if(focusStatus)root.querySelector('.notification-tab.active')?.focus({preventScroll:true});
  }
  stamp(value){const d=new Date(value);return Number.isFinite(d.valueOf())?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(d):'Data não informada';}
  async action(button){
    const action=button.dataset.notificationAction,e=this.rows().find(e=>e.key===button.dataset.key);
    if(action==='refresh')return this.refresh(true);
    if(action==='filters'){this.moreFilters=!this.moreFilters;this.paint();return;}
    if(action==='clear'){this.filters={status:'all'};this.page=1;this.paint();return;}
    if(action==='prev'||action==='next'){this.page+=action==='next'?1:-1;this.paint();document.getElementById('notification-center')?.scrollIntoView({block:'start'});return;}
    if(action==='case'&&e)return this.openCase(e.caseId);
    if(action==='detail'&&e){
      button.disabled=true;button.textContent='Carregando…';
      try{const result=await this.apiPost('notifications/detail',{source:e.source,id:e.id,cnj:e.cnj});
        this.details.set(e.key+'|'+(e.last_seen||e.discoveredAt),result.event.text);
        const p=button.parentElement.querySelector('p');if(p)p.textContent=result.event.text;button.remove();
      }catch(err){button.disabled=false;button.textContent='Tentar carregar novamente';throw err;}return;
    }
    if(action==='seen'||action==='seen-page'){
      if(this.busy)return;
      const targets=action==='seen-page'?selectNotifications(this.rows(),this.filters,this.page).rows.filter(e=>!e.seen):e?[e]:[];
      if(!targets.length)return;const seen=action==='seen-page'||!e.seen;
      this.busy=true;this.writeEpoch++;this.lastFetch=0;button.disabled=true;
      try{
        const remote=targets.filter(e=>e.remote);
        if(remote.length)await this.apiPost('notifications/seen',{events:remote.map(({id,source,cnj})=>({id,source,cnj})),seen});
        const keys=new Set(targets.map(e=>e.key));
        if(targets.some(e=>e.localIds.length))await this.markLocal(keys,seen);
        this.events=this.events.map(raw=>keys.has(notificationKey(raw))?{...raw,seen:Number(seen),is_new:Number(!seen)}:raw);
        this.toast(targets.length===1?(seen?'Notificação marcada como conferida.':'Conferência desmarcada.'):targets.length+' notificações marcadas como conferidas.');
      }finally{this.busy=false;this.badge();this.paint();}
    }
  }
}
