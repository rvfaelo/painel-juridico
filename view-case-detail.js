// Views puras da ficha do processo: anexos, vínculos e histórico local.
import {publicationDetailsHTML} from './publication-details.js';
import {historyPage} from './integrated-case-view.js';
import {publicationDateBR,djenCertificateUrl,safePublicationUrl} from './publication-pdf.js';

export function createCaseDetailView(app) {
  function documentsSection(id){const items=app.state.documents.filter(d=>d.caseId===id);return `<div class="detail-section"><div class="panel-heading"><h3>Anexos · ${items.length}</h3>${app.button('attach','Anexar documento','secondary small',id)}</div><p class="muted compact">PDF, PNG, JPEG, WebP ou TXT UTF-8. Até 5 MB por arquivo e 25 MB no total. Armazenamento local, incluído no backup.</p>${items.map(d=>`<article class="record"><div class="record-head"><div><strong class="private">${app.esc(d.name)}</strong><small>${(d.size/1024).toFixed(1)} KB · ${app.date(d.createdAt)}</small></div><div class="line-actions">${app.button('download-document','Baixar','secondary small',d.id)}${app.button('remove-document','Remover','ghost small',d.id)}</div></div></article>`).join('')||'<p class="muted">Nenhum documento anexado.</p>'}</div>`;}
  
  function relatedProceedings(c){
   const parent=app.state.cases.find(x=>x.id===c.parentCaseId),children=app.state.cases.filter(x=>x.parentCaseId===c.id);
   return `<div class="detail-section"><h3>Tramitação e vínculos</h3><p class="private">${app.esc(app.jurisdictionLabel(c)||'Tribunal e grau não informados')}</p>${c.docketNumber?`<p class="private">Registro adicional: ${app.esc(c.docketNumber)}</p>`:''}${c.originReference?`<p class="private">Referência de origem: ${app.esc(c.originReference)}</p>`:''}${parent?`<p class="private">Origem: ${app.button('detail','Abrir '+app.esc(parent.title),'secondary small',parent.id)}</p>`:''}${children.map(x=>`<p class="private">Relacionado: ${app.button('detail','Abrir '+app.esc(x.title),'secondary small',x.id)}</p>`).join('')}<p class="muted compact">Vínculos manuais. Eventos e documentos permanecem associados ao processo original.</p></div>`;
  }
  
  function localHistoryHTML(events){
    if(!events.length)return '<p class="muted">As informações encontradas nas fontes aparecerão aqui.</p>';
    const slice=historyPage(events,app.localHistoryPage);
    app.localHistoryPage=slice.page;
    const entries=slice.items.map(e=>{
      const label=e.kind==='publication'?'Publicação':'Movimentação';
      const url=safePublicationUrl(e.url),certificate=djenCertificateUrl(e.certificateHash);
      const summary=String(e.text||'Descrição não informada').replace(/\s+/gu,' ').slice(0,145);
      return `<article class="case-history-event"><details><summary class="case-history-summary"><time class="case-history-date">${app.esc(publicationDateBR(e.date))}</time><span class="integrated-source">${app.esc(e.tribunal||e.source||'Fonte não informada')}</span><span class="integrated-degree">${label}</span>${e.publicationStatus==='Cancelada'?app.tag('Publicação cancelada','action'):''}${!e.seen?'<span class="integrated-pending-tag">Por conferir</span>':''}<span class="case-history-snippet private">${app.esc(summary)}</span><span class="integrated-event-caret" aria-hidden="true">⌄</span></summary><div class="case-history-extra private"><p>${app.esc(e.text||'Descrição não informada')}</p>${e.source==='djen'?publicationDetailsHTML(e):''}<p class="muted compact">Identificado em ${app.timestamp(e.discoveredAt)}${e.sourceUpdatedAt?' · Atualização da fonte: '+app.esc(e.sourceUpdatedAt):''}</p><div class="case-history-actions">${app.button('seen',e.seen?'Desmarcar conferência':'Marcar como conferido','ghost small',e.id)}${e.kind==='publication'?app.button('publication-pdf','Baixar cópia (PDF)','secondary small',e.id)+(certificate?app.button('publication-official-pdf','Baixar certidão oficial','secondary small',e.id):''):''}${url?`<a href="${app.esc(url)}" class="button ghost small" target="_blank" rel="noopener noreferrer">Abrir na fonte</a>`:''}${certificate?`<a href="${app.esc(certificate)}" class="button ghost small" target="_blank" rel="noopener noreferrer">Abrir certidão no CNJ</a>`:''}</div></div></details></article>`;
    }).join('');
    const pagination=slice.pages>1?`<nav class="case-history-pagination" aria-label="Páginas do histórico local"><span>Mostrando ${slice.start+1}–${slice.end} de ${slice.count} · Página ${slice.page} de ${slice.pages}</span><div><button type="button" class="button ghost small" data-case-page="${slice.page-1}" ${slice.page===1?'disabled':''}>Anterior</button><button type="button" class="button ghost small" data-case-page="${slice.page+1}" ${slice.page===slice.pages?'disabled':''}>Próxima</button></div></nav>`:'';
    return `<div class="case-history-list">${entries}</div>${pagination}`;
  }
  function refreshLocalHistory(){
    const section=app.$('#local-case-history');
    if(!section||!app.activeDetailCaseId)return;
    const events=app.state.events.filter(e=>e.caseId===app.activeDetailCaseId).sort((a,b)=>b.date.localeCompare(a.date));
    section.innerHTML=`<h3>Histórico · ${events.length} registro(s)</h3>${localHistoryHTML(events)}`;
  }
  return {documentsSection,relatedProceedings,localHistoryHTML,refreshLocalHistory};
}
