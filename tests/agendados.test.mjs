import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState,saveEntity,updateCaseWorkflow,markCaseReviewed,
  addCasePending,toggleCasePending,removeCasePending,backup,validateBackup
} from '../core.js';
import {scheduleGroup,scheduledCases} from '../agendados.js';

test('próximo passo, responsável, situação, revisão e visto são persistidos sem alterar consulta judicial',()=>{
  const s=emptyState(),c=saveEntity(s,'cases',{title:'Caso de teste'});
  updateCaseWorkflow(s,c.id,{nextStep:'Aguardar comprovante',workOwner:'client',workStatus:'doing',review:'2026-11-10'});
  assert.deepEqual([c.nextStep,c.workOwner,c.workStatus,c.review],['Aguardar comprovante','client','doing','2026-11-10']);
  markCaseReviewed(s,c.id);
  assert.match(c.reviewedAt,/^\d{4}-\d\d-\d\dT/);
  assert.equal(s.events.length,0);
  assert.equal(s.jobs.length,0);
  assert.equal(c.manualCheckedAt,undefined,'Visto na ficha não equivale à conferência jurídica das fontes.');
  const restored=validateBackup(backup(s));
  assert.equal(restored.cases[0].nextStep,'Aguardar comprovante');
  assert.equal(restored.cases[0].workOwner,'client');
  assert.equal(restored.cases[0].reviewedAt,c.reviewedAt);
  saveEntity(s,'cases',{id:c.id,title:'Caso renomeado',review:c.review});
  assert.equal(s.cases[0].nextStep,'Aguardar comprovante','Edição da ficha não apaga o acompanhamento.');
  saveEntity(s,'cases',{id:c.id,title:'Caso renomeado',nextStep:'Conferir documento enviado',workOwner:'me',workStatus:'ready',review:c.review});
  assert.equal(s.cases[0].workStatus,'ready','Edição geral também consegue atualizar a situação da providência.');
  assert.equal(s.cases[0].nextStep,'Conferir documento enviado');
});

test('pendências aceitam criar, concluir, reabrir e remover, preservando timestamps no backup',()=>{
  const s=emptyState(),c=saveEntity(s,'cases',{title:'Cliente fictício'});
  const item=addCasePending(s,c.id,'Enviar comprovante das custas');
  assert.equal(c.pendingItems.length,1);
  assert.equal(item.done,false);
  toggleCasePending(s,c.id,item.id);
  assert.equal(item.done,true);
  assert.match(item.completedAt,/^\d{4}-/);
  assert.equal(validateBackup(backup(s)).cases[0].pendingItems[0].done,true);
  toggleCasePending(s,c.id,item.id);
  assert.equal(item.done,false);
  assert.equal(item.completedAt,'');
  assert.equal(removeCasePending(s,c.id,item.id).id,item.id);
  assert.equal(c.pendingItems.length,0);
  assert.throws(()=>toggleCasePending(s,c.id,item.id),/não encontrada/);
});

test('validação proíbe valores inválidos e operações de processos arquivados',()=>{
  const s=emptyState(),c=saveEntity(s,'cases',{title:'Teste'});
  for(const [field,value] of [['workOwner','none'],['workStatus','inventado'],['review','2026-02-30']]){
    const form={nextStep:'Teste',workOwner:'me',workStatus:'todo',review:''};form[field]=value;
    assert.throws(()=>updateCaseWorkflow(s,c.id,form));
  }
  assert.throws(()=>updateCaseWorkflow(s,c.id,{nextStep:'x'.repeat(501),workOwner:'me',workStatus:'todo',review:''}),/500/);
  assert.throws(()=>addCasePending(s,c.id,''),/pendência/);
  assert.throws(()=>addCasePending(s,c.id,'x'.repeat(241)),/240/);
  const safe=backup(s);
  safe.state.cases[0].pendingItems=[{id:'pendente',title:'<img src=x>',done:true,createdAt:'2026-11-05T00:00:00Z',completedAt:''}];
  assert.throws(()=>validateBackup(safe),/Pendência inválida/);
  c.archived=true;
  assert.throws(()=>addCasePending(s,c.id,'Pedir documento'),/Desarquive/);
  assert.throws(()=>markCaseReviewed(s,c.id),/Desarquive/);
});

test('agrupamento de agendados respeita data local, responsável e busca por pendência',()=>{
  const s=emptyState();
  const clients=[saveEntity(s,'clients',{name:'Maria Luz'}),saveEntity(s,'clients',{name:'João Porto'})];
  const rows=[
    ['Atrasado','2026-11-04','me','Conferir autos'],
    ['Hoje','2026-11-05','client','Cobrar documento'],
    ['Semana','2026-11-12','court','Aguardar despacho'],
    ['Depois','2026-11-13','other','Pedir manifestação'],
    ['Sem revisão','','me',''],
  ].map(([title,review,owner,nextStep],i)=>{
    const c=saveEntity(s,'cases',{title,clientId:clients[i%2].id,review});
    updateCaseWorkflow(s,c.id,{nextStep,workOwner:owner,workStatus:'todo',review});
    return c;
  });
  addCasePending(s,rows[1].id,'Comprovante de pagamento');
  rows[4].archived=true;
  assert.equal(scheduleGroup(rows[0],'2026-11-05'),'overdue');
  assert.equal(scheduleGroup(rows[1],'2026-11-05'),'today');
  assert.equal(scheduleGroup(rows[2],'2026-11-05'),'week');
  assert.equal(scheduleGroup(rows[3],'2026-11-05'),'later');
  assert.equal(scheduleGroup(rows[4],'2026-11-05'),'undated');
  const options={today:'2026-11-05',clientName:id=>clients.find(x=>x.id===id)?.name||''};
  const all=scheduledCases(s.cases,options);
  assert.deepEqual([all.overview.overdue,all.overview.today,all.overview.week,all.overview.pending],[1,1,1,1]);
  assert.equal(all.rows.length,4,'Arquivados não entram em Agendados.');
  assert.deepEqual(all.counts,{all:4,me:1,court:1,other:1,client:1});
  assert.equal(scheduledCases(s.cases,{...options,owner:'client'}).rows.length,1);
  assert.equal(scheduledCases(s.cases,{...options,query:'comprovante'}).rows.length,1);
  assert.equal(scheduledCases(s.cases,{...options,query:'joao'}).rows.length,2);
  assert.equal(scheduledCases(s.cases,{...options,sort:'client'}).total,4);
});
