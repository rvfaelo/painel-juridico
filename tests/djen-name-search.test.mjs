import test from 'node:test';import assert from 'node:assert/strict';
import {djenNameSearchHTML,djenNameResultsHTML,searchDjenName} from '../djen-name-search.js';
function panel(){
  const status={textContent:''},results={innerHTML:''},button={disabled:false};
  const form={elements:{criterion:{value:'nomeParte'},name:{value:'José Exemplo'},days:{value:'30'}},querySelector:()=>button};
  return {status,results,button,form,isConnected:true,querySelector:q=>q==='form'?form:q.includes('status')?status:results};
}
test('formulario apresenta criterios e consulta nome com periodo',async()=>{
  assert.match(djenNameSearchHTML(),/Nome da parte/);assert.match(djenNameSearchHTML(),/Nome do advogado/);
  const p=panel();let sent;
  await searchDjenName(p,async(route,body)=>{sent={route,body};return {events:[],status:'not_found',total:0,page:1};});
  assert.deepEqual(sent,{route:'djen/search',body:{criterion:'nomeParte',name:'José Exemplo',days:30,page:1}});
  assert.match(p.status.textContent,/não comprova ausência/);assert.equal(p.button.disabled,false);
});
test('resposta atrasada nao aparece depois que os filtros mudam',async()=>{
  const p=panel();let resolve;
  const pending=searchDjenName(p,()=>new Promise(r=>resolve=r));
  p._searchToken=null;p.status.textContent='Filtros alterados';
  resolve({events:[{text:'ANTIGO'}],total:1,page:1});await pending;
  assert.equal(p.results.innerHTML,'');assert.equal(p.status.textContent,'Filtros alterados');
});
test('paginacao preserva filtros e escapa conteudo externo',async()=>{
  const p=panel(),filters={criterion:'nomeAdvogado',name:'Advogado Exemplo',days:7};let sent;
  await searchDjenName(p,async(route,body)=>{sent=body;return {events:[],total:101,page:2};},2,filters);
  assert.deepEqual(sent,{...filters,page:2});
  const html=djenNameResultsHTML({page:1,hasNext:true,events:[{cnj:'<img>',text:'<script>bad</script>',url:'javascript:bad',caseId:'" onmouseover="bad'}]});
  assert.doesNotMatch(html,/<script>|<img>|href="javascript:|data-id="" onmouseover=/);
  assert.match(html,/data-djen-search-page="2"/);
});
