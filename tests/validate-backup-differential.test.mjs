import test from 'node:test';
import assert from 'node:assert/strict';
import {
  backup, emptyState, migrateState, validateBackup,
  TABLES, STAGES, WORK_OWNERS, WORK_STATUSES, JUDICIAL_SYSTEMS, COURTS, COURT_LEVELS,
  PROCESS_SYSTEMS, MANUAL_CHECK_RESULTS, MANUAL_COURT_SOURCES, COVERAGE_RESULTS, JOB_STATES,
  validCnj, validDay, validDateTime, validDatajudDetails, validateCaseHierarchy, digits,
  normalizeDocket, dateKey
} from '../core.js';
import {validStoredDate} from '../safe-dates.js';
import {fixtureCnj} from './helpers.mjs';

function validateBackupOld(value) {
  if(value?.format!=='pauta-backup'||![1,2].includes(value.version)||![1,2].includes(value.state?.schemaVersion))throw Error('Arquivo não é um backup Pauta compatível.');
  const s=migrateState(structuredClone(value.state));
  if(!s.settings||typeof s.settings!=='object'||Array.isArray(s.settings))throw Error('Configurações inválidas no backup.');
  if(typeof s.settings.datajud!=='boolean'||typeof s.settings.djen!=='boolean'||!Number.isInteger(s.settings.djenDays)||s.settings.djenDays<1||s.settings.djenDays>365)throw Error('Fontes inválidas no backup.');
  const text=(v,max=200000)=>typeof v==='string'&&v.length<=max;
  const day=v=>!v||validDay(v);
  for(const table of TABLES) {
    if(!Array.isArray(s[table])||s[table].length>100000)throw Error('Estrutura de backup inválida: '+table);
    const ids=new Set();
    for(const row of s[table]) {
      if(!row||typeof row!=='object'||typeof row.id!=='string'||!row.id||ids.has(row.id))throw Error('Identificadores inválidos ou repetidos em '+table);
      ids.add(row.id);
    }
  }
  const caseIds=new Set(s.cases.map(x=>x.id)),caseById=new Map(s.cases.map(x=>[x.id,x])),clientIds=new Set(s.clients.map(x=>x.id)),jobById=new Map(s.jobs.map(x=>[x.id,x]));
  if(s.coverageSamples.length>2000)throw Error('Limite de amostras de cobertura no backup excedido.');
  for(const item of s.coverageSamples){
    const c=caseById.get(item.caseId);
    const j=item.jobId?jobById.get(item.jobId):null;
    for(const [field,options] of [['court',COURTS],['courtLevel',COURT_LEVELS],['processSystem',PROCESS_SYSTEMS]]){
      if(Object.hasOwn(item,field)&&(!text(item[field],40)||!Object.hasOwn(options,item[field])))throw Error('Classificação da amostra de cobertura inválida no backup.');
    }
    if(!c||!validCnj(item.cnj)||!['djen','datajud'].includes(item.source)||!Object.hasOwn(COVERAGE_RESULTS,item.result)||!validDay(item.referenceDate)||item.referenceDate>dateKey()||!text(item.notes,1500)||item.notes.trim().length<12||typeof item.checkedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(item.checkedAt)||!Number.isFinite(Date.parse(item.checkedAt))||new Date(item.checkedAt).toISOString()!==item.checkedAt||item.jobId!==''&&(!j||j.caseId!==item.caseId||j.cnj!==item.cnj||j.source!==item.source||!['success','not_found','error','action','interrupted'].includes(j.status))||['match','difference'].includes(item.result)&&!['success','not_found'].includes(j?.status))throw Error('Amostra de cobertura inválida no backup.');
  }
  for(const c of s.clients)if(!text(c.name,180)||!c.name.trim()||!text(c.phone||'',40)||!text(c.email||'',180)||!text(c.notes||'',4000))throw Error('Cliente inválido no backup.');
  const cnjs=new Set(),superiorRegisters=new Set();
  for(const c of s.cases) {
    if(!text(c.title,240)||!c.title||!STAGES[c.stage]||!text(c.cnj||'',20)||(c.cnj&&!validCnj(c.cnj))||!day(c.review)||!text(c.notes||'',4000))throw Error('Processo inválido no backup.');
    if(c.nextStep!==undefined&&!text(c.nextStep,500)||c.workOwner!==undefined&&!Object.hasOwn(WORK_OWNERS,c.workOwner)||c.workStatus!==undefined&&!Object.hasOwn(WORK_STATUSES,c.workStatus)||c.reviewedAt!==undefined&&c.reviewedAt!==''&&(!text(c.reviewedAt,40)||!Number.isFinite(Date.parse(c.reviewedAt))||!/^\d{4}-\d\d-\d\dT/.test(c.reviewedAt)))throw Error('Acompanhamento do processo inválido no backup.');
    if(c.pendingItems!==undefined){
      if(!Array.isArray(c.pendingItems)||c.pendingItems.length>80)throw Error('Pendências do processo inválidas no backup.');
      const pendingIds=new Set();
      for(const item of c.pendingItems){
        if(!item||typeof item.id!=='string'||!item.id||pendingIds.has(item.id)||!text(item.title,240)||!item.title.trim()||typeof item.done!=='boolean'||!text(item.createdAt,40)||!Number.isFinite(Date.parse(item.createdAt))||!text(item.completedAt,40)||item.completedAt&&!Number.isFinite(Date.parse(item.completedAt))||item.done!==!!item.completedAt)throw Error('Pendência inválida no backup.');
        pendingIds.add(item.id);
      }
    }
    if((c.plaintiff!==undefined&&!text(c.plaintiff,400))||(c.defendant!==undefined&&!text(c.defendant,400)))throw Error('Partes do processo inválidas no backup.');
    if(c.datajudDetails!==undefined&&c.datajudDetails!==null&&!validDatajudDetails(c.datajudDetails,c.cnj))throw Error('Metadados DataJud inválidos no backup.');
    if(c.judicialSystem!==undefined&&(!Object.hasOwn(JUDICIAL_SYSTEMS,c.judicialSystem)||c.judicialSystem&&(!c.cnj||c.cnj.slice(13,16)!=='819')))throw Error('Sistema judicial inválido no backup.');
    try{
      const classified={};
      for(const key of ['court','courtLevel','processSystem','parentCaseId','docketNumber','originReference']){
        classified[key]=Object.hasOwn(c,key)?c[key]:'';
      }
      validateCaseHierarchy(s,c.id,classified);
    }
    catch{throw Error('Vínculo ou classificação judicial inválida no backup.');}
    if(c.manualCheckedAt!==undefined&&c.manualCheckedAt!==''&&(typeof c.manualCheckedAt!=='string'||!Number.isFinite(Date.parse(c.manualCheckedAt))||!/^\d{4}-\d\d-\d\dT/.test(c.manualCheckedAt)))throw Error('Data da conferência manual inválida no backup.');
    if(c.manualChecks!==undefined){
      if(!Array.isArray(c.manualChecks)||c.manualChecks.length>500)throw Error('Histórico de conferência manual inválido.');
      const ids=new Set();
      for(const item of c.manualChecks){
        const legacy=item?.court===undefined;
        const sourceOk=legacy?(validCnj(item.cnj)&&digits(item.cnj).slice(13,16)==='819'&&Object.hasOwn(JUDICIAL_SYSTEMS,item.source)&&!!item.source):(MANUAL_COURT_SOURCES[item.court]?.includes(item.source)&&typeof item.cnj==='string'&&(!item.cnj||validCnj(item.cnj))&&text(item.docketNumber,100)&&(!!item.docketNumber||!!item.cnj));
        if(!item||typeof item!=='object'||typeof item.id!=='string'||!item.id||ids.has(item.id)||!sourceOk||!Object.hasOwn(MANUAL_CHECK_RESULTS,item.result)||!text(item.notes,2000)||(['change','attention','unavailable'].includes(item.result)&&!item.notes.trim())||typeof item.checkedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(item.checkedAt)||!Number.isFinite(Date.parse(item.checkedAt))||new Date(item.checkedAt).toISOString()!==item.checkedAt)throw Error('Registro de conferência manual inválido no backup.');
        ids.add(item.id);
      }
    }
    if(c.cnj&&cnjs.has(c.cnj))throw Error('CNJ duplicado no backup.');
    if(c.cnj)cnjs.add(c.cnj);
    if(['stj','stf'].includes(c.court)&&c.docketNumber){
      const key=c.court+':'+normalizeDocket(c.docketNumber);
      if(superiorRegisters.has(key))throw Error('Registro superior duplicado no backup.');
      superiorRegisters.add(key);
    }
    if(c.clientId&&!clientIds.has(c.clientId))throw Error('Vínculo de cliente ausente.');
  }
  for(const table of ['tasks','appointments','fees','events','jobs'])for(const row of s[table])if(row.caseId&&!caseIds.has(row.caseId))throw Error('Vínculo de processo ausente.');
  const usedManualChecks=new Set();
  for(const t of s.tasks){
    if(!text(t.title,240)||!t.title||!STAGES[t.stage]||!day(t.due))throw Error('Tarefa inválida.');
    if(t.manualCheckId!==undefined){
      if(!text(t.manualCheckId,100))throw Error('Origem da tarefa inválida.');
      if(t.manualCheckId){
        const source=caseById.get(t.caseId);
        if(!source?.manualChecks?.some(x=>x.id===t.manualCheckId)||usedManualChecks.has(t.manualCheckId))throw Error('Vínculo da conferência na tarefa inválido.');
        usedManualChecks.add(t.manualCheckId);
      }
    }
  }
  for(const a of s.appointments)if(!text(a.title,240)||!a.title||!validDateTime(a.when))throw Error('Compromisso inválido.');
  for(const f of s.fees)if(!Number.isSafeInteger(f.amount)||!Number.isSafeInteger(f.paid)||f.amount<=0||f.paid<0||f.paid>f.amount)throw Error('Honorário inválido.');
  for(const f of s.fees)if(!text(f.title,240)||!f.title||!day(f.due))throw Error('Honorário inválido.');
  const feeIds=new Set(s.fees.map(f=>f.id)),paymentById=new Map(s.payments.map(p=>[p.id,p])),paidByFee=new Map(s.fees.map(f=>[f.id,0]));
  for(const p of s.payments){
    if(!feeIds.has(p.feeId)||!['receipt','reversal'].includes(p.kind)||!Number.isSafeInteger(p.amount)||p.amount<=0||!validDay(p.date)||!text(p.notes||'',4000))throw Error('Recebimento inválido no backup.');
    paidByFee.set(p.feeId,paidByFee.get(p.feeId)+(p.kind==='reversal'?-p.amount:p.amount));
  }
  const reversed=new Set();
  for(const p of s.payments)if(p.kind==='reversal'){
    const original=paymentById.get(p.reverses);
    if(!original||original.kind!=='receipt'||original.feeId!==p.feeId||original.amount!==p.amount||p.date<original.date||reversed.has(original.id))throw Error('Estorno inválido no backup.');reversed.add(original.id);
  }
  for(const f of s.fees)if(paidByFee.get(f.id)!==f.paid)throw Error('Saldo financeiro inconsistente no backup.');
  for(const d of s.documents)if(!caseIds.has(d.caseId)||!text(d.name,200)||!d.name||!text(d.mime,80)||d.createdAt!==undefined&&!validStoredDate(d.createdAt)||!Number.isInteger(d.size)||d.size<=0||d.size>5*1024*1024||!/^([a-f0-9]{64})$/.test(d.sha256||''))throw Error('Anexo inválido no backup.');
  for(const j of s.jobs)if(!JOB_STATES.includes(j.status)||!['datajud','djen'].includes(j.source)||!text(j.updatedAt,40)||Number.isNaN(Date.parse(j.updatedAt))||j.needsManualRetry!==undefined&&typeof j.needsManualRetry!=='boolean')throw Error('Consulta inválida.');
  for(const j of s.jobs){
    for(const k of ['periodStart','periodEnd'])if(j[k]!==undefined&&j[k]!==''&&!validDay(j[k]))throw Error('Período de consulta inválido no backup.');
    if(j.periodStart&&j.periodEnd&&j.periodStart>j.periodEnd)throw Error('Período de consulta invertido no backup.');
  }
  for(const e of s.events){
    if(!['datajud','djen'].includes(e.source)||!['movement','publication'].includes(e.kind)||!text(e.text)||!text(e.date,40)||Number.isNaN(Date.parse(e.date))||!text(e.discoveredAt,40)||Number.isNaN(Date.parse(e.discoveredAt)))throw Error('Histórico inválido.');
    if(e.caseId&&(!validCnj(e.cnj)||digits(e.cnj)!==caseById.get(e.caseId)?.cnj))throw Error('Histórico vinculado a outro CNJ no backup.');
  }
  const result=structuredClone(s);
  result.settings={...emptyState().settings,...s.settings,datajudKey:''};
  result.jobs=result.jobs.map(x=>({...x,status:['queued','running'].includes(x.status)?'interrupted':x.status}));
  return result;
}

function validBaseState() {
  const s = emptyState();
  s.clients.push({id:'client1', name:'Cliente Exemplo', phone:'', email:'', notes:''});
  s.cases.push({
    id:'case1', title:'Caso Exemplo', cnj:fixtureCnj, clientId:'client1',
    plaintiff:'Autor Exemplo', defendant:'Réu Exemplo', stage:'todo',
    review:'2026-11-10', notes:'Observação do caso', nextStep:'Aguardar manifestação',
    workOwner:'me', workStatus:'todo', reviewedAt:'2026-11-05T12:00:00Z',
    court:'tjrj', courtLevel:'first', processSystem:'pje',
    parentCaseId:'', docketNumber:'', originReference:'',
    pendingItems:[{id:'pending1', title:'Enviar comprovante', done:false,
      createdAt:'2026-11-05T12:00:00Z', completedAt:''}],
    manualChecks:[{id:'manual1', court:'tjrj', source:'portal', cnj:fixtureCnj,
      docketNumber:'', result:'no_changes', notes:'Conferido no portal oficial',
      checkedAt:'2026-11-05T12:00:00.000Z'}],
    datajudDetails:{cnj:fixtureCnj, recordId:'record1', tribunal:'TJRJ', grau:'G1',
      sistema:'PJe', classe:'Procedimento comum', orgao:'1ª Vara Cível',
      dataAjuizamento:'2025-01-01', assuntos:['Direito Civil'],
      sourceUpdatedAt:'2026-11-05T12:00:00Z'}
  });
  s.tasks.push({id:'task1', caseId:'case1', title:'Tarefa Exemplo', stage:'todo',
    due:'2026-11-10', notes:'', manualCheckId:''});
  s.appointments.push({id:'appt1', caseId:'case1', title:'Audiência Exemplo',
    when:'2026-11-10T10:00', notes:''});
  s.fees.push({id:'fee1', caseId:'case1', title:'Honorário Exemplo', amount:100000,
    paid:10000, due:'2026-11-10', notes:''});
  s.payments.push({id:'pay1', feeId:'fee1', kind:'receipt', amount:10000,
    date:'2026-11-05', notes:'Pagamento parcial', createdAt:'2026-11-05T12:00:00Z'});
  s.documents.push({id:'doc1', caseId:'case1', name:'anexo.txt', mime:'text/plain',
    size:3, sha256:'a'.repeat(64), createdAt:'2026-11-05T12:00:00.000Z'});
  s.jobs.push({id:'job1', caseId:'case1', cnj:fixtureCnj, source:'djen',
    status:'success', createdAt:'2026-11-05T12:00:00Z', updatedAt:'2026-11-05T12:00:00Z',
    cursor:null, attempt:0, added:0, count:1, message:'Concluída', leaseUntil:0,
    nextAt:0, periodStart:'2026-11-01', periodEnd:'2026-11-05'});
  s.events.push({id:'djen:event1', caseId:'case1', source:'djen', kind:'publication',
    cnj:fixtureCnj, date:'2026-11-05', text:'Publicação fictícia de teste',
    discoveredAt:'2026-11-05T12:00:00Z', seen:false});
  s.coverageSamples.push({id:'cov1', caseId:'case1', cnj:fixtureCnj, source:'djen',
    result:'match', referenceDate:'2026-11-05', notes:'Amostra conferida manualmente',
    checkedAt:'2026-11-05T12:00:00.000Z', jobId:'job1'});
  return s;
}

function outcome(fn, input) {
  try { return {ok:true, value:JSON.stringify(fn(input))}; }
  catch (error) { return {ok:false, error:error.message}; }
}

test('validateBackup refatorado mantém resultado idêntico ao congelado', () => {
  const base = backup(validBaseState());
  assert.deepEqual(outcome(validateBackup, base), outcome(validateBackupOld, base));

  const cases = [];
  const add = (label, mutate) => cases.push({label, mutate});
  add('format', x => { x.format = 'outro'; });
  add('version', x => { x.version = 99; });
  add('schemaVersion', x => { x.state.schemaVersion = 99; });
  add('settings.delete', x => { delete x.state.settings; });
  add('settings.array', x => { x.state.settings = []; });
  add('settings.datajud', x => { x.state.settings.datajud = 'sim'; });
  add('settings.djenDays', x => { x.state.settings.djenDays = 0; });

  const tables = ['clients','cases','tasks','appointments','fees','payments','documents','events','jobs','coverageSamples'];
  for (const table of tables) {
    const rows = base.state[table];
    if (!rows.length) continue;
    for (let i = 0; i < rows.length; i++) {
      for (const key of Object.keys(rows[i])) {
        add(table + '.' + i + '.' + key + '.delete', x => { delete x.state[table][i][key]; });
        add(table + '.' + i + '.' + key + '.null', x => { x.state[table][i][key] = null; });
        add(table + '.' + i + '.' + key + '.number', x => { x.state[table][i][key] = 123; });
        add(table + '.' + i + '.' + key + '.array', x => { x.state[table][i][key] = []; });
        add(table + '.' + i + '.' + key + '.object', x => { x.state[table][i][key] = {}; });
      }
    }
    add(table + '.duplicate-id', x => { x.state[table].push({...x.state[table][0]}); });
  }

  add('case.clientId.missing', x => { x.state.cases[0].clientId = 'missing'; });
  add('task.caseId.missing', x => { x.state.tasks[0].caseId = 'missing'; });
  add('appointment.caseId.missing', x => { x.state.appointments[0].caseId = 'missing'; });
  add('fee.caseId.missing', x => { x.state.fees[0].caseId = 'missing'; });
  add('document.caseId.missing', x => { x.state.documents[0].caseId = 'missing'; });
  add('job.caseId.missing', x => { x.state.jobs[0].caseId = 'missing'; });
  add('payment.feeId.missing', x => { x.state.payments[0].feeId = 'missing'; });
  add('task.manualCheckId.missing', x => { x.state.tasks[0].manualCheckId = 'missing'; });
  add('case.parentCaseId.self', x => { x.state.cases[0].parentCaseId = 'case1'; });
  add('event.case.cnj.mismatch', x => { x.state.events[0].cnj = '00000000000000000000'; });
  add('coverage.job.missing', x => { x.state.coverageSamples[0].jobId = 'missing'; });
  add('coverage.reference.future', x => { x.state.coverageSamples[0].referenceDate = '2999-01-01'; });

  add('cases.limit', x => { x.state.cases = Array.from({length:100001}, () => null); });
  add('coverage.limit', x => { x.state.coverageSamples = Array.from({length:2001}, () => ({})); });
  add('pending.limit', x => { x.state.cases[0].pendingItems = Array.from({length:81}, () => ({})); });
  add('manualChecks.limit', x => { x.state.cases[0].manualChecks = Array.from({length:501}, () => ({})); });
  add('title.limit', x => { x.state.cases[0].title = 'x'.repeat(241); });
  add('notes.limit', x => { x.state.cases[0].notes = 'x'.repeat(4001); });
  add('event.text.limit', x => { x.state.events[0].text = 'x'.repeat(200001); });
  add('coverage.notes.limit', x => { x.state.coverageSamples[0].notes = 'x'.repeat(1501); });
  add('proto.case', x => { Object.defineProperty(x.state.cases[0], '__proto__', {value:{polluted:true}, enumerable:true, configurable:true}); });
  add('constructor.case', x => { x.state.cases[0].constructor = 'x'; });
  add('proto.settings', x => { Object.defineProperty(x.state.settings, '__proto__', {value:{polluted:true}, enumerable:true, configurable:true}); });
  add('constructor.settings', x => { x.state.settings.constructor = 'x'; });

  assert.ok(cases.length >= 500, 'Esperados ao menos 500 casos; obtidos ' + cases.length);
  for (const item of cases) {
    const input = structuredClone(base);
    try { item.mutate(input); } catch { continue; }
    assert.deepEqual(outcome(validateBackup, input), outcome(validateBackupOld, input), item.label);
  }
});
