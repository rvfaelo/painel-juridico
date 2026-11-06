import test from 'node:test';
import assert from 'node:assert/strict';
import {SERVICE_JOB_PAGE_SIZE,SERVICE_JOB_FILTERS,selectServiceJobs,serviceJobGroup,serviceJobRowsHTML} from '../service-job-history.js';

const jobs=Array.from({length:100},(_,i)=>({
  id:`job${i}`,source:i%2?'datajud':'djen',status:i%5===0?'unavailable':i%5===1?'running':i%5===2?'success':i%5===3?'not_found':'cancelled',
  cnj:`00000000000000000${String(i).padStart(3,'0')}`,
  case_id:i%3===0?'case-1':'',updated_at:'2026-11-05T12:00:00Z',message:`Consulta fictícia nº ${i}`,
}));

test('histórico extenso exibe no máximo seis itens e pagina sem perder registros',()=>{
  assert.equal(SERVICE_JOB_PAGE_SIZE,6);
  const a=selectServiceJobs(jobs),b=selectServiceJobs(jobs,{page:2}),last=selectServiceJobs(jobs,{page:999});
  assert.deepEqual([a.rows.length,a.total,a.totalPages,a.page,a.first,a.last],[6,100,17,1,1,6]);
  assert.deepEqual([b.rows.length,b.page,b.first,b.last],[6,2,7,12]);
  assert.notEqual(a.rows[0].id,b.rows[0].id);
  assert.deepEqual([last.rows.length,last.page,last.first,last.last],[4,17,97,100]);
  assert.equal(selectServiceJobs(jobs,{page:-100}).page,1);
  assert.equal(selectServiceJobs(jobs,{pageSize:100}).rows.length,25);
});

test('filtros e pesquisa distingem falhas, em andamento e conclusões sem dados perdidos',()=>{
  assert.deepEqual(Object.keys(SERVICE_JOB_FILTERS),['all','attention','active','completed','cancelled']);
  const total=selectServiceJobs(jobs);
  assert.deepEqual(total.counts,{all:100,attention:20,active:20,completed:40,cancelled:20});
  assert.equal(selectServiceJobs(jobs,{filter:'attention'}).total,20);
  assert.equal(selectServiceJobs(jobs,{filter:'active'}).total,20);
  assert.equal(selectServiceJobs(jobs,{filter:'completed'}).total,40);
  assert.equal(selectServiceJobs(jobs,{filter:'cancelled'}).total,20);
  assert.equal(selectServiceJobs(jobs,{query:'FICTICIA Nº 17'}).total,1);
  assert.equal(selectServiceJobs(jobs,{filter:'attention',query:'Consulta fictícia nº 21'}).total,0);
  assert.equal(selectServiceJobs(jobs,{filter:'attention',query:'Consulta fictícia nº 20'}).total,1);
  assert.equal(selectServiceJobs([],{}).totalPages,1);
  assert.equal(serviceJobGroup({status:'novo_estado_desconhecido'}),'attention');
});

test('linhas compactas ocultam detalhes por padrão, mostram situação em texto e escapam conteúdo externo',()=>{
  const html=serviceJobRowsHTML([
    {id:'1',source:'djen',status:'unavailable',cnj:'12345678901234567890',updated_at:'2026-11-05',
      case_id:'case-sintetico',message:'<img src=x onerror=alert(1)>',source_updated_at:'2026-11-03'},
    {id:'2',source:'datajud',status:'success',cnj:'234',updated_at:'2026-11-04',message:'Concluído'},
  ],x=>x);
  assert.match(html,/<ol class="service-jobs-list">/);
  assert.equal((html.match(/<li /g)||[]).length,2);
  assert.match(html,/<details class="service-job-details"><summary>Detalhes<\/summary>/);
  assert.match(html,/Indisponível/);
  assert.match(html,/Concluída/);
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html,/<img/);
  assert.match(html,/data-integrated="detail" data-id="case-sintetico"/);
  assert.doesNotMatch(html,/<details[^>]*open/);
});
