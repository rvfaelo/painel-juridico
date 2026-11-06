import test from 'node:test';import assert from 'node:assert/strict';
import {parseDatajud,parseDjen,requestJSON,datajud,djen} from '../sources.js';
import {fixtureCnj} from './helpers.mjs';
const dj={hits:{total:{value:1,relation:'eq'},hits:[{_id:'tjrj_1',_source:{numeroProcesso:fixtureCnj,tribunal:'TJRJ',grau:'G1',movimentos:[{codigo:1,nome:'Juntada',dataHora:'2026-11-04T12:00:00',complementosTabelados:[{nome:'Tipo',valor:'Petição'}]}]}}]}};
test('DataJud: normaliza sem misturar texto e datas ou outro processo',()=>{
  const r=parseDatajud(dj,fixtureCnj);assert.equal(r.events.length,1);assert.match(r.events[0].text,/Petição/);assert.equal(r.events[0].kind,'movement');assert.equal(r.nextCursor,null);
  assert.throws(()=>parseDatajud(dj,'00000000000000000000'),/válidos/);assert.throws(()=>parseDatajud({hits:{hits:[]}},fixtureCnj),/desconhecida/);
});
test('DJEN: preserva identificador, teor e hash de certidão, sanitiza texto e detecta resposta incompleta',()=>{
  const input={count:1,items:[{id:15,numero_processo:fixtureCnj,data_disponibilizacao:'2026-11-04',texto:'<p>Decisão &amp; petição</p><script>alert(1)</script>',ativo:false,hash:'qo8LEjMv6g2sAodc5TGKzLJRmrz2A1'}]};
  const r=parseDjen(input);assert.equal(r.events[0].text,'Decisão & petição');assert.equal(r.events[0].publicationStatus,'Cancelada');assert.equal(r.events[0].id,'djen:15');assert.equal(r.events[0].certificateHash,input.items[0].hash);
  assert.equal(parseDjen({count:1,items:[{...input.items[0],hash:'../outro'}]}).events[0].certificateHash,'');
  assert.throws(()=>parseDjen({count:2,items:[]}),/incompleta/);assert.throws(()=>parseDjen({count:10000,items:[]}),/10.000/);assert.throws(()=>parseDjen({status:'erro'}),/desconhecida/);
});
test('fontes rejeitam páginas intermediárias incompletas e páginas acima do limite',()=>{
  const row=dj.hits.hits[0];
  assert.throws(()=>parseDatajud({hits:{total:{value:150,relation:'eq'},hits:[row]}},fixtureCnj),/incompleta/);
  assert.throws(()=>parseDatajud({hits:{total:{value:100,relation:'eq'},hits:Array(101).fill(row)}},fixtureCnj),/incompleta/);
  const item={id:1,numero_processo:fixtureCnj,data_disponibilizacao:'2026-11-04',texto:'Teste'};
  assert.throws(()=>parseDjen({count:150,items:[item]}),/incompleta/);
  assert.throws(()=>parseDjen({count:101,items:Array(101).fill(item)}),/incompleta/);
});
test('erros de rede, bloqueio e limites não viram resultado vazio',async()=>{
  await assert.rejects(()=>requestJSON('https://example.test',{},async()=>new Response('',{status:403})),e=>e.action&&!e.retryable);
  await assert.rejects(()=>requestJSON('https://example.test',{},async()=>new Response('',{status:429,headers:{'Retry-After':'10'}})),e=>e.retryable&&e.retryAfter===10000);
  await assert.rejects(()=>requestJSON('https://example.test',{},async()=>new Response('<html>CAPTCHA</html>')),/JSON/);
});
test('adaptadores usam CNJ, OAB/UF e paginação com autenticação pública configurada',async()=>{
  let seen;
  await assert.rejects(()=>datajud({cnj:fixtureCnj},{datajudKey:''}),/chave/);
  let called=false;
  await assert.rejects(()=>datajud({cnj:fixtureCnj},{datajudKey:'public'},async()=>{called=true;}),/cliente MCP/);
  assert.equal(called,false);
  await djen({oab:'12345A',ufOab:'RJ',periodStart:'2026-11-01',periodEnd:'2026-11-04',cursor:2},{},async url=>{seen=String(url);return Response.json({count:100,items:[]});});
  assert.match(seen,/numeroOab=12345A/);assert.match(seen,/pagina=2/);assert.match(seen,/ufOab=RJ/);
});
test('DataJud rejeita HTTP 200 com timeout interno ou shards falhos',()=>{
  for(const flags of [{timed_out:true},{_shards:{failed:1}}]) {
    for(const hits of [[],dj.hits.hits]) {
      assert.throws(()=>parseDatajud({...flags,hits:{total:0,hits}},fixtureCnj),e=>e.retryable&&/incompleta/.test(e.message));
    }
  }
});
test('navegador nunca consulta DataJud diretamente apos troca para MCP',async()=>{
  let calls=0;
  await assert.rejects(()=>requestJSON('https://api-publica.datajud.cnj.jus.br/api_publica_tjrj/_search',{},async()=>{calls++;}),e=>e.action&&/cliente MCP/.test(e.message));
  assert.equal(calls,0);
});
test('falha de rede explica CORS no modo arquivo local sem inventar resposta',async()=>{
  await assert.rejects(()=>requestJSON('https://example.test',{},async()=>{throw new TypeError('Failed to fetch');}),e=>e.retryable&&/CORS/.test(e.message)&&/DataJud/.test(e.message));
});
