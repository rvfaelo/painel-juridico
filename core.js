import {validStoredDate} from './safe-dates.js';
export const VERSION = '0.6.2';
export function taskView(tasks,query='',filter='open'){
  if(!['open','done','all'].includes(filter))throw Error('Filtro de tarefas inválido.');
  const fold=v=>String(v??'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR');
  const needle=fold(query).trim(),matches=tasks.filter(t=>fold(t.title).includes(needle));
  const done=matches.filter(t=>t.stage==='done').length;
  return {counts:{open:matches.length-done,done,all:matches.length},
    rows:matches.filter(t=>filter==='all'||(filter==='done'?t.stage==='done':t.stage!=='done'))};
}
export const SCHEMA = 2;
// Public credential published by CNJ, verified on 2026-11-05. Not a personal secret.
// The user can replace it if CNJ rotates the key.
export const PUBLIC_DATAJUD_KEY = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';
export const STAGES = {todo:'A fazer',doing:'Fazendo',ready:'Pronto para protocolar',done:'Concluído'};
export const WORK_OWNERS = Object.freeze({me:'Comigo',court:'Com o juízo',other:'Parte contrária',client:'Com o cliente'});
export const WORK_STATUSES = Object.freeze({todo:'A fazer',doing:'Fazendo',ready:'Pronto para protocolar',done:'Feito'});
export const JUDICIAL_SYSTEMS = { '':'Não identificado',eproc:'eproc',pje:'PJe',projudi:'Projudi',portal:'Consulta processual TJRJ'};
export const COURTS = {'':'Não informado',tjrj:'TJRJ',trf2:'TRF2',tjsp:'TJSP',stj:'STJ',stf:'STF',other:'Outro tribunal'};
export const COURT_LEVELS = {'':'Não informado',first:'1º grau',second:'2º grau',jec:'Juizado especial estadual',state_panel:'Turma recursal estadual',jef:'Juizado especial federal (JEF)',federal_panel:'Turma recursal federal',superior:'Tribunal superior',other:'Outro grau'};
export const PROCESS_SYSTEMS = {'':'Não informado',eproc:'eproc',pje:'PJe',projudi:'Projudi',esaj:'e-SAJ',portal:'Portal próprio',other:'Outro sistema'};
export const normalizeDocket = value => String(value??'').trim().replace(/\s+/gu,' ').toLocaleLowerCase('pt-BR');
export function validDatajudDetails(details,cnj) {
  if(!details||typeof details!=='object'||Array.isArray(details)||!validCnj(cnj)||details.cnj!==cnj)return false;
  const limits={recordId:150,tribunal:35,grau:35,sistema:100,classe:180,orgao:180,dataAjuizamento:45,sourceUpdatedAt:45};
  if(Object.entries(limits).some(([key,max])=>typeof details[key]!=='string'||details[key].length>max))return false;
  if(!Array.isArray(details.assuntos)||details.assuntos.length>20||details.assuntos.some(x=>typeof x!=='string'||x.length>180))return false;
  return true;
}
export const MANUAL_COURT_SOURCES = Object.freeze({
  tjrj:Object.freeze(['portal','eproc','pje','projudi']),
  trf2:Object.freeze(['portal','eproc','pje']),
  tjsp:Object.freeze(['portal','eproc','esaj']),
  stj:Object.freeze(['portal']),
  stf:Object.freeze(['portal'])
});
// Legacy records have no court/docket fields and were limited to TJRJ.
export function manualCheckCourt(c){
  if(c?.court)return c.court;
  return validCnj(c?.cnj)&&digits(c.cnj).slice(13,16)==='819'?'tjrj':'';
}
export function sameManualIdentity(c,item){
  if(!c||!item||String(item.cnj||'')!==String(c.cnj||''))return false;
  if(item.court===undefined)return manualCheckCourt(c)==='tjrj';
  return item.court===manualCheckCourt(c)&&String(item.docketNumber||'')===String(c.docketNumber||'');
}
const courtLevels = {tjrj:['first','second','jec','state_panel','other'],tjsp:['first','second','jec','state_panel','other'],trf2:['first','second','jef','federal_panel','other'],stj:['superior','other'],stf:['superior','other']};
export function validateCaseHierarchy(state,caseId,fields) {
  const {court='',courtLevel='',processSystem='',parentCaseId='',docketNumber='',originReference=''}=fields;
  if(!Object.hasOwn(COURTS,court)||!Object.hasOwn(COURT_LEVELS,courtLevel)||!Object.hasOwn(PROCESS_SYSTEMS,processSystem))throw Error('Tribunal, grau ou sistema de tramitação inválido.');
  if(court&&court!=='other'&&courtLevel&&!courtLevels[court].includes(courtLevel))throw Error('Grau judicial incompatível com o tribunal informado.');
  if(typeof parentCaseId!=='string'||typeof docketNumber!=='string'||docketNumber.length>100||typeof originReference!=='string'||originReference.length>120)throw Error('Referência processual inválida ou muito longa.');
  if(parentCaseId){
    if(parentCaseId===caseId)throw Error('Um processo não pode ser sua própria origem.');
    const found=state.cases.find(c=>c.id===parentCaseId);
    if(!found)throw Error('Processo de origem não encontrado.');
    const visited=new Set([caseId]);let current=found;
    while(current){if(visited.has(current.id))throw Error('Vínculo processual circular não permitido.');visited.add(current.id);current=current.parentCaseId?state.cases.find(c=>c.id===current.parentCaseId):null;}
  }
  return true;
}
export const MANUAL_CHECK_RESULTS = {no_changes:'Sem novidade identificada',change:'Movimentação identificada',attention:'Requer acompanhamento',unavailable:'Consulta não concluída'};
export const COVERAGE_RESULTS = {match:'Coincidente na amostra',difference:'Divergência observada',unavailable:'Fonte indisponível',inconclusive:'Comparação inconclusiva'};
export const TABLES = ['clients','cases','tasks','appointments','fees','events','jobs','payments','documents','coverageSamples'];
export const JOB_STATES = ['queued','running','success','not_found','error','action','cancelled','interrupted'];
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const digits = value => String(value ?? '').replace(/\D/g,'');
export const clean = (value, max=4000) => String(value ?? '').trim().slice(0,max);
export function dateKey(date=new Date()) { return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(date); }
export function emptyState() {
  return {schemaVersion:SCHEMA,revision:0,clients:[],cases:[],tasks:[],appointments:[],fees:[],events:[],jobs:[],payments:[],documents:[],coverageSamples:[],settings:{datajudKey:PUBLIC_DATAJUD_KEY,datajud:false,djen:true,djenDays:30,oab:'',ufOab:'',autoUpdateEnabled:true,autoUpdateTimes:'08:00,18:00',autoUpdateLast:''}};
}
export function validDay(value) {
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\d$/.test(value))return false;
  const d=new Date(value+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;
}
export function validDateTime(value) {
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value))return false;
  const [day,time]=value.split('T');
  const [hour,minute]=time.split(':').map(Number);
  return validDay(day)&&hour>=0&&hour<=23&&minute>=0&&minute<=59;
}
function caseForWorkflow(state,caseId){
  const c=state.cases.find(row=>row.id===caseId);
  if(!c)throw Error('Processo não encontrado para acompanhamento.');
  if(c.archived)throw Error('Desarquive o processo para editar o acompanhamento.');
  return c;
}
export function updateCaseWorkflow(state,caseId,input){
  const c=caseForWorkflow(state,caseId);
  if(typeof input.nextStep!=='string'||input.nextStep.length>500)throw Error('Descreva o próximo passo em até 500 caracteres.');
  if(!Object.hasOwn(WORK_OWNERS,input.workOwner))throw Error('Escolha um responsável válido.');
  if(!Object.hasOwn(WORK_STATUSES,input.workStatus))throw Error('Escolha uma situação válida para o próximo passo.');
  if(typeof input.review!=='string'||input.review&&!validDay(input.review))throw Error('Informe uma data válida para revisar.');
  Object.assign(c,{nextStep:clean(input.nextStep,500),workOwner:input.workOwner,workStatus:input.workStatus,review:input.review,updatedAt:now()});
  return c;
}
export function markCaseReviewed(state,caseId){
  const c=caseForWorkflow(state,caseId);
  c.reviewedAt=now();c.updatedAt=c.reviewedAt;
  return c;
}
export function addCasePending(state,caseId,title){
  const c=caseForWorkflow(state,caseId);
  if(typeof title!=='string'||!title.trim()||title.length>240)throw Error('Descreva a pendência em até 240 caracteres.');
  if(!Array.isArray(c.pendingItems))c.pendingItems=[];
  if(c.pendingItems.length>=80)throw Error('Máximo de 80 pendências por processo.');
  const item={id:uid(),title:clean(title,240),done:false,createdAt:now(),completedAt:''};
  c.pendingItems.push(item);c.updatedAt=now();return item;
}
export function toggleCasePending(state,caseId,pendingId){
  const c=caseForWorkflow(state,caseId);
  const item=(c.pendingItems||[]).find(row=>row.id===pendingId);
  if(!item)throw Error('Pendência não encontrada neste processo.');
  item.done=!item.done;item.completedAt=item.done?now():'';c.updatedAt=now();return item;
}
export function removeCasePending(state,caseId,pendingId){
  const c=caseForWorkflow(state,caseId);
  const index=(c.pendingItems||[]).findIndex(row=>row.id===pendingId);
  if(index<0)throw Error('Pendência não encontrada neste processo.');
  const [item]=c.pendingItems.splice(index,1);c.updatedAt=now();return item;
}
export function migrateState(input) {
  if(!input)return emptyState();
  if(input.schemaVersion===2){
    const state=input.coverageSamples===undefined?{...input,coverageSamples:[]}:input;
    // Versões anteriores à atualização automática não tinham estas chaves.
    state.settings={...emptyState().settings,...(state.settings&&typeof state.settings==='object'?state.settings:{})};
    return state;
  }
  if(input.schemaVersion!==1)throw Error('Versão do banco não suportada.');
  // Deterministic migration: the old received total becomes one documented opening entry.
  const state=structuredClone(input);state.payments=[];state.documents=[];state.coverageSamples=[];
  for(const f of state.fees||[])if(f.paid>0)state.payments.push({id:'opening:'+f.id,feeId:f.id,amount:f.paid,kind:'receipt',date:dateKey(),notes:'Saldo recebido importado da versão 0.1. A data deste lançamento é a da migração; as datas originais dos recebimentos não estavam disponíveis.',opening:true,createdAt:now()});
  state.schemaVersion=2;state.revision=(state.revision||0)+1;
  state.settings={...emptyState().settings,...(state.settings&&typeof state.settings==='object'?state.settings:{})};
  return state;
}
export function feeReceived(state,feeId) { return state.payments.filter(p=>p.feeId===feeId).reduce((sum,p)=>sum+(p.kind==='reversal'?-p.amount:p.amount),0); }
export function registerPayment(state,input) {
  const fee=state.fees.find(f=>f.id===input.feeId);if(!fee)throw Error('Honorário não encontrado.');
  const amount=cents(input.amount);if(amount<=0||amount>fee.amount-feeReceived(state,fee.id))throw Error('Recebimento deve ser positivo e não pode superar o saldo.');
  if(!validDay(input.date))throw Error('Informe a data válida do recebimento.');
  const p={id:uid(),feeId:fee.id,amount,kind:'receipt',date:input.date,notes:clean(input.notes),createdAt:now()};state.payments.push(p);fee.paid=feeReceived(state,fee.id);return p;
}
export function reversePayment(state,id,input) {
  const original=state.payments.find(p=>p.id===id&&p.kind==='receipt');if(!original)throw Error('Recebimento não encontrado.');
  if(state.payments.some(p=>p.reverses===id))throw Error('Este recebimento já foi estornado.');
  if(!validDay(input.date)||input.date<original.date)throw Error('Data de estorno inválida ou anterior ao recebimento.');
  if(!clean(input.notes))throw Error('Informe o motivo do estorno.');
  const p={id:uid(),feeId:original.feeId,amount:original.amount,kind:'reversal',reverses:id,date:input.date,notes:clean(input.notes),createdAt:now()};state.payments.push(p);state.fees.find(f=>f.id===p.feeId).paid=feeReceived(state,p.feeId);return p;
}
export function registerManualCheck(state,input) {
  const c=state.cases.find(x=>x.id===input.caseId);
  const court=manualCheckCourt(c);
  if(!c||!MANUAL_COURT_SOURCES[court]||!(validCnj(c.cnj)||String(c.docketNumber||'').trim()))throw Error('Informe um tribunal atendido e um CNJ válido ou registro processual.');
  const source=String(input.source||''),result=String(input.result||''),notes=clean(input.notes,2000);
  if(!MANUAL_COURT_SOURCES[court].includes(source))throw Error('Selecione um portal disponível para o tribunal informado.');
  if(!Object.hasOwn(MANUAL_CHECK_RESULTS,result))throw Error('Selecione o resultado da conferência.');
  if(['change','attention','unavailable'].includes(result)&&!notes)throw Error('Descreva o resultado da conferência.');
  if(String(input.notes||'').trim().length>2000)throw Error('Observações excedem 2.000 caracteres.');
  if(!Array.isArray(c.manualChecks))c.manualChecks=[];
  if(c.manualChecks.length>=500)throw Error('Limite de 500 conferências por processo. Exporte um backup antes de prosseguir.');
  const record={id:uid(),cnj:c.cnj||'',docketNumber:c.docketNumber||'',court,source,result,notes,checkedAt:now()};
  c.manualChecks.push(record);c.manualCheckedAt=record.checkedAt;c.updatedAt=now();
  return record;
}
export function latestCoverageJob(state,caseId,source) {
  const c=state.cases.find(x=>x.id===caseId);
  if(!c||!validCnj(c.cnj)||!['djen','datajud'].includes(source))return null;
  return [...state.jobs].reverse().find(j=>j.caseId===c.id&&j.cnj===c.cnj&&j.source===source&&['success','not_found','action','error','interrupted'].includes(j.status))||null;
}
export function registerCoverageSample(state,input) {
  const c=state.cases.find(x=>x.id===input.caseId);
  if(!c||!validCnj(c.cnj))throw Error('Selecione um processo cadastrado com CNJ válido.');
  const source=String(input.source||''),result=String(input.result||''),referenceDate=String(input.referenceDate||''),notes=clean(input.notes,1500);
  if(!['djen','datajud'].includes(source))throw Error('Selecione a fonte a comparar.');
  if(!Object.hasOwn(COVERAGE_RESULTS,result))throw Error('Selecione o resultado da comparação.');
  if(!validDay(referenceDate)||referenceDate>dateKey())throw Error('Informe a data da conferência no portal oficial.');
  if(String(input.notes||'').trim().length>1500||notes.length<12)throw Error('Descreva o que foi comparado no portal oficial (12 a 1.500 caracteres).');
  const job=latestCoverageJob(state,c.id,source);
  if(['match','difference'].includes(result)&&!['success','not_found'].includes(job?.status))throw Error('Execute primeiro uma consulta concluída nessa fonte antes de declarar coincidência ou divergência.');
  if(!Array.isArray(state.coverageSamples))state.coverageSamples=[];
  if(state.coverageSamples.length>=2000)throw Error('Limite de 2.000 amostras atingido. Exporte um backup antes de prosseguir.');
  // Snapshot the operator's court classification at the time of comparison.
  // It must never be silently rewritten when the case record is edited.
  const sample={id:uid(),caseId:c.id,cnj:c.cnj,court:c.court||'',courtLevel:c.courtLevel||'',processSystem:c.processSystem||'',source,result,referenceDate,notes,jobId:job?.id||'',checkedAt:now()};
  state.coverageSamples.push(sample);
  return sample;
}
export function currentCoverageSample(c,sample){
  if(!c||c.id!==sample.caseId||c.cnj!==sample.cnj)return false;
  return ['court','courtLevel','processSystem'].every(key=>
    !Object.hasOwn(sample,key)||sample[key]===(c[key]||''));
}
export function coverageSummary(state) {
  const byId=new Map(state.cases.map(c=>[c.id,c]));
  const current=(state.coverageSamples||[]).filter(s=>currentCoverageSample(byId.get(s.caseId),s));
  const result={total:current.length,history:(state.coverageSamples||[]).length,sources:{}};
  for(const source of ['djen','datajud']){
    const selected=current.filter(s=>s.source===source);
    result.sources[source]={total:selected.length,match:selected.filter(s=>s.result==='match').length,difference:selected.filter(s=>s.result==='difference').length,unavailable:selected.filter(s=>s.result==='unavailable').length,inconclusive:selected.filter(s=>s.result==='inconclusive').length};
  }
  return result;
}
// Observed evidence only. One latest statement per case and source prevents
// repeated checks of the same case from looking like broader court coverage.
// Older samples without classification remain explicitly unclassified.
export function coverageEvidenceMatrix(state){
  const byId=new Map(state.cases.map(c=>[c.id,c]));
  const last=new Map();
  for(const item of state.coverageSamples||[])last.set(item.caseId+'|'+item.source,item);
  const groups=new Map();let outdated=0;
  const countedCases=new Set();
  for(const sample of last.values()){
    if(!currentCoverageSample(byId.get(sample.caseId),sample)){outdated++;continue;}
    const court=sample.court??'',courtLevel=sample.courtLevel??'',processSystem=sample.processSystem??'';
    const key=JSON.stringify([court,courtLevel,processSystem,sample.source]);
    if(!groups.has(key))groups.set(key,{court,courtLevel,processSystem,source:sample.source,cases:0,match:0,difference:0,unavailable:0,inconclusive:0});
    const row=groups.get(key);row.cases++;row[sample.result]++;countedCases.add(sample.caseId);
  }
  const order=['tjrj','trf2','tjsp','stj','stf','other',''];
  const rows=[...groups.values()].sort((a,b)=>order.indexOf(a.court)-order.indexOf(b.court)||
    a.courtLevel.localeCompare(b.courtLevel)||a.processSystem.localeCompare(b.processSystem)||a.source.localeCompare(b.source));
  return {rows,distinctCases:countedCases.size,latestComparisons:rows.reduce((n,r)=>n+r.cases,0),
    historical:(state.coverageSamples||[]).length,outdated,
    noSamples:['tjrj','trf2','tjsp','stj','stf'].filter(court=>!rows.some(r=>r.court===court))};
}
export function pendingManualReviews(state) {
  return state.cases.filter(c=>!c.archived).flatMap(c=>{
    const latest=[...(c.manualChecks||[])].reverse().find(x=>sameManualIdentity(c,x));
    if(!latest||!['attention','change','unavailable'].includes(latest.result))return [];
    if(state.tasks.some(t=>t.caseId===c.id&&t.manualCheckId===latest.id))return [];
    return [{caseId:c.id,checkId:latest.id,result:latest.result,source:latest.source,notes:latest.notes,checkedAt:latest.checkedAt}];
  }).sort((a,b)=>b.checkedAt.localeCompare(a.checkedAt));
}
export function pendingSourceIssues(state) {
  const issues=[],terminal=new Set(['success','not_found','action','error','interrupted']);
  for(const c of state.cases){
    if(c.archived||!c.cnj)continue;
    for(const source of ['datajud','djen']){
      if(!state.settings[source])continue;
      const jobs=state.jobs.filter(j=>j.caseId===c.id&&j.cnj===c.cnj&&j.source===source);
      const latest=[...jobs].reverse().find(j=>terminal.has(j.status));
      if(!latest||!['action','error','interrupted'].includes(latest.status))continue;
      issues.push({jobId:latest.id,caseId:c.id,cnj:c.cnj,source,status:latest.status,
        message:latest.message||'Consulta não concluída',updatedAt:latest.updatedAt,
        partial:latest.count>0,retrying:jobs.some(j=>['queued','running'].includes(j.status))});
    }
  }
  return issues.sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
}
export function retrySourceJob(state,jobId) {
  const j=state.jobs.find(x=>x.id===jobId);
  if(!j||!j.caseId||!['action','error','interrupted'].includes(j.status))throw Error('Consulta sem falha elegível para nova tentativa.');
  const c=state.cases.find(x=>x.id===j.caseId);
  if(!c||c.archived||!c.cnj||c.cnj!==j.cnj)throw Error('O processo foi alterado ou arquivado.');
  if(!state.settings[j.source])throw Error('A fonte está desativada nas configurações.');
  const latest=[...state.jobs].reverse().find(x=>x.caseId===c.id&&x.cnj===c.cnj&&x.source===j.source&&['success','not_found','action','error','interrupted'].includes(x.status));
  if(latest?.id!==j.id)throw Error('Existe um resultado mais recente para esta fonte.');
  if(j.source==='djen'&&(j.periodStart||j.periodEnd)&&(!validDay(j.periodStart)||!validDay(j.periodEnd)||j.periodStart>j.periodEnd))throw Error('Período da consulta anterior inválido. Verifique o histórico antes de repetir.');
  const added=enqueue(state,[c.id],[j.source]);
  if(added&&j.source==='djen'&&(j.periodStart||j.periodEnd)){
    const queued=state.jobs.at(-1);
    queued.periodStart=j.periodStart;
    queued.periodEnd=j.periodEnd;
  }
  return added;
}
export function pendingOabIssue(state) {
  const {oab,ufOab,djen}=state.settings;
  if(!djen||!/^\d{1,8}[A-Za-z]?$/.test(oab)||!/^[A-Z]{2}$/.test(ufOab))return null;
  const jobs=state.jobs.filter(j=>!j.caseId&&j.source==='djen'&&j.oab===oab&&j.ufOab===ufOab);
  const terminal=new Set(['success','not_found','action','error','interrupted']);
  const latest=[...jobs].reverse().find(j=>terminal.has(j.status));
  if(!latest||!['action','error','interrupted'].includes(latest.status))return null;
  return {jobId:latest.id,oab,ufOab,status:latest.status,message:latest.message||'Consulta não concluída',
    updatedAt:latest.updatedAt,partial:latest.count>0,retrying:jobs.some(j=>['queued','running'].includes(j.status))};
}
export function retryOabJob(state,jobId) {
  const j=state.jobs.find(x=>x.id===jobId);
  if(!j||j.caseId||j.source!=='djen'||!['action','error','interrupted'].includes(j.status))throw Error('Busca por OAB sem falha elegível para nova tentativa.');
  if(!state.settings.djen)throw Error('DJEN está desativado nas configurações.');
  if(j.oab!==state.settings.oab||j.ufOab!==state.settings.ufOab)throw Error('A OAB configurada foi alterada. Confira os dados antes de tentar novamente.');
  const latest=[...state.jobs].reverse().find(x=>!x.caseId&&x.source==='djen'&&x.oab===j.oab&&x.ufOab===j.ufOab&&['success','not_found','action','error','interrupted'].includes(x.status));
  if(latest?.id!==j.id)throw Error('Existe um resultado mais recente para esta OAB.');
  return enqueueOab(state,{periodStart:j.periodStart,periodEnd:j.periodEnd});
}
export function validCnj(value) {
  const n=digits(value);
  if(n.length!==20)return false;
  const check=98n-(BigInt(n.slice(0,7)+n.slice(9)+'00')%97n);
  return n.slice(7,9)===String(check).padStart(2,'0');
}
export function formatCnj(value) {
  const n=digits(value);
  return n.length===20?`${n.slice(0,7)}-${n.slice(7,9)}.${n.slice(9,13)}.${n[13]}.${n.slice(14,16)}.${n.slice(16)}`:value;
}
const TJ = {1:'tjac',2:'tjal',3:'tjap',4:'tjam',5:'tjba',6:'tjce',7:'tjdft',8:'tjes',9:'tjgo',10:'tjma',11:'tjmt',12:'tjms',13:'tjmg',14:'tjpa',15:'tjpb',16:'tjpr',17:'tjpe',18:'tjpi',19:'tjrj',20:'tjrn',21:'tjrs',22:'tjro',23:'tjrr',24:'tjsc',25:'tjse',26:'tjsp',27:'tjto'};
export function tribunalAlias(cnj) {
  const n=digits(cnj),j=n[13],t=Number(n.slice(14,16));
  if(!validCnj(cnj))return null;
  if(j==='8')return TJ[t]||null;
  if(j==='4'&&t>=1&&t<=6)return 'trf'+t;
  if(j==='5'&&t>=1&&t<=24)return 'trt'+t;
  if(j==='5'&&t===0)return 'tst';
  if(j==='6'&&t>=1&&t<=27)return 'tre-'+(TJ[t]||'').replace(/^tj/,'');
  if(j==='6'&&t===0)return 'tse';
  if(j==='7'&&t===0)return 'stm';
  if(j==='9'&&[13,21,26].includes(t))return 'tjm'+(TJ[t]||'').replace(/^tj/,'');
  if(j==='3'&&t===0)return 'stj';
  return null;
}
export const money = cents => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((cents||0)/100);
export function cents(value) {
  if(!/^\d+(\.\d{1,2})?$/.test(String(value)))throw Error('Informe um valor válido, com até duas casas decimais.');
  const result=Math.round(Number(value)*100);
  if(!Number.isSafeInteger(result)||result>100000000000)throw Error('Valor fora do limite.');
  return result;
}
export function cnjChangeImpact(state,caseId) {
  const c=state.cases.find(x=>x.id===caseId);
  if(!c)throw Error('Processo não encontrado.');
  const fees=state.fees.filter(f=>f.caseId===caseId);
  const feeIds=new Set(fees.map(f=>f.id));
  return {
    tasks:state.tasks.filter(t=>t.caseId===caseId).length,
    appointments:state.appointments.filter(a=>a.caseId===caseId).length,
    fees:fees.length,
    payments:state.payments.filter(p=>feeIds.has(p.feeId)).length,
    documents:state.documents.filter(d=>d.caseId===caseId).length,
    manualChecks:(c.manualChecks||[]).filter(x=>sameManualIdentity(c,x)).length,
    events:state.events.filter(e=>e.caseId===caseId&&digits(e.cnj)===c.cnj).length,
    jobs:state.jobs.filter(j=>j.caseId===caseId&&j.cnj===c.cnj&&['queued','running'].includes(j.status)).length
  };
}
export function saveEntity(state,table,input) {
  if(!['clients','cases','tasks','appointments','fees'].includes(table))throw Error('Cadastro desconhecido.');
  const old=state[table].find(x=>x.id===input.id), id=old?.id||uid();
  const row={...old,id,createdAt:old?.createdAt||now(),updatedAt:now()};
  if(table==='clients') {
    Object.assign(row,{name:clean(input.name,180),phone:clean(input.phone,40),email:clean(input.email,180),notes:clean(input.notes)});
    if(!row.name)throw Error('Informe o nome do cliente.');
  }
  if(table==='cases') {
    const cnj=digits(input.cnj);
    if(cnj&&!validCnj(cnj))throw Error('Número CNJ inválido. Confira os 20 dígitos e os verificadores.');
    if(cnj&&state.cases.some(x=>x.cnj===cnj&&x.id!==id))throw Error('Este processo já está cadastrado.');
    if(old?.cnj&&old.cnj!==cnj&&input.confirmCnjChange!=='yes')throw Error('Confirme a correção do CNJ e revise os vínculos antes de salvar.');
    const court=input.court===undefined?(old?.court||''):String(input.court);
    const courtLevel=input.courtLevel===undefined?(old?.courtLevel||''):String(input.courtLevel);
    const processSystem=input.processSystem===undefined?(old?.processSystem||''):String(input.processSystem);
    const parentCaseId=input.parentCaseId===undefined?(old?.parentCaseId||''):String(input.parentCaseId);
    const docketNumber=input.docketNumber===undefined?(old?.docketNumber||''):String(input.docketNumber).trim();
    const originReference=input.originReference===undefined?(old?.originReference||''):String(input.originReference).trim();
    validateCaseHierarchy(state,id,{court,courtLevel,processSystem,parentCaseId,docketNumber,originReference});
    if(['stj','stf'].includes(court)&&docketNumber&&state.cases.some(c=>c.id!==id&&c.court===court&&normalizeDocket(c.docketNumber)===normalizeDocket(docketNumber)))throw Error('Registro adicional já cadastrado para esse tribunal superior.');
    const judicialSystem=input.judicialSystem===undefined?(old?.judicialSystem||''):String(input.judicialSystem);
    if(!Object.hasOwn(JUDICIAL_SYSTEMS,judicialSystem))throw Error('Sistema judicial inválido.');
    if(judicialSystem&&(!validCnj(cnj)||cnj.slice(13,16)!=='819'))throw Error('Selecione um sistema TJRJ somente para processos do TJRJ.');
    const nextStep=input.nextStep===undefined?(old?.nextStep||''):String(input.nextStep??'').trim();
    const workOwner=input.workOwner===undefined?(old?.workOwner||'me'):String(input.workOwner);
    const workStatus=input.workStatus===undefined?(old?.workStatus||'todo'):String(input.workStatus);
    if(nextStep.length>500||!Object.hasOwn(WORK_OWNERS,workOwner)||!Object.hasOwn(WORK_STATUSES,workStatus))throw Error('Próximo passo, situação ou responsável inválido.');
    if((input.plaintiff??'').length>400||(input.defendant??'').length>400)throw Error('Nomes das partes acima do limite de 400 caracteres.');
    Object.assign(row,{title:clean(input.title,240),cnj,clientId:input.clientId||'',plaintiff:clean(input.plaintiff===undefined?(old?.plaintiff||''):input.plaintiff,400),defendant:clean(input.defendant===undefined?(old?.defendant||''):input.defendant,400),area:clean(input.area,80),stage:input.stage||'todo',review:clean(input.review,10),notes:clean(input.notes),judicialSystem,court,courtLevel,processSystem,parentCaseId,docketNumber,originReference,archived:old?!!old.archived:input.archived===true,
      nextStep,workOwner,workStatus,reviewedAt:old?.reviewedAt||'',pendingItems:old?.pendingItems||[]});
    if(input.datajudDetails!==undefined){
      if(input.datajudDetails!==null&&!validDatajudDetails(input.datajudDetails,cnj))throw Error('Dados públicos do DataJud inválidos para este CNJ. Consulte novamente.');
      if(input.datajudDetails===null)delete row.datajudDetails;
      else row.datajudDetails=structuredClone(input.datajudDetails);
    }else if(old&&old.cnj!==cnj)delete row.datajudDetails;
    if(old&&(old.cnj!==cnj||String(old.docketNumber||'')!==docketNumber||manualCheckCourt(old)!==manualCheckCourt(row)))row.manualCheckedAt='';
    if(!row.title)throw Error('Informe um título para o caso.');
    if(!STAGES[row.stage])throw Error('Etapa inválida.');
    if(row.clientId&&!state.clients.some(x=>x.id===row.clientId))throw Error('Cliente não encontrado.');
  }
  if(table==='tasks') {
    const manualCheckId=input.manualCheckId===undefined?(old?.manualCheckId||''):String(input.manualCheckId||'');
    if(manualCheckId){
      const linked=state.cases.find(c=>c.id===input.caseId);
      if(!linked?.manualChecks?.some(x=>x.id===manualCheckId))throw Error('Conferência de origem não encontrada neste processo.');
      if(state.tasks.some(t=>t.id!==id&&t.manualCheckId===manualCheckId))throw Error('Já existe uma tarefa vinculada a esta conferência.');
    }
    Object.assign(row,{title:clean(input.title,240),caseId:input.caseId||'',due:clean(input.due,10),stage:input.stage||'todo',notes:clean(input.notes),manualCheckId});
    if(!row.title||!STAGES[row.stage])throw Error('Informe tarefa e etapa válidas.');
  }
  if(table==='appointments') {
    Object.assign(row,{title:clean(input.title,240),caseId:input.caseId||'',when:clean(input.when,16),kind:clean(input.kind,40),notes:clean(input.notes)});
    if(!row.title||!validDateTime(row.when))throw Error('Informe título e data/hora válidos.');
  }
  if(table==='fees') {
    const initial=old?feeReceived(state,old.id):cents(input.paid||'0');
    if(old&&input.paid!==undefined&&cents(input.paid)!==initial)throw Error('Use Recebimentos para lançar ou estornar valores.');
    Object.assign(row,{title:clean(input.title,240),caseId:input.caseId||'',amount:cents(input.amount),paid:initial,due:clean(input.due,10),notes:clean(input.notes)});
    if(!row.title||row.amount<=0||row.paid>row.amount)throw Error('O valor deve ser positivo e o recebido não pode superar o total.');
  }
  if(row.caseId&&!state.cases.some(x=>x.id===row.caseId))throw Error('Processo não encontrado.');
  for(const field of ['due','review'])if(row[field]&&!validDay(row[field]))throw Error('Data inválida.');
  const index=state[table].findIndex(x=>x.id===id);
  if(index<0)state[table].push(row);else state[table][index]=row;
  if(table==='cases'){
    if(old&&old.cnj!==row.cnj){
      // An older process number must not leave external results on the new case.
      row.sourceInfo={};
      for(const job of state.jobs)if(job.caseId===row.id&&job.cnj!==row.cnj&&['queued','running'].includes(job.status)){
        Object.assign(job,{status:'cancelled',message:'Consulta cancelada: CNJ do processo foi corrigido.',updatedAt:now(),leaseUntil:0});
      }
    }
    reconcileEventLinks(state);
  }
  if(table==='fees'&&!old&&row.paid>0)state.payments.push({id:uid(),feeId:row.id,amount:row.paid,kind:'receipt',date:dateKey(),notes:'Recebimento inicial informado no cadastro.',createdAt:now()});
  return row;
}
export function reconcileEventLinks(state){
  const byCnj=new Map(state.cases.filter(c=>validCnj(c.cnj)).map(c=>[c.cnj,c.id]));
  let updated=0;
  for(const event of state.events){
    const cnj=digits(event.cnj);
    if(!validCnj(cnj))continue; // No reliable number: never guess by text or OAB.
    const expected=byCnj.get(cnj)||'';
    if((event.caseId||'')!==expected){event.caseId=expected;updated++;}
  }
  return updated;
}
export function mergeEvents(state,events,caseId) {
  let added=0;
  for(const event of events) {
    const previous=state.events.find(x=>x.id===event.id);
    const cnj=digits(event.cnj),matched=validCnj(cnj)?state.cases.find(c=>c.cnj===cnj)?.id||'':'';
    if(previous) {
      // Preserve acknowledgement; resolve association solely from the event's CNJ.
      Object.assign(previous,event,{caseId:matched,seen:previous.seen,discoveredAt:previous.discoveredAt,
        certificateHash:event.certificateHash||previous.certificateHash||''});
    } else {state.events.push({...event,caseId:matched,seen:false,discoveredAt:now()});added++;}
  }
  return added;
}
export function enqueue(state,caseIds,onlySources=['datajud','djen']) {
  if(!Array.isArray(onlySources)||!onlySources.length||onlySources.some(source=>!['datajud','djen'].includes(source)))throw Error('Fonte de consulta inválida.');
  const selected=state.cases.filter(x=>caseIds.includes(x.id)&&!x.archived&&x.cnj);
  if(!selected.length)throw Error('Selecione ao menos um processo com CNJ válido.');
  if(!state.settings.datajud&&!state.settings.djen)throw Error('Habilite uma fonte nas configurações.');
  let added=0;
  for(const c of selected)for(const source of onlySources) {
    if(!state.settings[source])continue;
    if(state.jobs.some(x=>x.caseId===c.id&&x.cnj===c.cnj&&x.source===source&&['queued','running'].includes(x.status)))continue;
    state.jobs.push({id:uid(),runId:uid(),caseId:c.id,cnj:c.cnj,source,status:'queued',createdAt:now(),updatedAt:now(),cursor:null,attempt:0,added:0,count:0,message:'Na fila',leaseUntil:0,nextAt:0});added++;
  }
  return added;
}
export function enqueueOab(state,options={}) {
  if(!state.settings.djen)throw Error('DJEN está desativado. Habilite a fonte em Fontes e ajustes antes de buscar por OAB.');
  if(!/^\d{1,8}[A-Za-z]?$/.test(state.settings.oab)||!/^[A-Z]{2}$/.test(state.settings.ufOab))throw Error('Configure OAB e UF antes da busca.');
  if(state.jobs.some(x=>x.oab===state.settings.oab&&x.ufOab===state.settings.ufOab&&['queued','running'].includes(x.status)))return 0;
  if(options.periodStart!==undefined&&options.periodStart!==''&&!validDay(options.periodStart))throw Error('Período inicial da consulta inválido.');
  if(options.periodEnd!==undefined&&options.periodEnd!==''&&!validDay(options.periodEnd))throw Error('Período final da consulta inválido.');
  if(options.periodStart&&options.periodEnd&&options.periodStart>options.periodEnd)throw Error('Período da consulta invertido.');
  state.jobs.push({id:uid(),caseId:'',source:'djen',oab:state.settings.oab,ufOab:state.settings.ufOab,status:'queued',createdAt:now(),updatedAt:now(),cursor:null,attempt:0,added:0,count:0,message:'Na fila',leaseUntil:0,nextAt:0,...options});
  return 1;
}
export const backup = state => ({format:'pauta-backup',version:2,createdAt:now(),state:{...structuredClone(state),jobs:state.jobs.map(x=>['queued','running'].includes(x.status)?{...x,status:'interrupted',needsManualRetry:true,leaseUntil:0,message:'Pendente no momento do backup. Revise e repita manualmente; não há retomada automática após restauração.'}:x),settings:{...state.settings,datajudKey:''}}});
const backupText=(v,max=200000)=>typeof v==='string'&&v.length<=max;
const backupDay=v=>!v||validDay(v);

function validateBackupTables(s) {
  for(const table of TABLES) {
    if(!Array.isArray(s[table])||s[table].length>100000)throw Error('Estrutura de backup inválida: '+table);
    const ids=new Set();
    for(const row of s[table]) {
      if(!row||typeof row!=='object'||typeof row.id!=='string'||!row.id||ids.has(row.id))throw Error('Identificadores inválidos ou repetidos em '+table);
      ids.add(row.id);
    }
  }
}

function validateBackupCoverage(s,caseById,jobById) {
  if(s.coverageSamples.length>2000)throw Error('Limite de amostras de cobertura no backup excedido.');
  for(const item of s.coverageSamples){
    const c=caseById.get(item.caseId);
    const j=item.jobId?jobById.get(item.jobId):null;
    for(const [field,options] of [['court',COURTS],['courtLevel',COURT_LEVELS],['processSystem',PROCESS_SYSTEMS]]){
      if(Object.hasOwn(item,field)&&(!backupText(item[field],40)||!Object.hasOwn(options,item[field])))throw Error('Classificação da amostra de cobertura inválida no backup.');
    }
    if(!c||!validCnj(item.cnj)||!['djen','datajud'].includes(item.source)||!Object.hasOwn(COVERAGE_RESULTS,item.result)||!validDay(item.referenceDate)||item.referenceDate>dateKey()||!backupText(item.notes,1500)||item.notes.trim().length<12||typeof item.checkedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(item.checkedAt)||!Number.isFinite(Date.parse(item.checkedAt))||new Date(item.checkedAt).toISOString()!==item.checkedAt||item.jobId!==''&&(!j||j.caseId!==item.caseId||j.cnj!==item.cnj||j.source!==item.source||!['success','not_found','error','action','interrupted'].includes(j.status))||['match','difference'].includes(item.result)&&!['success','not_found'].includes(j?.status))throw Error('Amostra de cobertura inválida no backup.');
  }
}

function validateBackupClients(s) {
  for(const c of s.clients)if(!backupText(c.name,180)||!c.name.trim()||!backupText(c.phone||'',40)||!backupText(c.email||'',180)||!backupText(c.notes||'',4000))throw Error('Cliente inválido no backup.');
}

function validateBackupPendingItems(c) {
  if(c.pendingItems===undefined)return;
  if(!Array.isArray(c.pendingItems)||c.pendingItems.length>80)throw Error('Pendências do processo inválidas no backup.');
  const pendingIds=new Set();
  for(const item of c.pendingItems){
    if(!item||typeof item.id!=='string'||!item.id||pendingIds.has(item.id)||!backupText(item.title,240)||!item.title.trim()||typeof item.done!=='boolean'||!backupText(item.createdAt,40)||!Number.isFinite(Date.parse(item.createdAt))||!backupText(item.completedAt,40)||item.completedAt&&!Number.isFinite(Date.parse(item.completedAt))||item.done!==!!item.completedAt)throw Error('Pendência inválida no backup.');
    pendingIds.add(item.id);
  }
}

function validateBackupManualChecks(c) {
  if(c.manualChecks===undefined)return;
  if(!Array.isArray(c.manualChecks)||c.manualChecks.length>500)throw Error('Histórico de conferência manual inválido.');
  const ids=new Set();
  for(const item of c.manualChecks){
    const legacy=item?.court===undefined;
    const sourceOk=legacy?(validCnj(item.cnj)&&digits(item.cnj).slice(13,16)==='819'&&Object.hasOwn(JUDICIAL_SYSTEMS,item.source)&&!!item.source):(MANUAL_COURT_SOURCES[item.court]?.includes(item.source)&&typeof item.cnj==='string'&&(!item.cnj||validCnj(item.cnj))&&backupText(item.docketNumber,100)&&(!!item.docketNumber||!!item.cnj));
    if(!item||typeof item!=='object'||typeof item.id!=='string'||!item.id||ids.has(item.id)||!sourceOk||!Object.hasOwn(MANUAL_CHECK_RESULTS,item.result)||!backupText(item.notes,2000)||(['change','attention','unavailable'].includes(item.result)&&!item.notes.trim())||typeof item.checkedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(item.checkedAt)||!Number.isFinite(Date.parse(item.checkedAt))||new Date(item.checkedAt).toISOString()!==item.checkedAt)throw Error('Registro de conferência manual inválido no backup.');
    ids.add(item.id);
  }
}

function validateBackupCases(s,clientIds) {
  const cnjs=new Set(),superiorRegisters=new Set();
  for(const c of s.cases) {
    if(!backupText(c.title,240)||!c.title||!STAGES[c.stage]||!backupText(c.cnj||'',20)||(c.cnj&&!validCnj(c.cnj))||!backupDay(c.review)||!backupText(c.notes||'',4000))throw Error('Processo inválido no backup.');
    if(c.nextStep!==undefined&&!backupText(c.nextStep,500)||c.workOwner!==undefined&&!Object.hasOwn(WORK_OWNERS,c.workOwner)||c.workStatus!==undefined&&!Object.hasOwn(WORK_STATUSES,c.workStatus)||c.reviewedAt!==undefined&&c.reviewedAt!==''&&(!backupText(c.reviewedAt,40)||!Number.isFinite(Date.parse(c.reviewedAt))||!/^\d{4}-\d\d-\d\dT/.test(c.reviewedAt)))throw Error('Acompanhamento do processo inválido no backup.');
    validateBackupPendingItems(c);
    if((c.plaintiff!==undefined&&!backupText(c.plaintiff,400))||(c.defendant!==undefined&&!backupText(c.defendant,400)))throw Error('Partes do processo inválidas no backup.');
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
    validateBackupManualChecks(c);
    if(c.cnj&&cnjs.has(c.cnj))throw Error('CNJ duplicado no backup.');
    if(c.cnj)cnjs.add(c.cnj);
    if(['stj','stf'].includes(c.court)&&c.docketNumber){
      const key=c.court+':'+normalizeDocket(c.docketNumber);
      if(superiorRegisters.has(key))throw Error('Registro superior duplicado no backup.');
      superiorRegisters.add(key);
    }
    if(c.clientId&&!clientIds.has(c.clientId))throw Error('Vínculo de cliente ausente.');
  }
}

function validateBackupCaseLinks(s,caseIds) {
  for(const table of ['tasks','appointments','fees','events','jobs'])for(const row of s[table])if(row.caseId&&!caseIds.has(row.caseId))throw Error('Vínculo de processo ausente.');
}

function validateBackupTasks(s,caseById) {
  const usedManualChecks=new Set();
  for(const t of s.tasks){
    if(!backupText(t.title,240)||!t.title||!STAGES[t.stage]||!backupDay(t.due))throw Error('Tarefa inválida.');
    if(t.manualCheckId!==undefined){
      if(!backupText(t.manualCheckId,100))throw Error('Origem da tarefa inválida.');
      if(t.manualCheckId){
        const source=caseById.get(t.caseId);
        if(!source?.manualChecks?.some(x=>x.id===t.manualCheckId)||usedManualChecks.has(t.manualCheckId))throw Error('Vínculo da conferência na tarefa inválido.');
        usedManualChecks.add(t.manualCheckId);
      }
    }
  }
}

function validateBackupAppointments(s) {
  for(const a of s.appointments)if(!backupText(a.title,240)||!a.title||!validDateTime(a.when))throw Error('Compromisso inválido.');
}

function validateBackupFees(s) {
  for(const f of s.fees)if(!Number.isSafeInteger(f.amount)||!Number.isSafeInteger(f.paid)||f.amount<=0||f.paid<0||f.paid>f.amount)throw Error('Honorário inválido.');
  for(const f of s.fees)if(!backupText(f.title,240)||!f.title||!backupDay(f.due))throw Error('Honorário inválido.');
}

function validateBackupPayments(s,feeIds,paidByFee) {
  for(const p of s.payments){
    if(!feeIds.has(p.feeId)||!['receipt','reversal'].includes(p.kind)||!Number.isSafeInteger(p.amount)||p.amount<=0||!validDay(p.date)||!backupText(p.notes||'',4000))throw Error('Recebimento inválido no backup.');
    paidByFee.set(p.feeId,paidByFee.get(p.feeId)+(p.kind==='reversal'?-p.amount:p.amount));
  }
}

function validateBackupReversals(s,paymentById) {
  const reversed=new Set();
  for(const p of s.payments)if(p.kind==='reversal'){
    const original=paymentById.get(p.reverses);
    if(!original||original.kind!=='receipt'||original.feeId!==p.feeId||original.amount!==p.amount||p.date<original.date||reversed.has(original.id))throw Error('Estorno inválido no backup.');reversed.add(original.id);
  }
}

function validateBackupFeeBalance(s,paidByFee) {
  for(const f of s.fees)if(paidByFee.get(f.id)!==f.paid)throw Error('Saldo financeiro inconsistente no backup.');
}

function validateBackupDocuments(s,caseIds) {
  for(const d of s.documents)if(!caseIds.has(d.caseId)||!backupText(d.name,200)||!d.name||!backupText(d.mime,80)||d.createdAt!==undefined&&!validStoredDate(d.createdAt)||!Number.isInteger(d.size)||d.size<=0||d.size>5*1024*1024||!/^([a-f0-9]{64})$/.test(d.sha256||''))throw Error('Anexo inválido no backup.');
}

function validateBackupJobs(s) {
  for(const j of s.jobs)if(!JOB_STATES.includes(j.status)||!['datajud','djen'].includes(j.source)||!backupText(j.updatedAt,40)||Number.isNaN(Date.parse(j.updatedAt))||j.needsManualRetry!==undefined&&typeof j.needsManualRetry!=='boolean')throw Error('Consulta inválida.');
}

function validateBackupJobPeriods(s) {
  for(const j of s.jobs){
    for(const k of ['periodStart','periodEnd'])if(j[k]!==undefined&&j[k]!==''&&!validDay(j[k]))throw Error('Período de consulta inválido no backup.');
    if(j.periodStart&&j.periodEnd&&j.periodStart>j.periodEnd)throw Error('Período de consulta invertido no backup.');
  }
}

function validateBackupEvents(s,caseById) {
  for(const e of s.events){
    if(!['datajud','djen'].includes(e.source)||!['movement','publication'].includes(e.kind)||!backupText(e.text)||!backupText(e.date,40)||Number.isNaN(Date.parse(e.date))||!backupText(e.discoveredAt,40)||Number.isNaN(Date.parse(e.discoveredAt)))throw Error('Histórico inválido.');
    if(e.caseId&&(!validCnj(e.cnj)||digits(e.cnj)!==caseById.get(e.caseId)?.cnj))throw Error('Histórico vinculado a outro CNJ no backup.');
  }
}

function finalizeBackup(s) {
  const result=structuredClone(s);
  result.settings={...emptyState().settings,...s.settings,datajudKey:''};
  result.jobs=result.jobs.map(x=>({...x,status:['queued','running'].includes(x.status)?'interrupted':x.status}));
  return result;
}

export function validateBackup(value) {
  if(value?.format!=='pauta-backup'||![1,2].includes(value.version)||![1,2].includes(value.state?.schemaVersion))throw Error('Arquivo não é um backup Pauta compatível.');
  const s=migrateState(structuredClone(value.state));
  if(!s.settings||typeof s.settings!=='object'||Array.isArray(s.settings))throw Error('Configurações inválidas no backup.');
  if(typeof s.settings.datajud!=='boolean'||typeof s.settings.djen!=='boolean'||!Number.isInteger(s.settings.djenDays)||s.settings.djenDays<1||s.settings.djenDays>365)throw Error('Fontes inválidas no backup.');
  validateBackupTables(s);
  const caseIds=new Set(s.cases.map(x=>x.id)),caseById=new Map(s.cases.map(x=>[x.id,x])),clientIds=new Set(s.clients.map(x=>x.id)),jobById=new Map(s.jobs.map(x=>[x.id,x]));
  validateBackupCoverage(s,caseById,jobById);
  validateBackupClients(s);
  validateBackupCases(s,clientIds);
  validateBackupCaseLinks(s,caseIds);
  validateBackupTasks(s,caseById);
  validateBackupAppointments(s);
  validateBackupFees(s);
  const feeIds=new Set(s.fees.map(f=>f.id)),paymentById=new Map(s.payments.map(p=>[p.id,p])),paidByFee=new Map(s.fees.map(f=>[f.id,0]));
  validateBackupPayments(s,feeIds,paidByFee);
  validateBackupReversals(s,paymentById);
  validateBackupFeeBalance(s,paidByFee);
  validateBackupDocuments(s,caseIds);
  validateBackupJobs(s);
  validateBackupJobPeriods(s);
  validateBackupEvents(s,caseById);
  return finalizeBackup(s);
}
export function overview(state) {
  return {expected:state.fees.reduce((n,f)=>n+f.amount,0),received:state.fees.reduce((n,f)=>n+f.paid,0),balance:state.fees.reduce((n,f)=>n+f.amount-f.paid,0),unseen:state.events.filter(x=>!x.seen).length};
}
// A exclusão da ficha não deve apagar dados associados. Anexos, amostras e
// conferências manuais exigem preservação do cadastro ou remoção individual.
export function caseDeletionImpact(state, ids) {
  const keys=new Set(ids),cases=state.cases.filter(c=>keys.has(c.id));
  if(!cases.length||cases.length!==keys.size)throw Error('Seleção de processos desatualizada.');
  const count=table=>(state[table]||[]).filter(row=>keys.has(row.caseId)).length;
  return {cases,attachments:count('documents'),samples:count('coverageSamples'),manualChecks:cases.reduce((n,c)=>n+(c.manualChecks||[]).length,0),tasks:count('tasks'),appointments:count('appointments'),fees:count('fees'),events:count('events'),jobs:count('jobs'),children:state.cases.filter(c=>!keys.has(c.id)&&keys.has(c.parentCaseId)).length};
}
export function deleteCases(state, ids) {
  const impact=caseDeletionImpact(state,ids);
  if(impact.attachments||impact.samples||impact.manualChecks)throw Error('Para preservar anexos, comparações e conferências manuais, remova os anexos e mantenha arquivadas as fichas com histórico de conferências ou comparações.');
  const keys=new Set(ids),stamp=now();
  state.cases=state.cases.filter(c=>!keys.has(c.id));
  for(const row of state.tasks)if(keys.has(row.caseId)){row.caseId='';row.manualCheckId='';}
  for(const table of ['appointments','fees','events'])for(const row of state[table])if(keys.has(row.caseId))row.caseId='';
  for(const job of state.jobs)if(keys.has(job.caseId)){
    job.caseId='';
    if(['queued','running'].includes(job.status))Object.assign(job,{status:'cancelled',message:'Consulta cancelada: cadastro excluído.',updatedAt:stamp,leaseUntil:0});
  }
  for(const c of state.cases)if(keys.has(c.parentCaseId))c.parentCaseId='';
  return impact;
}
// Non-destructive checks for local workspace consistency. Never infer a court result.
export function auditLocalData(state) {
  const caseIds=new Set(state.cases.map(c=>c.id));
  const caseById=new Map(state.cases.map(c=>[c.id,c]));
  const feeIds=new Set(state.fees.map(f=>f.id));
  const cnjs=new Set();
  const issues=[];
  const add=(label,count)=>{if(count>0)issues.push({label,count});};
  let invalidCases=0;
  for(const c of state.cases){
    if((c.cnj&&!validCnj(c.cnj))||(c.cnj&&cnjs.has(c.cnj)))invalidCases++;
    if(c.cnj)cnjs.add(c.cnj);
  }
  add('CNJs inválidos ou duplicados',invalidCases);
  const superiorRegisters=new Set();let repeatedRegisters=0;
  for(const c of state.cases)if(['stj','stf'].includes(c.court)&&c.docketNumber){
    const key=c.court+':'+normalizeDocket(c.docketNumber);
    if(superiorRegisters.has(key))repeatedRegisters++;else superiorRegisters.add(key);
  }
  add('Registros superiores repetidos',repeatedRegisters);
  let orphanRecords=0;
  for(const table of ['tasks','appointments','fees','documents','coverageSamples'])for(const row of state[table]||[])if(row.caseId&&!caseIds.has(row.caseId))orphanRecords++;
  add('Registros vinculados a processos inexistentes',orphanRecords);
  let invalidPayments=0;
  const received=new Map();
  for(const p of state.payments){
    if(!feeIds.has(p.feeId))invalidPayments++;
    else received.set(p.feeId,(received.get(p.feeId)||0)+(p.kind==='reversal'?-p.amount:p.amount));
  }
  for(const fee of state.fees)if((received.get(fee.id)||0)!==fee.paid)invalidPayments++;
  add('Inconsistências em recebimentos ou saldos',invalidPayments);
  let mismatchedEvents=0;
  for(const e of state.events)if(e.caseId){
    const associated=caseById.get(e.caseId);
    if(!associated||!validCnj(e.cnj)||digits(e.cnj)!==associated.cnj)mismatchedEvents++;
  }
  add('Movimentações ou publicações com vínculo CNJ divergente',mismatchedEvents);
  let invalidChecks=0;
  for(const t of state.tasks)if(t.manualCheckId){
    const c=caseById.get(t.caseId);
    if(!c?.manualChecks?.some(m=>m.id===t.manualCheckId))invalidChecks++;
  }
  add('Tarefas com conferência de origem ausente',invalidChecks);
  try {validateBackup(backup(state));}
  catch {add('Inconsistência adicional na estrutura dos dados',1);}
  return {counts:{clients:state.clients.length,cases:state.cases.length,events:state.events.length,documents:state.documents.length,fees:state.fees.length},issues};
}
