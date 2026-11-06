// Visão de leitura do histórico das consultas: sem efeitos e sem alterar a fila.
export const SERVICE_JOB_PAGE_SIZE=6;
export const SERVICE_JOB_FILTERS=Object.freeze({
  all:'Todas',attention:'Atenção',active:'Em andamento',completed:'Concluídas',cancelled:'Canceladas'
});
const ATTENTION=new Set(['partial','error','action','auth_required','access_denied','unavailable','unsupported','incompatible','interrupted']);
const ACTIVE=new Set(['queued','running']);
const COMPLETED=new Set(['success','not_found']);
const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function serviceJobGroup(job){
  const status=String(job?.status??'');
  if(ACTIVE.has(status))return 'active';
  if(ATTENTION.has(status))return 'attention';
  if(COMPLETED.has(status))return 'completed';
  return status==='cancelled'?'cancelled':'attention';
}
export function selectServiceJobs(jobs,{filter='all',query='',page=1,pageSize=SERVICE_JOB_PAGE_SIZE}={}){
  if(!Object.hasOwn(SERVICE_JOB_FILTERS,filter))filter='all';
  const collection=Array.isArray(jobs)?jobs:[],counts={all:collection.length,attention:0,active:0,completed:0,cancelled:0};
  for(const job of collection)counts[serviceJobGroup(job)]++;
  const needle=fold(query.trim());
  const matches=collection.filter(job=>(filter==='all'||serviceJobGroup(job)===filter)&&
    (!needle||fold([job.source,SOURCES[job.source],job.cnj,job.oab,job.uf,job.status,LABELS[job.status],job.message,job.case_id].join(' ')).includes(needle)));
  const size=Math.max(1,Math.min(25,Math.floor(Number(pageSize)||SERVICE_JOB_PAGE_SIZE)));
  const totalPages=Math.max(1,Math.ceil(matches.length/size));
  const currentPage=Math.max(1,Math.min(totalPages,Math.floor(Number(page)||1)));
  const from=(currentPage-1)*size;
  return {rows:matches.slice(from,from+size),counts,total:matches.length,totalPages,page:currentPage,
    first:matches.length?from+1:0,last:Math.min(from+size,matches.length),pageSize:size};
}
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const SOURCES={datajud:'DataJud',djen:'DJEN',esaj_pg:'TJSP e-SAJ · 1º grau',esaj_sg:'TJSP e-SAJ · 2º grau'};
const LABELS={queued:'Na fila',running:'Consultando',success:'Concluída',partial:'Parcial',not_found:'Não localizada',
  auth_required:'Autenticação necessária',access_denied:'Acesso negado',unavailable:'Indisponível',unsupported:'Não suportado',
  incompatible:'Resposta incompatível',cancelled:'Cancelada',error:'Erro',action:'Exige ação',interrupted:'Interrompida'};
export function serviceJobRowsHTML(rows,formatDate=()=> 'Data não informada'){
  if(!rows.length)return '<p class="service-jobs-empty">Nenhuma consulta corresponde a este filtro. Tente outra situação ou pesquisa.</p>';
  return '<ol class="service-jobs-list">'+rows.map(job=>{
    const category=serviceJobGroup(job),reference=job.cnj||((job.oab&&job.uf)?`OAB ${job.oab}/${job.uf}`:'Referência não informada');
    const status=LABELS[job.status]||'Situação não informada',title=SOURCES[job.source]||'Fonte não informada';
    const date=job.updated_at?formatDate(job.updated_at):'Data não informada';
    return `<li ${job.status==='running'?'data-loading="true" data-loading-fixed aria-busy="true"':''} class="service-job-row ${category==='attention'?'service-job-alert':''}">
      <div class="service-job-summary"><span class="service-job-source">${esc(title)}</span>
        <span data-service-status="${Object.hasOwn(LABELS,job.status)?job.status:'unknown'}" class="tag service-job-tag ${category==='attention'?'action':category==='active'?'running':category==='completed'?'success':'cancelled'}">${esc(status)}</span>
        <strong class="service-job-reference private" title="${esc(reference)}">${esc(reference)}</strong>
        <span class="service-job-date">${esc(date)}</span></div>
      <div class="service-job-extras"><details class="service-job-details"><summary>Detalhes</summary>
        <div class="service-job-detail-body"><p class="private">${esc(job.message||'Sem mensagem adicional da fonte.')}</p>
        ${job.source_updated_at?`<p>Atualização informada pela fonte: ${esc(formatDate(job.source_updated_at))}</p>`:''}
        <p>Última tentativa: ${esc(date)}</p></div></details>
        ${job.case_id?`<button type="button" class="button ghost small" data-integrated="detail" data-id="${esc(job.case_id)}">Ver processo</button>`:''}</div>
    </li>`;
  }).join('')+'</ol>';
}
