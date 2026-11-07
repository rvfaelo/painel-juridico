import test from 'node:test';import assert from 'node:assert/strict';
import {emptyState,saveEntity,enqueue} from '../core.js';import {step} from '../runner.js';import {SourceError} from '../sources.js';import {fixtureCnj} from './helpers.mjs';
function context(){let time=100000;const s=emptyState();s.settings.datajud=false;const c=saveEntity(s,'cases',{title:'Teste',cnj:fixtureCnj});enqueue(s,[c.id]);return {s,c,read:async()=>structuredClone(s),mutate:async fn=>fn(s),clock:()=>time,advance:n=>time+=n};}
const event={id:'djen:1',source:'djen',kind:'publication',cnj:fixtureCnj,text:'Original',date:'2026-11-04'};
test('paginação mantém progresso e só conclui após última página',async()=>{
  const ctx=context();const adapters={djen:async j=>({events:[event],count:1,nextCursor:j.cursor===null?2:null,notFound:false})};
  await step({...ctx,adapters});assert.equal(ctx.s.jobs[0].status,'queued');assert.equal(ctx.s.events.length,1);ctx.advance(1000);await step({...ctx,adapters});assert.equal(ctx.s.jobs[0].status,'success');assert.equal(ctx.s.events.length,1);assert.equal(ctx.s.jobs[0].added,1);
});
test('falha posterior mantém página anterior e registra parcial',async()=>{
  const ctx=context();let calls=0;const adapters={djen:async()=>{if(calls++)throw new SourceError('Bloqueio',{action:true});return {events:[event],count:1,nextCursor:2};}};
  await step({...ctx,adapters});ctx.advance(1000);await step({...ctx,adapters});assert.equal(ctx.s.jobs[0].status,'action');assert.equal(ctx.s.events.length,1);assert.equal(ctx.s.jobs[0].count,1);
});
test('consulta DataJud longa nao e duplicada antes do timeout',async()=>{
  const ctx=context();ctx.s.settings.datajud=true;ctx.s.jobs[0].source='datajud';
  let release,calls=0;
  const pending=new Promise(resolve=>release=resolve);
  const adapters={datajud:async()=>{calls++;return pending;}};
  const running=step({...ctx,adapters});
  for(let i=0;i<20&&calls===0;i++)await Promise.resolve();
  ctx.advance(61000);
  assert.equal(await step({...ctx,adapters}),false);
  assert.equal(calls,1);
  release({events:[],count:0,nextCursor:null,notFound:true});
  await running;
  assert.equal(ctx.s.jobs[0].status,'not_found');
});
test('lease expirada permite retomar e cancelar não grava resposta tardia',async()=>{
  const ctx=context();ctx.s.jobs[0].status='running';ctx.s.jobs[0].leaseUntil=1;
  const adapters={djen:async()=>{ctx.s.jobs[0].status='cancelled';return {events:[event],count:1,nextCursor:null};}};
  await step({...ctx,adapters});assert.equal(ctx.s.jobs[0].status,'cancelled');assert.equal(ctx.s.events.length,0);
});
test('resposta atrasada de uma tentativa expirada não altera a nova execução',async()=>{
  const ctx=context();let release;
  const stale=new Promise(resolve=>{release=resolve;});
  let calls=0;
  const adapters={djen:async()=>++calls===1?stale:{events:[event],count:1,nextCursor:null,notFound:false}};
  const old=step({...ctx,adapters});
  for(let i=0;i<10&&ctx.s.jobs[0].status!=='running';i++)await Promise.resolve();
  assert.equal(ctx.s.jobs[0].status,'running');
  const oldRun=ctx.s.jobs[0].runId;
  ctx.advance(46000);
  await step({...ctx,adapters});
  assert.notEqual(ctx.s.jobs[0].runId,oldRun);
  assert.equal(ctx.s.jobs[0].status,'success');
  release({events:[{...event,id:'djen:atrasado'}],count:1,nextCursor:null,notFound:false});
  await old;
  assert.equal(ctx.s.jobs[0].count,1);
  assert.deepEqual(ctx.s.events.map(e=>e.id),['djen:1']);
});
test('retentativas limitadas preservam o erro sem sucesso falso',async()=>{
  const ctx=context(),adapters={djen:async()=>{throw new SourceError('Indisponível',{retryable:true});}};
  for(let i=0;i<3;i++){await step({...ctx,adapters});ctx.advance(60000);}
  assert.equal(ctx.s.jobs[0].status,'error');assert.equal(ctx.s.jobs[0].attempt,3);assert.equal(ctx.s.events.length,0);
});
test('retorno tardio de consulta para CNJ corrigido não contamina outro processo',async()=>{
  const ctx=context();let release;
  const response=new Promise(resolve=>release=resolve);
  const pending=step({...ctx,adapters:{djen:async()=>response}});
  for(let i=0;i<20&&ctx.s.jobs[0].status!=='running';i++)await Promise.resolve();
  assert.equal(ctx.s.jobs[0].status,'running');
  // Construa um CNJ válido para a correção, sem depender da numeração da fonte.
  const {cnj}=await import('./helpers.mjs');
  const changed=cnj(7,'8','19');
  saveEntity(ctx.s,'cases',{...ctx.s.cases[0],cnj:changed,title:'Corrigido',confirmCnjChange:'yes'});
  release({events:[event],count:1,nextCursor:null,notFound:false,snapshots:[{id:'antigo'}]});
  await pending;
  assert.equal(ctx.s.jobs[0].status,'cancelled');
  assert.equal(ctx.s.events.length,0);
  assert.equal(ctx.s.cases[0].sourceInfo?.datajud?.length||0,0);
});
test('fonte desativada cancela filas sem acessar a rede e não mistura resultados em andamento',async()=>{
  const ctx=context();let calls=0;
  ctx.s.settings.djen=false;
  const result=await step({...ctx,adapters:{djen:async()=>{calls++;throw Error('Não deveria acessar');}}});
  assert.equal(result,false);assert.equal(calls,0);
  assert.equal(ctx.s.jobs[0].status,'cancelled');
  const c2=context();let release;
  const pending=new Promise(resolve=>{release=resolve;});
  const running=step({...c2,adapters:{djen:async()=>pending}});
  for(let i=0;i<20&&c2.s.jobs[0].status!=='running';i++)await Promise.resolve();
  assert.equal(c2.s.jobs[0].status,'running');
  c2.s.settings.djen=false;
  release({events:[event],count:1,nextCursor:null,notFound:false});
  await running;
  assert.equal(c2.s.events.length,0);
  assert.equal(c2.s.jobs[0].status,'cancelled');
});
test('arquivar processo cancela consulta em execução antes de importar resultados',async()=>{
  const ctx=context();let release;
  const pending=new Promise(resolve=>{release=resolve;});
  const running=step({...ctx,adapters:{djen:async()=>pending}});
  for(let i=0;i<20&&ctx.s.jobs[0].status!=='running';i++)await Promise.resolve();
  ctx.s.cases[0].archived=true;
  release({events:[event],count:1,nextCursor:null,notFound:false});
  await running;
  assert.equal(ctx.s.jobs[0].status,'cancelled');
  assert.equal(ctx.s.events.length,0);
  const later=context();
  later.s.cases[0].archived=true;let calls=0;
  await step({...later,adapters:{djen:async()=>{calls++;throw Error('Indevido');}}});
  assert.equal(calls,0);
  assert.equal(later.s.jobs[0].status,'cancelled');
});
