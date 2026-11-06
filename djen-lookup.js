import {digits,validCnj} from './core.js';
import {publicationDetailsHTML} from './publication-details.js';
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function djenLookupHTML(){
  return '<section class="datajud-lookup" aria-label="Consulta de publicações DJEN"><h3>Publicações do processo · DJEN</h3><button type="button" class="button primary small" data-action="djen-search">Buscar publicações no DJEN</button><p class="muted compact">Consulte pelo CNJ, mesmo antes de salvar o cadastro. A prévia mostra publicações dos últimos 30 dias e não altera os campos do formulário.</p><p id="djen-lookup-status" role="status" aria-live="polite"></p><div id="djen-lookup-results"></div></section>';
}

export function djenPreviewHTML(events=[]){
  return events.map(e=>`<article class="record"><strong>Publicação DJEN · ${escapeHTML(e.occurredAt)}</strong>${publicationDetailsHTML(e)}<p class="private" style="white-space:pre-wrap">${escapeHTML(e.text)}</p>${/^https:\/\//i.test(e.url||'')?`<a href="${escapeHTML(e.url)}" target="_blank" rel="noopener noreferrer">Abrir publicação oficial ↗</a>`:''}</article>`).join('');
}

export function invalidateDjenLookup(form){
  form._djenRequest=null;
  const status=form.querySelector('#djen-lookup-status'),results=form.querySelector('#djen-lookup-results');
  if(status)status.textContent='';if(results)results.innerHTML='';
}

export async function searchDjen(form,apiPost,available){
  const status=form.querySelector('#djen-lookup-status'),results=form.querySelector('#djen-lookup-results');
  const cnj=digits(form.elements.namedItem('cnj')?.value);
  if(!available){status.textContent='Inicie o painel integrado para consultar o DJEN.';return;}
  if(!validCnj(cnj)){status.textContent='Informe um número CNJ válido para consultar o DJEN.';return;}
  const token={};form._djenRequest=token;
  const button=form.querySelector('[data-action="djen-search"]');button.disabled=true;
  status.textContent='Consultando publicações no DJEN…';results.innerHTML='';
  try{
    const response=await apiPost('djen/preview',{cnj});
    if(form._djenRequest!==token||digits(form.elements.namedItem('cnj').value)!==cnj)return;
    results.innerHTML=djenPreviewHTML(response.events);
    status.textContent=response.status==='not_found'?'Nenhuma publicação encontrada nos últimos 30 dias. Isso não significa que o processo não existe.':`${response.events.length} publicação(ões) encontrada(s) nos últimos 30 dias.${response.status==='partial'?' Resultado parcial; confira a fonte.':''}`;
  }catch(error){
    if(form._djenRequest===token)status.textContent='Consulta DJEN não concluída: '+error.message;
  }finally{button.disabled=false;}
}
