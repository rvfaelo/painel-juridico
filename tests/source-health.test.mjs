import test from 'node:test';
import assert from 'node:assert/strict';
import {DIAGNOSTIC_CNJ,checkSourceConnectivity} from '../source-health.js';
import {emptyState,validCnj} from '../core.js';

test('diagnóstico de fontes usa exclusivamente CNJ sintético, não modifica dados nem confunde ausência de hits',async()=>{
  const state=emptyState();state.settings.datajudKey='chave-publica-ficticia';state.settings.oab='12345';state.settings.ufOab='RJ';
  const before=structuredClone(state),calls=[];
  const fetcher=async(url,options)=>{
    calls.push({url:String(url),options});
    if(String(url).includes('api-publica.datajud'))return Response.json({hits:{hits:[],total:{value:0,relation:'eq'}}});
    return Response.json({count:0,items:[]});
  };
  const result=await checkSourceConnectivity(state.settings,fetcher,new Date('2026-11-05T12:00:00Z'));
  assert.equal(validCnj(DIAGNOSTIC_CNJ),true);
  assert.deepEqual(result.results.map(x=>x.status),['reachable','configuration']);
  assert.equal(calls.length,1);
  assert.ok(calls.every(c=>!c.url.includes('12345')&&!c.url.includes('RJ')));
  assert.ok(calls.some(c=>c.url.includes('numeroProcesso='+DIAGNOSTIC_CNJ)));

  assert.equal(JSON.stringify(result).includes(DIAGNOSTIC_CNJ),false);
  assert.equal(JSON.stringify(result).includes('12345'),false);
  assert.deepEqual(state,before);
});

test('diagnóstico distingue HTTP 429 de HTTP 403 e resposta inválida',async()=>{
  const settings={datajudKey:'publica',djenDays:30};
  const report=await checkSourceConnectivity(settings,async url=>
    url.includes('datajud')?new Response('rate limit',{status:429}):new Response('denied',{status:403}));
  assert.deepEqual(report.results.map(x=>x.status),['blocked','configuration']);
  assert.ok(report.results.every(x=>!x.message.includes('rate limit')));
  const unknown=await checkSourceConnectivity(settings,async()=>new Response('<html>bloqueado</html>',{status:200,headers:{'Content-Type':'text/html'}}));
  assert.deepEqual(unknown.results.map(x=>x.status),['unavailable','configuration']);
});

test('ausência de chave pública não dispara chamada ao DataJud',async()=>{
  const urls=[];
  const result=await checkSourceConnectivity({datajudKey:'',djenDays:1},async url=>{
    urls.push(url);return Response.json({count:0,items:[]});
  });
  assert.equal(urls.length,1);
  assert.equal(result.results[0].status,'reachable');
  assert.equal(result.results[1].status,'configuration');
});
