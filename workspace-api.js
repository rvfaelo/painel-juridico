// Persistência autoritativa no serviço local. Sem fallback silencioso após migrar.
import {migrateState} from './core.js';
import {isIntegratedRuntime as integrated} from './runtime-mode.js';
let csrf='',remote=false,tail=Promise.resolve();
export const hasRemoteWorkspace=()=>remote;
export async function workspaceRequest(route,body,renew=true){
  if(!csrf){const r=await fetch('/api/v1/session',{cache:'no-store'});if(!r.ok)throw Error('Serviço local indisponível.');csrf=(await r.json()).csrf;}
  const r=await fetch('/api/v1/'+route,{method:body===undefined?'GET':'POST',cache:'no-store',credentials:'same-origin',
    headers:{'X-Pauta-CSRF':csrf,...(body===undefined?{}:{'Content-Type':'application/json'})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});
  const result=await r.json();
  // 403 ocorre antes de qualquer gravação, permitindo renovar a sessão reiniciada.
  if(r.status===403&&renew){csrf='';return workspaceRequest(route,body,false);}
  if(!r.ok)throw Error(result.error||'Não foi possível salvar no serviço local.');return result;
}
export async function initializeRemoteWorkspace(loadLocal){
  if(!integrated())return;
  const current=await workspaceRequest('workspace');
  if(!current.initialized){
    const bundle=await loadLocal();
    await workspaceRequest('workspace/migrate',bundle);
  }
  remote=true;
}
export async function readRemoteWorkspace(){return migrateState((await workspaceRequest('workspace')).state);}
export function remoteTransaction(fn){
  const result=tail.then(async()=>{
    const state=await readRemoteWorkspace(),expectedRevision=state.revision;
    const payload=await fn(state);
    const saved=await workspaceRequest('workspace/save',{state,expectedRevision,...payload?.extra});
    return payload?.result===undefined?saved:payload.result;
  });
  tail=result.catch(()=>{});return result;
}
