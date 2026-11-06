import test from 'node:test';
import assert from 'node:assert/strict';
import {searchDjen,invalidateDjenLookup,djenPreviewHTML} from '../djen-lookup.js';
function form(){
  const cnj={value:'0812977-79.2023.8.19.0066'},status={textContent:''},results={innerHTML:''},button={disabled:false};
  return {cnj,status,results,button,elements:{namedItem:()=>cnj},querySelector:s=>s.includes('status')?status:s.includes('results')?results:button};
}
test('DJEN: consulta CNJ ainda não salvo e mostra prévia sem modificar o formulário',async()=>{
  const f=form();let args;
  await searchDjen(f,async(...a)=>{args=a;return {status:'success',events:[{occurredAt:'2026-11-05',text:'Intimação'}]};},true);
  assert.deepEqual(args,['djen/preview',{cnj:'08129777920238190066'}]);
  assert.match(f.results.innerHTML,/Intimação/);assert.equal(f.cnj.value,'0812977-79.2023.8.19.0066');assert.equal(f.button.disabled,false);
});
test('DJEN: resposta antiga não aparece após troca de CNJ',async()=>{
  const f=form();let resolve;
  const waiting=searchDjen(f,()=>new Promise(r=>{resolve=r;}),true);
  f.cnj.value='';invalidateDjenLookup(f);resolve({status:'success',events:[{text:'Antigo'}]});await waiting;
  assert.equal(f.results.innerHTML,'');assert.equal(f.status.textContent,'');
});
test('DJEN: falha e resultado vazio são distintos',async()=>{
  const f=form();await searchDjen(f,async()=>{throw Error('HTTP 429');},true);assert.match(f.status.textContent,/não concluída: HTTP 429/);
  await searchDjen(f,async()=>({status:'not_found',events:[]}),true);assert.match(f.status.textContent,/Nenhuma publicação/);
});
test('DJEN: conteúdo externo e links inseguros não são executados',()=>{
  const html=djenPreviewHTML([{text:'<script>alert(1)</script>',url:'javascript:alert(1)',occurredAt:'2026-11-05'}]);
  assert.doesNotMatch(html,/<script>|href=/);assert.match(html,/&lt;script&gt;/);
});
