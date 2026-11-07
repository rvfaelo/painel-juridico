import {digits,validCnj} from './core.js';
import {escapeHTML} from './html-utils.js';
import {publicationDetailsHTML} from './publication-details.js';
import {safeDateLabel} from './safe-dates.js';

export function djenLookupHTML(configuredDays=30){
  const periods=[...new Set([30,90,180,365,Number(configuredDays)||30])].sort((a,b)=>a-b);
  const options=periods.map(days=>`<option value="${days}" ${Number(configuredDays)===days?'selected':''}>${days} dias</option>`).join('');
  return `<section class="datajud-lookup" aria-label="Consulta de publicações DJEN"><h3>Publicações do processo · DJEN</h3><label class="field compact-field">Período da consulta<select data-djen-days aria-label="Período da consulta rápida no DJEN">${options}</select></label><button type="button" class="button primary small" data-action="djen-search">Buscar publicações no DJEN</button><p class="muted compact">Consulte pelo CNJ, mesmo antes de salvar o cadastro. O período acima vale apenas para esta busca rápida; a atualização do processo usa o período configurado em Fontes e ajustes.</p><p id="djen-lookup-status" role="status" aria-live="polite"></p><div id="djen-lookup-results"></div></section>`;
}

export function djenPreviewHTML(events=[]){
  return events.map(e=>`<article class="record"><strong>Publicação DJEN · ${escapeHTML(e.occurredAt)}</strong>${publicationDetailsHTML(e)}<p class="private pre-wrap">${escapeHTML(e.text)}</p>${/^https:\/\//i.test(e.url||'')?`<a href="${escapeHTML(e.url)}" target="_blank" rel="noopener noreferrer">Abrir publicação oficial ↗</a>`:''}</article>`).join('');
}

export function invalidateDjenLookup(form){
  form._djenRequest=null;
  const status=form.querySelector('#djen-lookup-status'),results=form.querySelector('#djen-lookup-results');
  if(status)status.textContent='';if(results)results.innerHTML='';
}

export async function searchDjen(form,apiPost,available,days=30){
  const status=form.querySelector('#djen-lookup-status'),results=form.querySelector('#djen-lookup-results');
  const cnj=digits(form.elements.namedItem('cnj')?.value);
  if(!available){status.textContent='Inicie o painel integrado para consultar o DJEN.';return;}
  if(!validCnj(cnj)){status.textContent='Informe um número CNJ válido para consultar o DJEN.';return;}
  const selected=Number(form.querySelector('[data-djen-days]')?.value);
  if(Number.isInteger(selected)&&selected>=1&&selected<=365)days=selected;
  if(!Number.isInteger(days)||days<1||days>365)days=30;
  const token={};form._djenRequest=token;
  const button=form.querySelector('[data-action="djen-search"]');button.disabled=true;
  status.textContent='Consultando publicações no DJEN…';results.innerHTML='';
  try{
    const response=await apiPost('djen/preview',{cnj,days});
    if(form._djenRequest!==token||digits(form.elements.namedItem('cnj').value)!==cnj)return;
    results.innerHTML=djenPreviewHTML(response.events);
    const period=response.periodStart&&response.periodEnd
      ?` de ${safeDateLabel(response.periodStart)} a ${safeDateLabel(response.periodEnd)}`
      :` nos últimos ${response.days||days} dias`;
    status.textContent=response.status==='not_found'
      ?`Nenhuma publicação encontrada${period}. Isso não significa que o processo não existe.`
      :`${response.events.length} publicação(ões) encontrada(s)${period}.${response.status==='partial'?' Resultado parcial; confira a fonte.':''}`;
  }catch(error){
    if(form._djenRequest===token)status.textContent='Consulta DJEN não concluída: '+error.message;
  }finally{button.disabled=false;}
}
