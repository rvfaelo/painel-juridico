import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,saveEntity,mergeEvents,registerManualCheck,registerPayment,auditLocalData} from '../core.js';
import {cnj,fixtureCnj} from './helpers.mjs';

test('diagnóstico de integridade é somente leitura e não retorna dados identificáveis',()=>{
  const s=emptyState(),c=saveEntity(s,'cases',{title:'Nome de pessoa sigiloso',cnj:fixtureCnj});
  saveEntity(s,'tasks',{title:'Tarefa sigilosa',caseId:c.id});
  const fee=saveEntity(s,'fees',{title:'Honorário',caseId:c.id,amount:'120.00'});
  registerPayment(s,{feeId:fee.id,amount:'15.00',date:'2026-11-04'});
  registerManualCheck(s,{caseId:c.id,source:'portal',result:'no_changes',notes:'Consulta conferida'});
  mergeEvents(s,[{id:'djen:fixture',source:'djen',kind:'publication',cnj:fixtureCnj,text:'Publicação sigilosa',date:'2026-11-04'}]);
  const before=structuredClone(s),result=auditLocalData(s);
  assert.deepEqual(s,before);
  assert.deepEqual(result.issues,[]);
  assert.equal(result.counts.cases,1);
  assert.equal(result.counts.events,1);
  assert.ok(!JSON.stringify(result).includes('sigiloso'));
  assert.ok(!JSON.stringify(result).includes(fixtureCnj));
});

test('diagnóstico identifica vínculos quebrados, pagamentos, CNJ e histórico sem os corrigir',()=>{
  const s=emptyState(),c=saveEntity(s,'cases',{title:'Caso',cnj:fixtureCnj});
  const fee=saveEntity(s,'fees',{title:'Honorários',amount:'100',caseId:c.id,paid:'10'});
  saveEntity(s,'tasks',{title:'Tarefa',caseId:c.id});
  mergeEvents(s,[{id:'djen:um',source:'djen',kind:'publication',cnj:fixtureCnj,text:'Publicação',date:'2026-11-04'}]);
  s.tasks[0].caseId='inexistente';
  s.events[0].cnj=cnj(3,'8','19');
  fee.paid=3000;
  s.cases.push({...c,id:'outro-caso'});
  const before=structuredClone(s),result=auditLocalData(s);
  assert.deepEqual(s,before);
  const labels=result.issues.map(x=>x.label);
  assert.ok(labels.some(x=>x.includes('duplicados')));
  assert.ok(labels.some(x=>x.includes('processos inexistentes')));
  assert.ok(labels.some(x=>x.includes('saldos')));
  assert.ok(labels.some(x=>x.includes('CNJ divergente')));
  assert.ok(labels.some(x=>x.includes('estrutura dos dados')));
});
