import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STAGES, WORK_OWNERS, WORK_STATUSES,
  JOB_STATES, SERVICE_JOB_STATES, ALL_JOB_STATES, JOB_TRANSITIONS, JOB_STATUS_LABELS,
  JOB_ACTIVE_STATES, JOB_RESULT_STATES, JOB_FAILURE_STATES,
  transitionJob, canTransitionJob,
  setCaseStage, setCaseArchived, assertCaseNotArchived, workOwnerOf, workStatusOf,
  setTaskStage, toggleTaskDone, previousTaskStage,
  createPendingItem, setPendingDone, pendingIsConsistent,
  isBaselineEvent, notificationState
} from '../state-machines.js';
import {
  emptyState, backup, validateBackup, saveEntity, updateCaseWorkflow,
  addCasePending, toggleCasePending,
  STAGES as CORE_STAGES, JOB_STATES as CORE_JOB_STATES, ALL_JOB_STATES as CORE_ALL_JOB_STATES
} from '../core.js';

test('tabela da fila cobre os estados do navegador e mantém terminais sem saída',()=>{
  assert.deepEqual(Object.keys(JOB_TRANSITIONS).sort(),[...JOB_STATES].sort());
  for(const [from,targets] of Object.entries(JOB_TRANSITIONS)){
    assert.ok(Array.isArray(targets),from);
    for(const to of targets)assert.ok(ALL_JOB_STATES.includes(to),`${from} -> ${to}`);
  }
  for(const terminal of ['success','not_found','error','action','cancelled'])assert.deepEqual(JOB_TRANSITIONS[terminal],[]);
  assert.deepEqual(JOB_TRANSITIONS.interrupted,['queued']);
  assert.deepEqual([...JOB_ACTIVE_STATES],['queued','running']);
  assert.ok(JOB_RESULT_STATES.every(state=>JOB_STATES.includes(state)));
  assert.ok(JOB_FAILURE_STATES.every(state=>JOB_RESULT_STATES.includes(state)));
});

test('transitionJob aplica apenas transições declaradas e preserva o patch',()=>{
  const job={id:'job1',status:'queued',message:'Na fila'};
  transitionJob(job,'running',{leaseUntil:123});
  assert.deepEqual([job.status,job.leaseUntil],['running',123]);
  transitionJob(job,'queued',{message:'Próxima página'});
  assert.deepEqual([job.status,job.message],['queued','Próxima página']);
  transitionJob(job,'cancelled',{message:'Fim'});
  assert.equal(job.status,'cancelled');
  assert.throws(()=>transitionJob(job,'running'),/Transição de consulta inválida/);
  assert.throws(()=>transitionJob({status:'queued'},'partial'),/Transição de consulta inválida/);
  assert.throws(()=>transitionJob({status:'queued'},'desconhecido'),/Estado de consulta inválido/);
  assert.throws(()=>transitionJob({status:'desconhecido'},'queued'),/Estado atual da consulta inválido/);
  assert.equal(canTransitionJob('running','success'),true);
  assert.equal(canTransitionJob('success','running'),false);
  assert.equal(canTransitionJob('partial','running'),false);
});

test('vocabulário do serviço tem rótulos e é aceito na restauração de backup',()=>{
  for(const state of [...JOB_STATES,...SERVICE_JOB_STATES]){
    assert.ok(ALL_JOB_STATES.includes(state),state);
    assert.ok(JOB_STATUS_LABELS[state],state);
  }
  assert.equal(new Set(ALL_JOB_STATES).size,ALL_JOB_STATES.length);
  const s=emptyState();
  s.jobs.push({id:'job-service',caseId:'',source:'djen',oab:'123',ufOab:'RJ',status:'partial',
    createdAt:'2026-11-05T12:00:00Z',updatedAt:'2026-11-05T12:00:00Z',cursor:null,
    attempt:0,added:1,count:1,message:'Resultado parcial',leaseUntil:0,nextAt:0});
  assert.equal(validateBackup(backup(s)).jobs[0].status,'partial');
});

test('ciclo do processo valida etapa, arquivamento e valores derivados',()=>{
  const c={id:'case1',stage:'todo',archived:false};
  setCaseStage(c,'doing');
  assert.equal(c.stage,'doing');
  assert.throws(()=>setCaseStage(c,'invalido'),/Etapa inválida/);
  assert.equal(c.stage,'doing');
  setCaseArchived(c,true);
  assert.equal(c.archived,true);
  assert.throws(()=>assertCaseNotArchived(c),/Desarquive/);
  setCaseArchived(c,false);
  assert.equal(c.archived,false);
  assert.doesNotThrow(()=>assertCaseNotArchived(c));
  assert.equal(workOwnerOf({}),'me');
  assert.equal(workOwnerOf({workOwner:'court'}),'court');
  assert.equal(workOwnerOf({workOwner:'invalido'}),'me');
  assert.equal(workStatusOf({}),'todo');
  assert.equal(workStatusOf({workStatus:'ready'}),'ready');
  assert.equal(workStatusOf({workStatus:'invalido'}),'todo');
  const s=emptyState();
  const saved=saveEntity(s,'cases',{title:'Caso de teste',stage:'ready'});
  assert.equal(saved.stage,'ready');
  assert.throws(()=>saveEntity(s,'cases',{id:saved.id,title:'Caso de teste',stage:'invalido'}),/Etapa inválida/);
  saved.archived=true;
  assert.throws(()=>updateCaseWorkflow(s,saved.id,{nextStep:'',workOwner:'me',workStatus:'todo',review:''}),/Desarquive/);
});

test('processo arquivado não aceita mudança de acompanhamento pelo saveEntity',()=>{
  const s=emptyState();
  const c=saveEntity(s,'cases',{title:'Caso arquivado',nextStep:'Aguardar',workOwner:'me',workStatus:'todo',review:'2026-11-10'});
  c.archived=true;
  const renamed=saveEntity(s,'cases',{...c,title:'Caso renomeado'});
  assert.equal(renamed.title,'Caso renomeado');
  assert.throws(()=>saveEntity(s,'cases',{...c,nextStep:'Outro passo'}),/Desarquive/);
  assert.throws(()=>saveEntity(s,'cases',{...c,workOwner:'client'}),/Desarquive/);
  assert.throws(()=>saveEntity(s,'cases',{...c,workStatus:'doing'}),/Desarquive/);
  assert.throws(()=>saveEntity(s,'cases',{...c,review:'2026-11-11'}),/Desarquive/);
});

test('concluir tarefa guarda a etapa anterior e reabrir restaura',()=>{
  const task={id:'task1',title:'Petição',stage:'doing'};
  toggleTaskDone(task);
  assert.deepEqual([task.stage,task.previousStage],['done','doing']);
  toggleTaskDone(task);
  assert.deepEqual([task.stage,'previousStage' in task],['doing',false]);
  const ready={stage:'ready'};
  toggleTaskDone(ready);
  assert.equal(ready.previousStage,'ready');
  const legacy={stage:'done'};
  toggleTaskDone(legacy);
  assert.equal(legacy.stage,'todo');
  assert.equal(previousTaskStage({stage:'ready'}),'ready');
  assert.equal(previousTaskStage({stage:'done',previousStage:'ready'}),'ready');
  assert.equal(previousTaskStage({stage:'done',previousStage:'done'}),'todo');
  const edited={stage:'done',previousStage:'doing'};
  setTaskStage(edited,'todo');
  assert.deepEqual([edited.stage,'previousStage' in edited],['todo',false]);
  assert.throws(()=>setTaskStage({},'invalido'),/tarefa e etapa/);
});

test('saveEntity e backup preservam a etapa anterior da tarefa',()=>{
  const s=emptyState();
  const task=saveEntity(s,'tasks',{title:'Petição',stage:'doing'});
  const done=saveEntity(s,'tasks',{id:task.id,title:task.title,stage:'done'});
  assert.deepEqual([done.stage,done.previousStage],['done','doing']);
  const reopened=saveEntity(s,'tasks',{id:task.id,title:task.title,stage:'doing'});
  assert.deepEqual([reopened.stage,'previousStage' in reopened],['doing',false]);
  assert.throws(()=>saveEntity(s,'tasks',{title:'Tarefa inválida',stage:'invalido'}),/tarefa e etapa/);
  const valid=emptyState();
  valid.tasks.push({id:'task1',title:'Tarefa concluída',stage:'done',previousStage:'doing',due:'',notes:'',manualCheckId:''});
  assert.equal(validateBackup(backup(valid)).tasks[0].previousStage,'doing');
  valid.tasks[0].previousStage='done';
  assert.throws(()=>validateBackup(backup(valid)),/Tarefa inválida/);
});

test('pendência mantém done e completedAt coerentes no reducer e no núcleo',()=>{
  const item=createPendingItem({id:'pending1',title:'Enviar comprovante',createdAt:'2026-11-05T12:00:00Z'});
  assert.deepEqual(item,{id:'pending1',title:'Enviar comprovante',done:false,createdAt:'2026-11-05T12:00:00Z',completedAt:''});
  assert.equal(pendingIsConsistent(item),true);
  setPendingDone(item,true,'2026-11-05T13:00:00Z');
  assert.deepEqual([item.done,item.completedAt],[true,'2026-11-05T13:00:00Z']);
  assert.equal(pendingIsConsistent(item),true);
  setPendingDone(item,false);
  assert.deepEqual([item.done,item.completedAt],[false,'']);
  assert.throws(()=>setPendingDone(item,true),/data de conclusão/);
  assert.equal(pendingIsConsistent({done:true,completedAt:''}),false);
  assert.equal(pendingIsConsistent({done:false,completedAt:'2026-11-05T13:00:00Z'}),false);
  const s=emptyState();
  s.cases.push({id:'case1',title:'Caso',stage:'todo',archived:false,workOwner:'me',workStatus:'todo',pendingItems:[]});
  const pending=addCasePending(s,'case1','Enviar documento');
  toggleCasePending(s,'case1',pending.id);
  assert.equal(pending.done,true);
  assert.ok(pending.completedAt);
  toggleCasePending(s,'case1',pending.id);
  assert.deepEqual([pending.done,pending.completedAt],[false,'']);
});

test('evento distingue linha de base, novidade, conferido e cancelado',()=>{
  const baseline={remote:true,is_new:false,seen:false,localIds:[]};
  assert.equal(isBaselineEvent(baseline),true);
  assert.equal(notificationState(baseline),'baseline');
  assert.equal(notificationState({...baseline,seen:true}),'seen');
  assert.equal(notificationState({...baseline,localIds:['local']}),'new');
  assert.equal(notificationState({...baseline,is_new:true}),'new');
  assert.equal(notificationState({...baseline,remote:false}),'new');
  assert.equal(notificationState({...baseline,publicationStatus:'Cancelada'}),'cancelled');
  assert.equal(isBaselineEvent(null),false);
});

test('core reexporta as mesmas máquinas sem duplicar vocabulário',()=>{
  assert.equal(CORE_STAGES,STAGES);
  assert.deepEqual([...CORE_JOB_STATES],[...JOB_STATES]);
  assert.deepEqual([...CORE_ALL_JOB_STATES],[...ALL_JOB_STATES]);
  assert.deepEqual(Object.keys(WORK_OWNERS),['me','court','other','client']);
  assert.deepEqual(Object.keys(WORK_STATUSES),['todo','doing','ready','done']);
});
