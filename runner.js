import {mergeEvents,now,dateKey,uid} from './core.js';
export async function step({read,mutate,adapters,clock=Date.now}) {
  const job=await mutate(state=>{
    for(const j of state.jobs)if(j.status==='running'&&j.leaseUntil<clock()){j.status='queued';j.message='Retomando consulta interrompida';}
    for(const j of state.jobs)if(j.status==='queued'&&state.settings[j.source]!==true)Object.assign(j,{status:'cancelled',leaseUntil:0,updatedAt:now(),message:'Consulta cancelada: fonte desativada.'});
    for(const j of state.jobs)if(j.status==='queued'&&j.caseId){
      const c=state.cases.find(c=>c.id===j.caseId);
      if(!c||c.archived||c.cnj!==j.cnj)Object.assign(j,{status:'cancelled',leaseUntil:0,updatedAt:now(),message:'Consulta cancelada: processo alterado ou arquivado.'});
    }
    const item=state.jobs.find(j=>j.status==='queued'&&(j.nextAt||0)<=clock());
    if(!item)return null;
    Object.assign(item,{status:'running',runId:uid(),leaseUntil:clock()+(item.source==='datajud'?90000:45000),updatedAt:now()});
    if(item.source==='djen'&&!item.periodStart){item.periodEnd=dateKey();item.periodStart=dateKey(new Date(clock()-(Math.min(365,Math.max(1,Number(state.settings.djenDays)||30))-1)*86400000));}
    return structuredClone(item);
  });
  if(!job)return false;
  try {
    const state=await read();
    if(state.settings[job.source]!==true||!job.caseId&&job.source==='djen'&&(state.settings.oab!==job.oab||state.settings.ufOab!==job.ufOab)){
      await mutate(s=>{const live=s.jobs.find(j=>j.id===job.id);if(live?.status==='running'&&live.runId===job.runId)Object.assign(live,{status:'cancelled',leaseUntil:0,updatedAt:now(),message:'Consulta cancelada: fonte desativada.'});});
      return true;
    }
    const response=await adapters[job.source](job,state.settings);
    await mutate(s=>{
      const live=s.jobs.find(j=>j.id===job.id);
      if(!live||live.status!=='running'||live.runId!==job.runId)return;
      const c=job.caseId?s.cases.find(c=>c.id===job.caseId):null;
      if(s.settings[job.source]!==true||job.caseId&&(!c||c.archived||c.cnj!==job.cnj)||!job.caseId&&job.source==='djen'&&(s.settings.oab!==job.oab||s.settings.ufOab!==job.ufOab)){
        Object.assign(live,{status:'cancelled',message:'Consulta cancelada: fonte ou referência foi alterada.',leaseUntil:0,updatedAt:now()});return;
      }
      live.added=(live.added||0)+mergeEvents(s,response.events);
      live.count=(live.count||0)+response.count;
      const hasNext=response.nextCursor!==null;
      Object.assign(live,{status:hasNext?'queued':response.notFound&&live.count===0?'not_found':'success',cursor:response.nextCursor,nextAt:clock()+500,leaseUntil:0,attempt:0,updatedAt:now(),sourceUpdatedAt:response.sourceUpdatedAt||live.sourceUpdatedAt||'',message:hasNext?'Buscando próxima página':response.notFound&&live.count===0?'Nenhum registro encontrado nesta fonte e neste período':`Concluído · ${live.added} novidade(s)`,periodStart:response.periodStart||live.periodStart,periodEnd:response.periodEnd||live.periodEnd});
      if(response.snapshots&&job.caseId){const c=s.cases.find(c=>c.id===job.caseId&&c.cnj===job.cnj);if(c){c.sourceInfo=c.sourceInfo||{};const all=[...(c.sourceInfo.datajud||[]),...response.snapshots];c.sourceInfo.datajud=[...new Map(all.map(x=>[x.id,x])).values()];}}
    });
  }catch(error) {
    await mutate(s=>{
      const live=s.jobs.find(j=>j.id===job.id);if(!live||live.status!=='running'||live.runId!==job.runId)return;
      if(s.settings[job.source]!==true){Object.assign(live,{status:'cancelled',message:'Consulta cancelada: fonte desativada.',leaseUntil:0,updatedAt:now()});return;}
      const retry=error.retryable&&(live.attempt||0)<2;
      Object.assign(live,{status:retry?'queued':error.action?'action':'error',attempt:(live.attempt||0)+1,nextAt:clock()+Math.max(error.retryAfter||0,5000*2**(live.attempt||0)),leaseUntil:0,updatedAt:now(),message:(retry?'Nova tentativa programada. ':'')+(error.message||'Falha desconhecida')});
    });
  }
  return true;
}
