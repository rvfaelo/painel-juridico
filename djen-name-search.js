import {publicationDetailsHTML} from './publication-details.js';
import {safePublicationUrl,djenCertificateUrl,publicationDateBR} from './publication-pdf.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function djenNameSearchHTML(){
  return '<h2>Buscar publicações por nome</h2><form id="djen-name-search-form" class="form-grid">'+
    '<label class="field">Buscar por<select name="criterion"><option value="nomeParte">Nome da parte</option><option value="nomeAdvogado">Nome do advogado</option></select></label>'+
    '<label class="field">Nome completo<input name="name" required minlength="3" maxlength="200" autocomplete="off" placeholder="Digite o nome da parte ou do advogado"></label>'+
    '<label class="field">Período<select name="days"><option value="7">Últimos 7 dias</option><option value="30" selected>Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="365">Últimos 365 dias</option></select></label>'+
    '<div class="form-actions"><button type="submit" class="button primary">Buscar no DJEN</button></div></form>'+
    '<p class="muted compact">Busca nas publicações do DJEN, não em todos os processos da pessoa. Confira os destinatários para distinguir homônimos. Os resultados são uma consulta avulsa e não cadastram processos automaticamente.</p>'+
    '<p data-djen-search-status role="status" aria-live="polite"></p><div data-djen-search-results></div>';
}

export function djenNameResultsHTML(data={}){
  const events=Array.isArray(data.events)?data.events:[];
  const rows=events.map(e=>{
    const url=safePublicationUrl(e.url),cert=djenCertificateUrl(e.certificateHash);
    return `<article class="record"><strong>${esc(e.cnj)} · ${publicationDateBR(e.occurredAt)}</strong>`+
      publicationDetailsHTML(e)+`<details class="service-publication-body"><summary>Ler teor da publicação</summary><p class="private">${esc(e.text)}</p></details><div class="publication-actions">`+
      (url?`<a class="button ghost small" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir publicação na fonte</a>`:'')+
      (cert?`<a class="button ghost small" href="${esc(cert)}" target="_blank" rel="noopener noreferrer">Abrir certidão oficial</a>`:'')+
      (e.caseId?`<button type="button" class="button secondary small" data-integrated="detail" data-id="${esc(e.caseId)}">Abrir processo cadastrado</button>`:'<span class="muted compact">CNJ sem vínculo no histórico do serviço</span>')+'</div></article>';
  }).join('');
  return rows+(data.status==='partial'?'<p class="warning-note">Resposta parcial. A busca não foi concluída; confira a fonte ou reduza o período.</p>':'')+
    (data.limitReached?'<p class="warning-note">Limite de 10.000 resultados atingido. Reduza o período.</p>':'')+
    `<div class="service-jobs-pager"><button type="button" class="button ghost small" data-djen-search-page="${Number(data.page)-1}" ${Number(data.page)<=1?'disabled':''}>Anterior</button><span>Página ${Number(data.page)||1}</span><button type="button" class="button secondary small" data-djen-search-page="${Number(data.page)+1}" ${!data.hasNext?'disabled':''}>Próxima</button></div>`;
}

export async function searchDjenName(panel,apiPost,page=1,filters=null){
  const form=panel.querySelector('form'),status=panel.querySelector('[data-djen-search-status]'),results=panel.querySelector('[data-djen-search-results]');
  const fields=filters||{criterion:form.elements.criterion.value,name:form.elements.name.value.trim(),days:Number(form.elements.days.value)};
  if(!fields.name||fields.name.length<3){status.textContent='Informe pelo menos 3 caracteres do nome.';return;}
  const token={};panel._searchToken=token;
  const submit=form.querySelector('[type="submit"]');submit.disabled=true;
  results.innerHTML='';status.textContent='Consultando publicações no DJEN…';
  try{
    const data=await apiPost('djen/search',{...fields,page});
    if(!panel.isConnected||panel._searchToken!==token)return;
    if(!Array.isArray(data.events)||!Number.isInteger(data.total)||!Number.isInteger(data.page))throw Error('Resposta DJEN incompatível.');
    panel._searchFilters={...fields};
    results.innerHTML=djenNameResultsHTML(data);
    status.textContent=data.status==='partial'?'Busca com resposta parcial.':data.events.length?`${data.total} publicação(ões) encontrada(s). Exibindo ${data.events.length} nesta página.`:data.total>0?'Nenhuma publicação nesta página. Volte à página anterior.':'Nenhuma publicação encontrada para esse nome no período. Isso não comprova ausência de processos.';
  }catch(error){if(panel._searchToken===token&&panel.isConnected)status.textContent='Busca não concluída: '+error.message;}
  finally{if(panel._searchToken===token)submit.disabled=false;}
}

export function installDjenNameSearch(apiPost){
  document.addEventListener('submit',event=>{
    if(event.target.id!=='djen-name-search-form')return;
    event.preventDefault();void searchDjenName(event.target.closest('#djen-name-search-panel'),apiPost);
  });
  document.addEventListener('input',event=>{
    const panel=event.target.closest('#djen-name-search-panel');if(!panel||!event.target.closest('form'))return;
    panel._searchToken=null;panel._searchFilters=null;
    panel.querySelector('[type="submit"]').disabled=false;
    panel.querySelector('[data-djen-search-results]').innerHTML='';
    panel.querySelector('[data-djen-search-status]').textContent='Filtros alterados. Clique em Buscar no DJEN.';
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-djen-search-page]');if(!button)return;
    const panel=button.closest('#djen-name-search-panel');
    if(panel?._searchFilters)void searchDjenName(panel,apiPost,Number(button.dataset.djenSearchPage),panel._searchFilters);
  });
}
