// Apresentação SOMENTE LEITURA do histórico do serviço Python. A identificação,
// vinculação e deduplicação de eventos permanecem sob responsabilidade do SQLite.
import {escapeHTML} from './html-utils.js';
import {publicationDetailsHTML} from './publication-details.js';
import {djenCertificateUrl,safePublicationUrl} from './publication-pdf.js';

const ZONE = 'America/Sao_Paulo';
const dateWithZone = new Intl.DateTimeFormat('pt-BR', {
  timeZone: ZONE, day:'2-digit',month:'2-digit',year:'numeric',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23'
});

// DataJud pode enviar dataHora sem offset, enquanto o serviço usa UTC com Z.
// Sem offset, não converter: não existe informação para inferir um fuso seguro.
export function caseMoment(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw=value.trim();
  const dateOnly=/^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const withoutZone=/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(raw);
  if(dateOnly || withoutZone){
    const parts=dateOnly||withoutZone;
    const year=Number(parts[1]),month=Number(parts[2]),day=Number(parts[3]);
    const valid=new Date(Date.UTC(year,month-1,day));
    if(year<1000||valid.getUTCFullYear()!==year||valid.getUTCMonth()!==month-1||valid.getUTCDate()!==day)return null;
    if(dateOnly)return {text:`${parts[3]}/${parts[2]}/${parts[1]}`,datetime:raw,kind:'date'};
    const hour=Number(parts[4]),minute=Number(parts[5]),second=Number(parts[6]||0);
    if(hour>23||minute>59||second>59)return null;
    return {text:`${parts[3]}/${parts[2]}/${parts[1]} às ${parts[4]}:${parts[5]}`,
      datetime:raw,kind:'no-zone'};
  }
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)$/i.test(raw))return null;
  const calendar=raw.slice(0,10).split('-').map(Number);
  const check=new Date(Date.UTC(calendar[0],calendar[1]-1,calendar[2]));
  if(calendar[0]<1000||check.getUTCFullYear()!==calendar[0]||
     check.getUTCMonth()!==calendar[1]-1||check.getUTCDate()!==calendar[2])return null;
  const parsed=new Date(raw);
  if(Number.isNaN(parsed.valueOf()))return null;
  const fields=Object.fromEntries(dateWithZone.formatToParts(parsed).map(({type,value})=>[type,value]));
  return {text:`${fields.day}/${fields.month}/${fields.year} às ${fields.hour}:${fields.minute}`,
    datetime:raw,kind:'converted'};
}

function label(value) {
  if(value&&typeof value==='object'&&!Array.isArray(value))value=value.nome||value.descricao||value.name||'';
  if(typeof value!=='string')return '';
  const text=value.replace(/\s+/gu,' ').trim();
  // Sistemas com apenas código numérico não devem ser exibidos como nomes.
  return /^c[oó]digo\s*\d+$/iu.test(text)||/^\d+$/u.test(text)||
    /^\[object\s+object\]$/iu.test(text)||/^[{[]/u.test(text)?'':text.slice(0,240);
}

export function courtDegree(value) {
  const normalized=label(value).toUpperCase().replace(/\s+/gu,' ');
  if(['G1','1','1º GRAU','1° GRAU','1ª INSTÂNCIA','PRIMEIRO GRAU'].includes(normalized))return '1º grau';
  if(['G2','2','2º GRAU','2° GRAU','2ª INSTÂNCIA','SEGUNDO GRAU'].includes(normalized))return '2º grau';
  if(['SUP','SUPERIOR','TRIBUNAL SUPERIOR'].includes(normalized))return 'Tribunal superior';
  return 'Grau não identificado';
}

const sourceLabel=value=>({datajud:'DataJud',djen:'DJEN',esaj_pg:'TJSP e-SAJ · 1º grau',
  esaj_sg:'TJSP e-SAJ · 2º grau'})[value]||label(value)||'Fonte não identificada';

function tramitationGroups(records) {
  const order=['1º grau','2º grau','Tribunal superior','Grau não identificado'];
  const groups=new Map();
  for(const item of records){
    const degree=courtDegree(item.grau);
    if(!groups.has(degree))groups.set(degree,[]);
    groups.get(degree).push(item);
  }
  return order.filter(x=>groups.has(x)).map(name=>({name,records:groups.get(name)}));
}

// Somente sinaliza data e descrição iguais em GRAUS DIFERENTES de uma mesma
// fonte, sem usar esse indício para unir, ocultar ou remover qualquer registro.
export function probableCrossDegreeDuplicates(events, tramitations) {
  const tracks=new Map(tramitations.map(x=>[String(x.id||''),{source:x.source,degree:courtDegree(x.grau)}]));
  const groups=new Map(),possible=new Set();
  for(const event of events){
    const track=tracks.get(String(event.tramitation_id||''));
    const description=typeof event.text==='string'?event.text.replace(/\s+/gu,' ').trim().toLocaleLowerCase('pt-BR'):'';
    if(!track||track.degree==='Grau não identificado'||track.source!==event.source||
       !event.occurred_at||!description)continue;
    const key=JSON.stringify([event.source,String(event.occurred_at).trim(),description]);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push({event,degree:track.degree});
  }
  for(const items of groups.values()){
    if(new Set(items.map(x=>x.degree)).size>1)
      for(const item of items)possible.add(String(item.event.source)+'\u0000'+String(item.event.id));
  }
  return possible;
}

const plural = (count,one,many)=>`${count.toLocaleString('pt-BR')} ${count===1?one:many}`;

function latestMoment(values, oldest=false){
  const valid=values.filter(x=>caseMoment(x));
  if(!valid.length)return '';
  // As strings usadas pelo serviço são ISO/UTC. Para comparações de carimbos
  // mistos, preferir instantes explícitos; sem fuso, ordenar por data literal.
  const key=value=>{
    const moment=caseMoment(value);
    if(moment.kind==='converted')return Date.parse(value);
    return Date.parse(value.replace(' ','T')+(moment.kind==='date'?'T00:00:00':'')+'Z');
  };
  valid.sort((a,b)=>key(a)-key(b));
  return oldest?valid[0]:valid[valid.length-1];
}

function readableTime(value){
  const moment=caseMoment(value);
  if(!moment)return '';
  const title=moment.kind==='converted'?'Exibido no horário de Brasília (America/Sao_Paulo)':
    moment.kind==='no-zone'?'A fonte não forneceu fuso; hora exibida sem conversão':'Data sem horário informado pela fonte';
  return `<time datetime="${escapeHTML(moment.datetime)}" title="${escapeHTML(title)}">${escapeHTML(moment.text)}</time>`;
}

function tramitationHTML(item) {
  const tribunal=label(item.tribunal),system=label(item.sistema),organ=label(item.orgao);
  const klass=label(item.classe);
  const summary=[tribunal&&`<span><strong>Tribunal:</strong> ${escapeHTML(tribunal)}</span>`,
    system&&`<span><strong>Sistema:</strong> ${escapeHTML(system)}</span>`,
    organ&&`<span><strong>Órgão julgador:</strong> ${escapeHTML(organ)}</span>`,
    klass&&`<span><strong>Classe:</strong> ${escapeHTML(klass)}</span>`,
    Array.isArray(item.assuntos)&&item.assuntos.map(label).filter(Boolean).length?`<span><strong>Assuntos:</strong> ${escapeHTML(item.assuntos.map(label).filter(Boolean).join(' · '))}</span>`:'',
    caseMoment(item.dataAjuizamento)?`<span><strong>Ajuizamento:</strong> ${readableTime(item.dataAjuizamento)}</span>`:''].filter(Boolean);
  return `<article class="integrated-tramitation"><div class="integrated-tramitation-head">`+
    `<span class="integrated-source">${escapeHTML(sourceLabel(item.source))}</span></div>`+
    (summary.length?`<div class="integrated-track-meta">${summary.join('')}</div>`:
    '<p class="muted compact">Esta tramitação não trouxe dados adicionais de identificação.</p>')+
    '</article>';
}

function eventHTML(item,caseId,trackById,duplicates) {
  const when=readableTime(item.occurred_at);
  const track=trackById.get(String(item.tramitation_id||''));
  const degree=track?courtDegree(track.grau):'';
  const isPending=!!item.is_new&&!item.seen;
  const duplicate=duplicates.has(String(item.source)+'\u0000'+String(item.id));
  const text=typeof item.text==='string'&&item.text.trim()?item.text.trim():'Descrição não informada pela fonte.';
  const snippet=text.replace(/\s+/gu,' ').slice(0,145);
  return `<article class="integrated-event${isPending?' integrated-event-pending':''}" data-event-source="${escapeHTML(item.source)}" data-event-id="${escapeHTML(item.id)}"><details class="integrated-event-disclosure">`+
    `<summary class="integrated-event-summary"><span class="integrated-event-date">${when||'Data do evento não informada'}</span>`+
    `<span class="integrated-event-tags"><span class="integrated-source">${escapeHTML(sourceLabel(item.source))}</span>`+
    (track&&degree!=='Grau não identificado'?`<span class="integrated-degree">${escapeHTML(degree)}</span>`:'')+
    (item.kind==='publication'?'<span class="integrated-degree">Publicação</span>':'')+
    '</span>'+(isPending?'<span class="integrated-pending-tag">Por conferir</span>':'')+
    `<span class="integrated-event-snippet private">${escapeHTML(snippet)}</span><span class="integrated-event-caret" aria-hidden="true">⌄</span></summary>`+
    `<div class="integrated-event-extra"><p class="integrated-event-text private">${escapeHTML(text)}</p>`+
    (item.source==='djen'?publicationDetailsHTML(item)+
      '<div class="publication-actions">'+
      (safePublicationUrl(item.url)?`<a class="button ghost small" href="${escapeHTML(safePublicationUrl(item.url))}" target="_blank" rel="noopener noreferrer">Abrir publicação na fonte</a>`:'')+
      (djenCertificateUrl(item.certificate_hash)?`<a class="button secondary small" href="${escapeHTML(djenCertificateUrl(item.certificate_hash))}" target="_blank" rel="noopener noreferrer">Abrir certidão oficial</a>`:'')+'</div>':'')+
    (duplicate?'<p class="integrated-possible-duplicate" title="A mesma data e descrição aparecem em tramitações de graus diferentes; são registros distintos e foram preservados.">Possível repetição em outro grau · confira ambos os registros</p>':'')+
    (isPending?`<button type="button" class="button secondary small" data-integrated="seen" data-id="${escapeHTML(item.id)}" data-case-id="${escapeHTML(caseId)}" data-source="${escapeHTML(item.source)}">Marcar como conferido (controle interno)</button>`:'')+
    '</div></details></article>';
}

export const CASE_HISTORY_PAGE_SIZE=12;
// Apenas recorta a apresentação: não altera, consolida ou grava registros.
export function historyPage(records,requestedPage=1,pageSize=CASE_HISTORY_PAGE_SIZE){
  const count=records.length;
  const pages=Math.max(1,Math.ceil(count/pageSize));
  const page=Math.min(pages,Math.max(1,Math.trunc(Number(requestedPage)||1)));
  const start=(page-1)*pageSize;
  return {page,pages,start,end:Math.min(start+pageSize,count),count,items:records.slice(start,start+pageSize)};
}

function technicalHTML(info,items,track){
  const first=latestMoment(items.map(x=>x.first_seen),true);
  const last=latestMoment(items.map(x=>x.last_seen));
  const sourceUpdated=latestMoment([...items.map(x=>x.source_updated_at),...track.map(x=>x.ultimaAtualizacaoFonte)]);
  const values=[
    ['Primeira identificação no histórico exibido',first,'Primeira vez que o serviço registrou um dos eventos exibidos; não é a data do movimento.'],
    ['Última identificação no histórico exibido',last,'Última vez que um evento exibido foi novamente identificado na fonte.'],
    ['Última consulta tentada',info.lastAttempt?.attempted_at,'Quando o serviço local tentou consultar a fonte, mesmo que tenha falhado.'],
    ['Última consulta com resposta',info.lastSuccess?.attempted_at,'Quando a fonte retornou um resultado, inclusive parcial ou sem registros.'],
    ['Atualização informada pela fonte',sourceUpdated,'Atualização mais recente entre as fontes consultadas; não representa a data do movimento.']
  ];
  const perSource=new Map();
  for(const item of [...items.map(x=>({source:x.source,when:x.source_updated_at})),
    ...track.map(x=>({source:x.source,when:x.ultimaAtualizacaoFonte}))]){
    if(!caseMoment(item.when))continue;
    const values=perSource.get(item.source)||[];
    values.push(item.when);
    perSource.set(item.source,values);
  }
  if(perSource.size>1){
    for(const [key,timestamps] of perSource)
      values.push(['Atualização · '+sourceLabel(key),latestMoment(timestamps),
        'Último carimbo de atualização disponível para esta fonte.']);
  }
  const lines=values.filter(([,value])=>caseMoment(value));
  const corrections=items.reduce((n,x)=>n+(Number(x.correction_count)||0),0);
  return `<details class="integrated-technical"><summary>Informações técnicas das consultas <span class="integrated-expand">Mostrar detalhes</span></summary>`+
    (lines.length?`<dl class="integrated-technical-grid">${lines.map(([name,value,description])=>
      `<div><dt>${escapeHTML(name)}</dt><dd>${readableTime(value)}</dd><p>${escapeHTML(description)}</p></div>`).join('')}</dl>`:
      '<p class="muted compact">Ainda não há datas técnicas disponíveis nesta consulta.</p>')+
    (corrections?`<p class="muted compact">Correções de conteúdo registradas: ${plural(corrections,'correção','correções')}.</p>`:'')+
    (info.previousNumberEvents?'<p class="muted compact">Há registros preservados para CNJ anterior, não exibidos neste processo.</p>':'')+
    '<p class="muted compact">Identificação e consulta são registros internos do Painel H.B; não representam a ocorrência ou publicação judicial.</p></details>';
}

function sourceStatusHTML(info,caseId){
  const jobs=Array.isArray(info.sourceJobs)?info.sourceJobs:[];
  const states={queued:'Na fila',running:'Consultando',success:'Consulta concluída',partial:'Resultado parcial',
    not_found:'Sem registros na consulta',unavailable:'Fonte indisponível',auth_required:'Autenticação necessária',
    access_denied:'Acesso negado',unsupported:'Não disponível',incompatible:'Resposta incompatível',cancelled:'Consulta cancelada'};
  return jobs.map(job=>`<article class="record" ${job.status==='running'?'data-loading="true" data-loading-fixed aria-busy="true"':''}><strong>${escapeHTML(sourceLabel(job.source))} · ${escapeHTML(states[job.status]||'Situação não identificada')}</strong>`+
    `<p class="compact">${escapeHTML(job.source==='djen'&&job.status==='not_found'?'Nenhuma publicação encontrada no período consultado. Isso não significa que o processo não existe.':job.message||'Consulta aguardando resultado.')}</p>`+
    (job.updated_at?`<small>${readableTime(job.updated_at)}</small>`:'')+'</article>').join('');
}

export function integratedCaseHTML(info,caseId,pageState={}) {
  const items=Array.isArray(info?.events)?info.events:[];
  const track=Array.isArray(info?.tramitations)?info.tramitations.filter(x=>x.source==='datajud'):[];
  const pending=items.filter(x=>!!x.is_new&&!x.seen);
  const previous=items.filter(x=>!x.is_new||!!x.seen);
  const movements=items.filter(x=>x.kind!=='publication').length;
  const publications=items.filter(x=>x.kind==='publication').length;
  const historyDescription=items.length>=2000?'no histórico exibido':'no histórico';
  const count=items.length?(movements&&publications?
    `${plural(movements,'movimento','movimentos')} · ${plural(publications,'publicação','publicações')} ${historyDescription}`:
    movements?`${plural(movements,'movimento','movimentos')} ${historyDescription}`:
    `${plural(publications,'publicação','publicações')} ${historyDescription}`):'Nenhum evento no histórico';
  const trackById=new Map(track.map(x=>[String(x.id||''),x]));
  const duplicates=probableCrossDegreeDuplicates(items,track);
  const groupHTML=tramitationGroups(track).map(({name,records})=>
    `<section class="integrated-degree-group" aria-label="Tramitações do ${escapeHTML(name)}"><header class="integrated-degree-heading"><h5>${escapeHTML(name)}</h5><span>${plural(records.length,'registro','registros')}</span></header>`+
    `<div class="integrated-tramitation-list">${records.map(tramitationHTML).join('')}</div></section>`).join('');
  const eventList=(events,source,kind)=>{
    const key=`${source}-${kind}`;
    const slice=historyPage(events,pageState[key]);
    const controls=slice.pages>1?`<nav class="case-history-pagination" aria-label="Páginas de ${escapeHTML(sourceLabel(source))} · ${kind==='news'?'novidades':'histórico'}"><span>Mostrando ${slice.start+1}–${slice.end} de ${slice.count} · Página ${slice.page} de ${slice.pages}</span><div><button type="button" class="button ghost small" data-integrated="events-page" data-key="${escapeHTML(key)}" data-page="${slice.page-1}" ${slice.page===1?'disabled':''} aria-label="Página anterior">Anterior</button><button type="button" class="button ghost small" data-integrated="events-page" data-key="${escapeHTML(key)}" data-page="${slice.page+1}" ${slice.page===slice.pages?'disabled':''} aria-label="Próxima página">Próxima</button></div></nav>`:'';
    return `<div class="integrated-event-list">${slice.items.map(item=>eventHTML(item,caseId,trackById,duplicates)).join('')}</div>${controls}`;
  };
  const block=(source,title,description)=>{
    const selected=items.filter(x=>x.source===source);
    const news=selected.filter(x=>!!x.is_new&&!x.seen),history=selected.filter(x=>!x.is_new||!!x.seen);
    const disabled=info.enabledSources?.[source]===false;
    const action=source==='datajud'?'Buscar andamentos no DataJud':'Buscar publicações no DJEN';
    return `<section class="integrated-block" aria-label="${title}"><h4>${title}</h4><p class="muted compact">${description}</p>`+
      `<button type="button" class="button secondary small" data-integrated="update-${source}" data-id="${escapeHTML(caseId)}" ${disabled?'disabled':''}>${action}</button>`+
      (disabled?`<p class="warning-note">Habilite ${sourceLabel(source)} em Fontes e ajustes para consultar.</p>`:'')+
      (source==='djen'?`<p class="muted compact">Período da busca DJEN: últimos ${Number(info.djenDays)||30} dias.</p>`:'')+
      sourceStatusHTML({...info,sourceJobs:(info.sourceJobs||[]).filter(x=>x.source===source)},caseId)+
      `<div aria-label="Novidades por conferir"><h5>Por conferir · ${news.length}</h5>`+
      (news.length?eventList(news,source,'news'):'<p class="integrated-empty">Nenhuma novidade pendente de conferência.</p>')+'</div>'+
      `<div aria-label="Histórico de eventos"><h5>Histórico · ${history.length}</h5>`+
      (history.length?eventList(history,source,'history'):'<p class="integrated-empty">Não há outros registros no histórico desta consulta.</p>')+'</div>'+
      (source==='datajud'?`<section aria-label="Tramitações agrupadas por grau"><h5>Metadados e tramitações por grau</h5>${track.length?groupHTML:'<p class="integrated-empty">Nenhuma tramitação estruturada disponível nesta fonte.</p>'}</section>`:'')+'</section>';
  };
  const other=items.filter(x=>!['datajud','djen'].includes(x.source));
  return `<div class="integrated-overview"><h3>Acompanhamento integrado</h3>`+
    `<p class="integrated-count" aria-live="polite"><strong>${escapeHTML(count)}</strong> · <strong>${plural(pending.length,'por conferir','por conferir')}</strong></p>`+
    '<p class="muted compact">Novidade significa identificada após a linha de base ou consulta anterior — não necessariamente um movimento ocorrido recentemente.</p>'+
    '<p class="integrated-timezone">Datas e horas com fuso são exibidas no horário de Brasília. Sem fuso informado, o horário é mantido.</p>'+
    (items.length>=2000?'<p class="muted compact">Exibindo os 2.000 registros mais recentes retornados pelo serviço.</p>':'')+'</div>'+
    block('datajud','Andamentos · DataJud','Movimentações enviadas pelo tribunal e metadados estruturados do processo. A consulta não fornece o teor das decisões.')+
    block('djen','Publicações · DJEN','Textos publicados, destinatários, advogados e certidões. Publicações não representam todos os andamentos dos autos.')+
    (other.length?'<section class="integrated-block"><h4>Outras fontes</h4>'+eventList(other,'other','history')+'</section>':'')+
    technicalHTML(info,items,track)+
    '<p class="muted compact">Documentos dos autos: use os links oficiais quando disponíveis. Uma certidão DJEN não equivale ao PDF original da decisão.</p>';
}
