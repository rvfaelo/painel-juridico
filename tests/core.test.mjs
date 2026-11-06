import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,saveEntity,cnjChangeImpact,registerManualCheck,sameManualIdentity,pendingManualReviews,pendingSourceIssues,pendingOabIssue,retrySourceJob,retryOabJob,validCnj,tribunalAlias,formatCnj,enqueue,enqueueOab,mergeEvents,reconcileEventLinks,backup,validateBackup,overview,cents} from '../core.js';
import {cnj,fixtureCnj} from './helpers.mjs';
import {taskView} from '../core.js';

test('tarefas em aberto, concluídas e todas preservam registros e permitem reabertura',()=>{
  const tasks=[{id:'a',title:'Revisão da ação',stage:'todo'},{id:'b',title:'Revisão da ação',stage:'done'},
    {id:'c',title:'Petição',stage:'doing'},{id:'d',title:'Protocolo',stage:'ready'}];
  const before=JSON.stringify(tasks);
  assert.deepEqual(taskView(tasks).rows.map(t=>t.id),['a','c','d']);
  assert.deepEqual(taskView(tasks,'revisao','done').rows.map(t=>t.id),['b']);
  assert.deepEqual(taskView(tasks,' REVISAO ','all').counts,{open:1,done:1,all:2});
  assert.equal(taskView(tasks,'inexistente').rows.length,0);
  assert.equal(JSON.stringify(tasks),before);
  tasks[1].stage='todo';assert.equal(taskView(tasks,'','done').rows.length,0);
  assert.equal(taskView(tasks).rows.length,4);
  assert.throws(()=>taskView(tasks,'','outro'),/Filtro de tarefas/);
});
test('CNJ: valida verificadores e identifica tribunal sem aceitar número incorreto',()=>{
  assert.equal(validCnj(fixtureCnj),true);assert.equal(validCnj(formatCnj(fixtureCnj)),true);assert.equal(validCnj(fixtureCnj.slice(0,7)+'00'+fixtureCnj.slice(9)),false);assert.equal(tribunalAlias(fixtureCnj),'tjrj');assert.equal(tribunalAlias(cnj(1,'4','02')),'trf2');assert.equal(tribunalAlias(cnj(1,'5','01')),'trt1');
});
test('CNJ: aliases DataJud para TJs, TRFs, TRTs, TREs e tribunais superiores',()=>{
  for(const [branch,court,alias] of [
    ['8','01','tjac'],['8','07','tjdft'],['8','27','tjto'],
    ['4','01','trf1'],['4','06','trf6'],['5','00','tst'],['5','24','trt24'],
    ['6','00','tse'],['6','07','tre-dft'],['6','19','tre-rj'],
    ['3','00','stj'],['7','00','stm'],['9','13','tjmmg'],['9','21','tjmrs'],['9','26','tjmsp']
  ])assert.equal(tribunalAlias(cnj(1,branch,court)),alias,`${branch}.${court}`);
  for(const [branch,court] of [['1','00'],['8','28'],['4','07'],['5','25'],['6','28'],['9','19']])
    assert.equal(tribunalAlias(cnj(1,branch,court)),null,`${branch}.${court}`);
  assert.equal(tribunalAlias(fixtureCnj.slice(0,7)+'00'+fixtureCnj.slice(9)),null);
});
test('processos em tribunais e graus diferentes mantêm CNJs e eventos independentes',()=>{
  const s=emptyState();
  const origin=saveEntity(s,'cases',{title:'Origem fictícia TJSP',cnj:cnj(101,'8','26'),court:'tjsp',courtLevel:'first',processSystem:'esaj'});
  const appeal=saveEntity(s,'cases',{title:'Apelação fictícia TJSP',cnj:cnj(102,'8','26'),court:'tjsp',courtLevel:'second',processSystem:'eproc',parentCaseId:origin.id});
  const superior=saveEntity(s,'cases',{title:'Recurso fictício STJ',cnj:cnj(103,'3','00'),court:'stj',courtLevel:'superior',docketNumber:'REsp fictício 000',parentCaseId:appeal.id});
  assert.equal(superior.parentCaseId,appeal.id);
  assert.notEqual(origin.cnj,appeal.cnj);
  assert.throws(()=>saveEntity(s,'cases',{...origin,parentCaseId:superior.id}),/circular/);
  assert.throws(()=>saveEntity(s,'cases',{...appeal,parentCaseId:'ausente'}),/não encontrado/);
  assert.throws(()=>saveEntity(s,'cases',{...appeal,court:'stj',courtLevel:'jef'}),/incompatível/);
  const restored=validateBackup(backup(s));
  assert.equal(restored.cases.find(c=>c.id===superior.id).docketNumber,'REsp fictício 000');
  const broken=backup(s);broken.state.cases.find(c=>c.id===origin.id).parentCaseId=superior.id;
  assert.throws(()=>validateBackup(broken),/Vínculo ou classificação/);
  const jef=saveEntity(s,'cases',{title:'JEF fictício',cnj:cnj(104,'4','02'),court:'trf2',courtLevel:'jef',processSystem:'pje'});
  const panel=saveEntity(s,'cases',{title:'Turma recursal federal',cnj:cnj(105,'4','02'),court:'trf2',courtLevel:'federal_panel',parentCaseId:jef.id});
  const statePanel=saveEntity(s,'cases',{title:'Turma recursal estadual',cnj:cnj(106,'8','19'),court:'tjrj',courtLevel:'state_panel'});
  assert.notEqual(panel.courtLevel,statePanel.courtLevel);
  const stf=saveEntity(s,'cases',{title:'Recurso STF',court:'stf',courtLevel:'superior',parentCaseId:superior.id,docketNumber:'RE fictício'});
  assert.equal(stf.cnj,'');
  assert.equal(validateBackup(backup(s)).cases.length,7);
});
test('conferências manuais de TRF2, TJSP, STJ e STF preservam tribunal, identidade e backup',()=>{
  const s=emptyState();
  const federal=saveEntity(s,'cases',{title:'JEF teste',cnj:cnj(211,'4','02'),court:'trf2',courtLevel:'jef',processSystem:'eproc'});
  const state=saveEntity(s,'cases',{title:'TJSP teste',cnj:cnj(212,'8','26'),court:'tjsp',courtLevel:'second',processSystem:'esaj'});
  const higher=saveEntity(s,'cases',{title:'STJ teste',cnj:cnj(213,'3','00'),court:'stj',courtLevel:'superior'});
  const supreme=saveEntity(s,'cases',{title:'STF teste',court:'stf',courtLevel:'superior',docketNumber:'RE fictício 213'});
  const checks=[
    registerManualCheck(s,{caseId:federal.id,source:'eproc',result:'attention',notes:'Conferir documento fictício.'}),
    registerManualCheck(s,{caseId:state.id,source:'esaj',result:'no_changes'}),
    registerManualCheck(s,{caseId:higher.id,source:'portal',result:'change',notes:'Observação manual simulada.'}),
    registerManualCheck(s,{caseId:supreme.id,source:'portal',result:'unavailable',notes:'Portal não respondeu na simulação.'})
  ];
  assert.deepEqual(checks.map(c=>c.court),['trf2','tjsp','stj','stf']);
  assert.equal(checks[3].cnj,'');
  assert.equal(checks[3].docketNumber,'RE fictício 213');
  assert.ok(sameManualIdentity(supreme,checks[3]));
  assert.equal(pendingManualReviews(s).length,3);
  assert.throws(()=>registerManualCheck(s,{caseId:higher.id,source:'eproc',result:'no_changes'}),/portal disponível/);
  const restored=validateBackup(backup(s));
  assert.equal(restored.cases.find(c=>c.id===supreme.id).manualChecks[0].court,'stf');
  const tampered=backup(s);
  tampered.state.cases.find(c=>c.id===supreme.id).manualChecks[0].source='esaj';
  assert.throws(()=>validateBackup(tampered),/Registro de conferência manual inválido/);
  saveEntity(s,'cases',{...supreme,docketNumber:'RE fictício 999'});
  assert.equal(pendingManualReviews(s).length,2,'Conferência de registro anterior não deve aparecer como pendência atual.');
  assert.equal(s.cases.find(c=>c.id===supreme.id).manualCheckedAt,'');
  assert.ok(s.cases.find(c=>c.id===supreme.id).manualChecks.some(c=>c.docketNumber==='RE fictício 213'),'Histórico não deve ser apagado.');
});
test('cadastros e atualização preservam notas e evitam duplicidade CNJ',()=>{
  const s=emptyState(),client=saveEntity(s,'clients',{name:'Cliente fictício'}),c=saveEntity(s,'cases',{title:'Caso fictício',cnj:fixtureCnj,clientId:client.id,notes:'Nota manual'});
  assert.throws(()=>saveEntity(s,'cases',{title:'Outro',cnj:fixtureCnj}),/já está/);
  assert.throws(()=>saveEntity(s,'cases',{title:'Outro',clientId:'ausente'}),/Cliente/);
  saveEntity(s,'cases',{...c,title:'Novo título'});assert.equal(s.cases[0].notes,'Nota manual');assert.equal(s.cases.length,1);
});
test('sistema do TJRJ e registro de conferência são preservados e validados no backup',()=>{
  const s=emptyState(),c=saveEntity(s,'cases',{title:'Caso TJRJ',cnj:fixtureCnj,judicialSystem:'eproc'});
  assert.equal(c.judicialSystem,'eproc');
  c.manualCheckedAt='2026-11-05T12:00:00.000Z';
  saveEntity(s,'cases',{...c,title:'Renomeado'});
  assert.equal(s.cases[0].manualCheckedAt,c.manualCheckedAt);
  assert.equal(validateBackup(backup(s)).cases[0].judicialSystem,'eproc');
  assert.equal(validateBackup(backup(s)).cases[0].manualCheckedAt,c.manualCheckedAt);
  assert.throws(()=>saveEntity(s,'cases',{...c,judicialSystem:'inexistente'}),/Sistema judicial/);
  assert.throws(()=>saveEntity(s,'cases',{title:'Outra justiça',cnj:cnj(2,'4','02'),judicialSystem:'eproc'}),/somente para processos do TJRJ/);
  const tampered=backup(s);tampered.state.cases[0].manualCheckedAt='data inválida';
  assert.throws(()=>validateBackup(tampered),/conferência manual inválida/);
  const old=backup(s);delete old.state.cases[0].judicialSystem;delete old.state.cases[0].manualCheckedAt;
  assert.equal(validateBackup(old).cases[0].title,'Renomeado');
});
test('conferências manuais guardam resultados e histórico, sem alterar eventos externos',()=>{
  const s=emptyState(),c=saveEntity(s,'cases',{title:'Caso TJRJ',cnj:fixtureCnj,judicialSystem:'pje'});
  assert.throws(()=>registerManualCheck(s,{caseId:c.id,source:'pje',result:'attention',notes:''}),/Descreva/);
  assert.throws(()=>registerManualCheck(s,{caseId:c.id,source:'outro',result:'no_changes'}),/portal/);
  assert.throws(()=>registerManualCheck(s,{caseId:c.id,source:'pje',result:'inventado'}),/resultado/);
  const first=registerManualCheck(s,{caseId:c.id,source:'pje',result:'no_changes',notes:'Sem alterações observadas.'});
  const next=registerManualCheck(s,{caseId:c.id,source:'pje',result:'attention',notes:'Verificar prazo no sistema oficial.'});
  assert.equal(s.cases[0].manualChecks.length,2);assert.equal(s.events.length,0);
  assert.equal(s.cases[0].manualCheckedAt,next.checkedAt);
  assert.notEqual(first.id,next.id);
  const copy=validateBackup(backup(s));assert.equal(copy.cases[0].manualChecks.length,2);
  const tampered=backup(s);tampered.state.cases[0].manualChecks[1].result='inventado';
  assert.throws(()=>validateBackup(tampered),/conferência manual inválido/);
  const duplicate=backup(s);duplicate.state.cases[0].manualChecks[1].id=duplicate.state.cases[0].manualChecks[0].id;
  assert.throws(()=>validateBackup(duplicate),/conferência manual inválido/);
  const invalidDate=backup(s);invalidDate.state.cases[0].manualChecks[0].checkedAt='2026-02-30T12:00:00.000Z';
  assert.throws(()=>validateBackup(invalidDate),/conferência manual inválido/);
  saveEntity(s,'cases',{...c,cnj:cnj(7,'8','19'),confirmCnjChange:'yes'});
  assert.equal(s.cases[0].manualCheckedAt,'');assert.equal(s.cases[0].manualChecks.length,2);
  assert.equal(validateBackup(backup(s)).cases[0].manualChecks[0].cnj,fixtureCnj);
});
test('conferência que requer ação aparece na visão geral até ser vinculada a uma tarefa',()=>{
  const s=emptyState(),c=saveEntity(s,'cases',{title:'TJRJ',cnj:fixtureCnj});
  const a=registerManualCheck(s,{caseId:c.id,source:'portal',result:'attention',notes:'Analisar publicação.'});
  assert.deepEqual(pendingManualReviews(s).map(x=>x.checkId),[a.id]);
  assert.throws(()=>saveEntity(s,'tasks',{title:'Errada',caseId:c.id,manualCheckId:'inexistente'}),/Conferência de origem/);
  const t=saveEntity(s,'tasks',{title:'Revisar andamento',caseId:c.id,manualCheckId:a.id,notes:a.notes});
  assert.equal(t.due,'');assert.equal(t.manualCheckId,a.id);
  assert.deepEqual(pendingManualReviews(s),[]);
  assert.throws(()=>saveEntity(s,'tasks',{title:'Duplicada',caseId:c.id,manualCheckId:a.id}),/Já existe uma tarefa/);
  assert.equal(validateBackup(backup(s)).tasks[0].manualCheckId,a.id);
  const invalid=backup(s);invalid.state.tasks[0].manualCheckId='inexistente';
  assert.throws(()=>validateBackup(invalid),/Vínculo da conferência/);
  const noChanges=registerManualCheck(s,{caseId:c.id,source:'portal',result:'no_changes',notes:''});
  assert.ok(noChanges.id);assert.deepEqual(pendingManualReviews(s),[]);
  const b=registerManualCheck(s,{caseId:c.id,source:'portal',result:'unavailable',notes:'Portal indisponível.'});
  assert.deepEqual(pendingManualReviews(s).map(x=>x.checkId),[b.id]);
  s.cases[0].archived=true;assert.deepEqual(pendingManualReviews(s),[]);
  s.cases[0].archived=false;assert.deepEqual(pendingManualReviews(s).map(x=>x.checkId),[b.id]);
  assert.equal(s.events.length,0);
});
test('fila não duplica consultas ativas e não inclui pré-processual',()=>{
  const s=emptyState(),a=saveEntity(s,'cases',{title:'Processo',cnj:fixtureCnj}),b=saveEntity(s,'cases',{title:'Pré-processual'});s.settings.datajud=true;
  assert.equal(enqueue(s,[a.id,b.id]),2);assert.equal(enqueue(s,[a.id]),0);assert.equal(s.jobs.length,2);
  s.settings.oab='12345A';s.settings.ufOab='RJ';assert.equal(enqueueOab(s),1);assert.equal(enqueueOab(s),0);
});
test('falhas pendentes são isoladas por CNJ e fonte e retentativa não apaga histórico',()=>{
  const s=emptyState(),c=saveEntity(s,'cases',{title:'TJRJ',cnj:fixtureCnj});s.settings.datajud=true;
  assert.equal(enqueue(s,[c.id]),2);
  const djen=s.jobs.find(j=>j.source==='djen'),datajud=s.jobs.find(j=>j.source==='datajud');
  djen.status='action';djen.message='Acesso bloqueado';
  datajud.status='not_found';
  assert.deepEqual(pendingSourceIssues(s).map(x=>x.jobId),[djen.id]);
  assert.equal(retrySourceJob(s,djen.id),1);
  const issues=pendingSourceIssues(s);assert.equal(issues.length,1);assert.equal(issues[0].retrying,true);
  assert.equal(retrySourceJob(s,djen.id),0);
  assert.equal(s.jobs.length,3);
  const retry=s.jobs.at(-1);assert.equal(retry.source,'djen');assert.equal(retry.status,'queued');
  retry.status='success';assert.deepEqual(pendingSourceIssues(s),[]);
  assert.throws(()=>retrySourceJob(s,djen.id),/mais recente/);
  retry.status='error';retry.message='Instabilidade';assert.deepEqual(pendingSourceIssues(s).map(x=>x.jobId),[retry.id]);
  s.settings.djen=false;assert.deepEqual(pendingSourceIssues(s),[]);
  assert.throws(()=>retrySourceJob(s,retry.id),/desativada/);
  s.settings.djen=true;c.archived=true;assert.deepEqual(pendingSourceIssues(s),[]);
  c.archived=false;saveEntity(s,'cases',{...c,cnj:cnj(7,'8','19'),confirmCnjChange:'yes'});
  assert.deepEqual(pendingSourceIssues(s),[]);
  assert.throws(()=>retrySourceJob(s,retry.id),/alterado/);
  assert.equal(s.jobs.length,3);
});
test('consulta não localizada não é falha, erro persistente só some após conclusão da mesma fonte',()=>{
  const s=emptyState(),c=saveEntity(s,'cases',{title:'TJRJ',cnj:fixtureCnj});
  enqueue(s,[c.id]);const first=s.jobs[0];first.status='error';first.message='Falha de rede';
  assert.equal(pendingSourceIssues(s).length,1);
  assert.equal(enqueue(s,[c.id]),1);assert.equal(pendingSourceIssues(s)[0].retrying,true);
  s.jobs.at(-1).status='cancelled';assert.equal(pendingSourceIssues(s)[0].retrying,false);
  assert.equal(enqueue(s,[c.id]),1);s.jobs.at(-1).status='not_found';
  assert.deepEqual(pendingSourceIssues(s),[]);
});
test('falha de busca OAB fica visível e pode ser repetida apenas para a inscrição configurada',()=>{
  const s=emptyState();s.settings.oab='12345';s.settings.ufOab='RJ';
  assert.equal(enqueueOab(s),1);const old=s.jobs[0];old.status='action';old.message='HTTP 403';old.periodStart='2026-11-01';old.periodEnd='2026-11-05';
  assert.equal(pendingOabIssue(s).jobId,old.id);
  assert.equal(retryOabJob(s,old.id),1);
  const next=s.jobs[1];assert.equal(next.oab,'12345');assert.equal(next.ufOab,'RJ');
  assert.equal(next.periodStart,'2026-11-01');assert.equal(next.periodEnd,'2026-11-05');
  assert.equal(pendingOabIssue(s).retrying,true);
  assert.equal(retryOabJob(s,old.id),0);
  assert.equal(s.jobs.length,2);
  next.status='success';assert.equal(pendingOabIssue(s),null);
  assert.throws(()=>retryOabJob(s,old.id),/mais recente/);
  next.status='error';assert.equal(pendingOabIssue(s).jobId,next.id);
  s.settings.oab='67890';assert.equal(pendingOabIssue(s),null);
  assert.throws(()=>retryOabJob(s,next.id),/alterada/);
  s.settings.oab='12345';s.settings.djen=false;assert.equal(pendingOabIssue(s),null);
  assert.throws(()=>retryOabJob(s,next.id),/desativado/);
});
test('retentativa OAB sem período anterior usa período atual; consultas não localizadas não são alertas',()=>{
  const s=emptyState();s.settings.oab='12345A';s.settings.ufOab='RJ';
  enqueueOab(s);const j=s.jobs[0];j.status='error';
  assert.equal(retryOabJob(s,j.id),1);
  assert.equal(s.jobs[1].periodStart,undefined);assert.equal(s.jobs[1].periodEnd,undefined);
  s.jobs[1].status='not_found';assert.equal(pendingOabIssue(s),null);
  assert.throws(()=>enqueueOab(s,{periodStart:'2026-02-30'}),/Período inicial/);
  assert.throws(()=>enqueueOab(s,{periodStart:'2026-11-05',periodEnd:'2026-11-01'}),/invertido/);
});
test('consulta por OAB respeita fonte desligada e DJEN retentado preserva janela original',()=>{
  const s=emptyState();s.settings.oab='123456';s.settings.ufOab='RJ';s.settings.djen=false;
  assert.throws(()=>enqueueOab(s),/DJEN está desativado/);
  assert.equal(s.jobs.length,0);
  s.settings.djen=true;
  const c=saveEntity(s,'cases',{title:'Processo demonstração',cnj:fixtureCnj});
  enqueue(s,[c.id],['djen']);const original=s.jobs[0];
  original.status='action';original.periodStart='2026-10-01';original.periodEnd='2026-10-15';
  assert.equal(retrySourceJob(s,original.id),1);
  const retry=s.jobs[1];
  assert.equal(retry.periodStart,'2026-10-01');
  assert.equal(retry.periodEnd,'2026-10-15');
  retry.status='error';retry.periodEnd='2026-09-01';
  const before=structuredClone(s);
  assert.throws(()=>retrySourceJob(s,retry.id),/Período da consulta anterior inválido/);
  assert.deepEqual(s,before);
});
test('validação de backup rejeita vincular publicação a outro CNJ',()=>{
  const s=emptyState(),a=saveEntity(s,'cases',{title:'Caso A',cnj:fixtureCnj}),b=saveEntity(s,'cases',{title:'Caso B',cnj:cnj(900,'8','19')});
  mergeEvents(s,[{id:'djen:ref',source:'djen',kind:'publication',cnj:a.cnj,caseId:a.id,date:'2026-11-04',text:'Fonte de teste'}]);
  const forged=backup(s);forged.state.events[0].caseId=b.id;
  assert.throws(()=>validateBackup(forged),/Histórico vinculado a outro CNJ/);
});
test('backup bloqueia registros de tribunal superior repetidos e marca pendências para revisão manual',()=>{
  const s=emptyState();
  const first=saveEntity(s,'cases',{title:'Recurso 1',court:'stj',courtLevel:'superior',docketNumber:'REsp 123456'});
  assert.throws(()=>saveEntity(s,'cases',{title:'Recurso 2',court:'stj',courtLevel:'superior',docketNumber:'  resp  123456 ' }),/já cadastrado/);
  const b=backup(s);
  b.state.cases.push({...first,id:'outro-recurso',docketNumber:' resp   123456 '});
  assert.throws(()=>validateBackup(b),/Registro superior duplicado/);
  const pending=emptyState(),c=saveEntity(pending,'cases',{title:'Teste',cnj:fixtureCnj});
  enqueue(pending,[c.id],['djen']);
  const snap=backup(pending);
  assert.equal(snap.state.jobs[0].status,'interrupted');
  assert.equal(snap.state.jobs[0].needsManualRetry,true);
  assert.equal(validateBackup(snap).jobs[0].needsManualRetry,true);
  snap.state.jobs[0].needsManualRetry='yes';
  assert.throws(()=>validateBackup(snap),/Consulta inválida/);
});
test('novidades mantêm reconhecimento e deduplicam por origem',()=>{
  const s=emptyState(),event={id:'djen:1',source:'djen',kind:'publication',cnj:fixtureCnj,text:'Original',date:'2026-11-04'};
  assert.equal(mergeEvents(s,[event]),1);s.events[0].seen=true;
  assert.equal(mergeEvents(s,[{...event,text:'Retificado',publicationStatus:'Cancelada'}]),0);assert.equal(s.events[0].seen,true);assert.equal(s.events[0].text,'Retificado');
});
test('cadastro ou importação posterior recupera publicações por CNJ sem alterar conferência',()=>{
  const s=emptyState(),other=cnj(2,'8','19');
  const one={id:'djen:anterior',source:'djen',kind:'publication',cnj:fixtureCnj,date:'2026-11-03',text:'Publicação por OAB'};
  const unrelated={...one,id:'djen:outro',cnj:other};
  const unknown={...one,id:'djen:sem-cnj',cnj:''};
  assert.equal(mergeEvents(s,[one,unrelated,unknown]),3);
  s.events[0].seen=true;
  const c=saveEntity(s,'cases',{title:'Cadastro posterior',cnj:fixtureCnj});
  assert.equal(s.events[0].caseId,c.id);assert.equal(s.events[0].seen,true);
  assert.equal(s.events[1].caseId,'');assert.equal(s.events[2].caseId,'');
  const another=saveEntity(s,'cases',{title:'Importado por CNJ',cnj:other});
  assert.equal(s.events[1].caseId,another.id);
  assert.equal(reconcileEventLinks(s),0);
  s.events[0].caseId='';s.events[1].caseId=c.id;
  assert.equal(reconcileEventLinks(s),2);
  assert.equal(s.events[0].caseId,c.id);assert.equal(s.events[1].caseId,another.id);
  assert.equal(validateBackup(backup(s)).events[0].caseId,c.id);
});
test('correção do CNJ separa históricos e cancela consultas pendentes antigas',()=>{
  const s=emptyState(),next=cnj(7,'8','19');
  const c=saveEntity(s,'cases',{title:'Número antigo',cnj:fixtureCnj});
  c.sourceInfo={datajud:[{id:'snapshot-antigo'}]};
  mergeEvents(s,[{id:'djen:anterior',source:'djen',kind:'publication',cnj:fixtureCnj,date:'2026-11-03',text:'A'},
    {id:'djen:novo',source:'djen',kind:'publication',cnj:next,date:'2026-11-04',text:'B'}]);
  s.events[0].seen=true;
  enqueue(s,[c.id]);const staleJob=s.jobs[0];staleJob.status='running';
  saveEntity(s,'cases',{...c,cnj:next,title:'Número corrigido',confirmCnjChange:'yes'});
  assert.equal(s.events[0].caseId,'');assert.equal(s.events[0].seen,true);
  assert.equal(s.events[1].caseId,c.id);
  assert.deepEqual(s.cases[0].sourceInfo,{});
  assert.equal(staleJob.status,'cancelled');assert.match(staleJob.message,/CNJ/);
  mergeEvents(s,[{id:'djen:anterior',source:'djen',kind:'publication',cnj:fixtureCnj,date:'2026-11-03',text:'Atualizada'}],c.id);
  assert.equal(s.events[0].caseId,'');assert.equal(s.events[0].seen,true);
  assert.equal(validateBackup(backup(s)).cases[0].cnj,next);
});
test('alterar CNJ existente exige confirmação explícita e apresenta impactos sem mutação prévia',()=>{
  const s=emptyState(),next=cnj(8,'8','19');
  const c=saveEntity(s,'cases',{title:'Caso com vínculos',cnj:fixtureCnj});
  const task=saveEntity(s,'tasks',{title:'Conferir autos',caseId:c.id});
  const appointment=saveEntity(s,'appointments',{title:'Reunião',caseId:c.id,when:'2026-11-06T14:30'});
  const fee=saveEntity(s,'fees',{title:'Honorários',caseId:c.id,amount:'150',paid:'25'});
  const receipt=s.payments[0];
  s.documents.push({id:'doc-fixture',caseId:c.id,name:'anexo.txt',mime:'text/plain',size:9,sha256:'a'.repeat(64)});
  registerManualCheck(s,{caseId:c.id,source:'portal',result:'attention',notes:'Rever os autos.'});
  mergeEvents(s,[{id:'djen:protegido',source:'djen',kind:'publication',cnj:fixtureCnj,date:'2026-11-04',text:'Publicação fictícia'}]);
  enqueue(s,[c.id]);
  assert.deepEqual(cnjChangeImpact(s,c.id),{tasks:1,appointments:1,fees:1,payments:1,documents:1,manualChecks:1,events:1,jobs:1});
  const snapshot=structuredClone(s);
  assert.throws(()=>saveEntity(s,'cases',{...c,cnj:next}),/Confirme a correção do CNJ/);
  assert.throws(()=>saveEntity(s,'cases',{...c,cnj:next,confirmCnjChange:'on'}),/Confirme a correção do CNJ/);
  assert.deepEqual(s,snapshot);
  saveEntity(s,'cases',{...c,cnj:next,confirmCnjChange:'yes'});
  assert.equal(s.tasks[0].id,task.id);assert.equal(s.tasks[0].caseId,c.id);
  assert.equal(s.appointments[0].id,appointment.id);
  assert.equal(s.fees[0].id,fee.id);assert.equal(s.payments[0].id,receipt.id);
  assert.equal(s.documents[0].caseId,c.id);
  assert.equal(s.cases[0].manualChecks.length,1);
  assert.equal(s.events[0].caseId,'');
  assert.equal(s.jobs[0].status,'cancelled');
  assert.equal(validateBackup(backup(s)).cases[0].cnj,next);
  const before=saveEntity(s,'cases',{title:'Pré-processual'});
  assert.equal(saveEntity(s,'cases',{...before,cnj:cnj(9,'8','19')}).cnj,cnj(9,'8','19'));
});
test('financeiro guarda centavos sem permitir recebido maior que total',()=>{
  const s=emptyState();saveEntity(s,'fees',{title:'Contrato',amount:'1200.35',paid:'200.10'});
  assert.deepEqual(overview(s),{expected:120035,received:20010,balance:100025,unseen:0});assert.equal(cents('0.29'),29);
  assert.throws(()=>cents('1.123'));assert.throws(()=>saveEntity(s,'fees',{title:'Contrato',amount:'1',paid:'2'}));
});
test('backup tem restauração fiel, exclui chave e rejeita vínculos inválidos',()=>{
  const s=emptyState(),c=saveEntity(s,'cases',{title:'Teste',cnj:fixtureCnj});s.settings.datajudKey='public-key';saveEntity(s,'tasks',{title:'Revisar',caseId:c.id});enqueue(s,[c.id]);
  const exported=backup(s);assert.equal(exported.state.settings.datajudKey,'');assert.equal(exported.state.jobs.length,1);
  assert.equal(exported.state.jobs[0].status,'interrupted','Consultas pendentes ficam rastreáveis, mas não reiniciam automaticamente.');
  assert.equal(exported.state.jobs[0].needsManualRetry,true,'Restauração exige uma nova tentativa explícita.');
  assert.equal(s.jobs[0].status,'queued','O backup não modifica a fila original.');
  const restored=validateBackup(JSON.parse(JSON.stringify(exported)));assert.equal(restored.cases[0].cnj,fixtureCnj);assert.equal(restored.tasks[0].caseId,c.id);
  restored.tasks[0].caseId='inexistente';assert.throws(()=>validateBackup({...exported,state:restored}),/Vínculo/);
  assert.throws(()=>validateBackup({format:'outro'}));
  const malformed=backup(s);malformed.state.tasks[0].stage='desconhecido';assert.throws(()=>validateBackup(malformed),/Tarefa/);
  const brokenEvent=backup(s);brokenEvent.state.events.push({id:'bad',caseId:c.id,source:'djen',kind:'publication',text:'Teste',date:null});assert.throws(()=>validateBackup(brokenEvent),/Histórico/);
});
