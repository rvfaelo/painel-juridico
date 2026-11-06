import {emptyState,migrateState,backup,validateBackup,uid,now} from './core.js';
import {toBase64,fromBase64} from './backup-crypto.js';
import {sha256,validateDocument,MAX_TOTAL} from './documents.js';
import {initializeRemoteWorkspace,hasRemoteWorkspace,readRemoteWorkspace,remoteTransaction,workspaceRequest} from './workspace-api.js';
import {isIntegratedRuntime} from './runtime-mode.js';
let dbPromise;
export function openDB() {
  if(!globalThis.indexedDB)return Promise.reject(Error('Este navegador não disponibilizou IndexedDB para o painel local. Abra o dashboard.html no Chrome ou no Edge e verifique se o armazenamento local está permitido.'));
  if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open('pauta-local',2);let failed=false;
    req.onupgradeneeded=()=>{
      if(!req.result.objectStoreNames.contains('workspace'))req.result.createObjectStore('workspace');
      if(!req.result.objectStoreNames.contains('attachments'))req.result.createObjectStore('attachments',{keyPath:'id'});
      const store=req.transaction.objectStore('workspace'),r=store.get('state');r.onsuccess=()=>{if(r.result)store.put(migrateState(r.result),'state');};
    };
    req.onblocked=()=>{failed=true;dbPromise=null;reject(Error('Feche as outras abas do Pauta e recarregue esta página para atualizar o banco.'));};
    req.onsuccess=()=>{if(failed){req.result.close();return;}req.result.onversionchange=()=>{req.result.close();dbPromise=null;};resolve(req.result);};
    req.onerror=()=>{dbPromise=null;reject(req.error);};
  });
  return dbPromise;
}
// Primeira abertura precisa persistir um estado inicial, mesmo sem o antigo
// executor de consultas (que antes gravava o banco ao iniciar).
async function initializeLocalWorkspace() {
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('workspace','readwrite'),store=tx.objectStore('workspace');
    const request=store.get('state');
    request.onsuccess=()=>{if(!request.result)store.put(emptyState(),'state');};
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error||Error('Não foi possível inicializar a carteira local.'));
  });
}
export async function initializeWorkspace(){
  if(isIntegratedRuntime()){
    await initializeRemoteWorkspace(async()=>{
      await initializeLocalWorkspace();
      const state=await readState(),bundle=await exportBundle();
      return {state,attachments:bundle.attachments};
    });
  }else await initializeLocalWorkspace();
}
export async function readState() {
  if(hasRemoteWorkspace())return readRemoteWorkspace();
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('workspace','readonly'),r=tx.objectStore('workspace').get('state');
    r.onsuccess=()=>resolve(migrateState(r.result));r.onerror=()=>reject(r.error);
  });
}
export async function mutate(fn) {
  if(hasRemoteWorkspace())return remoteTransaction(state=>{
    const result=fn(state);if(result?.then)throw Error('Mutação do banco deve ser síncrona.');return {result};
  });
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('workspace','readwrite'),store=tx.objectStore('workspace'),r=store.get('state');let output,error;
    r.onsuccess=()=>{try{
      const state=migrateState(r.result);output=fn(state);
      if(output?.then)throw Error('Mutação do banco deve ser síncrona.');
      state.revision=(state.revision||0)+1;store.put(state,'state');
    }catch(e){error=e;tx.abort();}};
    tx.oncomplete=()=>resolve(output);tx.onabort=()=>reject(error||tx.error||Error('Não foi possível salvar.'));tx.onerror=()=>reject(error||tx.error);
  });
}
export async function replaceState(newState) {
  if(newState.documents?.length)throw Error('Restaure anexos pelo fluxo completo de backup.');
  return mutate(state=>{for(const key of Object.keys(state))delete state[key];Object.assign(state,newState);});
}
export async function addDocument(caseId,file) {
  const bytes=new Uint8Array(await file.arrayBuffer());validateDocument(bytes,file.type);
  const hash=await sha256(bytes),metadata={id:uid(),caseId,name:String(file.name||'Documento').slice(0,200),mime:file.type,size:bytes.length,sha256:hash,createdAt:now()};
  if(hasRemoteWorkspace())return remoteTransaction(state=>{
    if(!state.cases.some(c=>c.id===caseId))throw Error('Processo não encontrado.');
    if(state.documents.some(d=>d.caseId===caseId&&d.sha256===hash))throw Error('Este arquivo já está anexado ao processo.');
    if(state.documents.reduce((n,d)=>n+d.size,0)+metadata.size>MAX_TOTAL)throw Error('Limite de 25 MB em anexos atingido.');
    state.documents.push(metadata);return {result:metadata,extra:{attachments:[{id:metadata.id,data:toBase64(bytes)}]}};
  });
  const db=await openDB();return new Promise((resolve,reject)=>{
    const tx=db.transaction(['workspace','attachments'],'readwrite'),ws=tx.objectStore('workspace'),r=ws.get('state');let error;
    r.onsuccess=()=>{try{const s=migrateState(r.result);if(!s.cases.some(c=>c.id===caseId))throw Error('Processo não encontrado.');if(s.documents.some(d=>d.caseId===caseId&&d.sha256===hash))throw Error('Este arquivo já está anexado ao processo.');if(s.documents.reduce((n,d)=>n+d.size,0)+metadata.size>MAX_TOTAL)throw Error('Limite de 25 MB em anexos atingido.');s.documents.push(metadata);s.revision++;ws.put(s,'state');tx.objectStore('attachments').put({id:metadata.id,blob:new Blob([bytes],{type:metadata.mime})});}catch(e){error=e;tx.abort();}};
    tx.oncomplete=()=>resolve(metadata);tx.onabort=()=>reject(error||tx.error);tx.onerror=()=>reject(error||tx.error);
  });
}
export async function readDocument(id){
  if(hasRemoteWorkspace()){
    const bundle=await workspaceRequest('workspace/export'),d=bundle.state.documents.find(d=>d.id===id),f=bundle.attachments.find(f=>f.id===id);
    if(!d||!f)throw Error('Arquivo não encontrado.');const bytes=fromBase64(f.data,5*1024*1024);
    if(bytes.length!==d.size||await sha256(bytes)!==d.sha256)throw Error('Anexo corrompido.');return new Blob([bytes],{type:d.mime});
  }
  const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('attachments','readonly'),r=tx.objectStore('attachments').get(id);r.onsuccess=()=>r.result?resolve(r.result.blob):reject(Error('Arquivo não encontrado. Restaure um backup completo.'));r.onerror=()=>reject(r.error);});
}
export async function auditLocalAttachments(){
  if(hasRemoteWorkspace()){
    const bundle=await workspaceRequest('workspace/export');let checked=0,missing=0,corrupted=0;
    for(const d of bundle.state.documents){const f=bundle.attachments.find(f=>f.id===d.id);if(!f){missing++;continue;}
      const bytes=fromBase64(f.data,5*1024*1024);if(bytes.length!==d.size||await sha256(bytes)!==d.sha256)corrupted++;else checked++;
    }
    return {checked,missing,corrupted,unreferenced:bundle.attachments.filter(f=>!bundle.state.documents.some(d=>d.id===f.id)).length};
  }
  const db=await openDB();
  const snapshot=await new Promise((resolve,reject)=>{
    const tx=db.transaction(['workspace','attachments'],'readonly');
    const state=tx.objectStore('workspace').get('state'),attachments=tx.objectStore('attachments').getAll();
    tx.oncomplete=()=>resolve({state:migrateState(state.result),files:attachments.result});
    tx.onabort=()=>reject(tx.error||Error('Falha ao ler anexos.'));
    tx.onerror=()=>reject(tx.error);
  });
  const byId=new Map(snapshot.files.map(f=>[f.id,f]));
  const expected=new Set(snapshot.state.documents.map(d=>d.id));
  let missing=0,corrupted=0,checked=0;
  for(const d of snapshot.state.documents){
    const stored=byId.get(d.id);
    if(!stored?.blob){missing++;continue;}
    try{
      const bytes=new Uint8Array(await stored.blob.arrayBuffer());
      if(bytes.length!==d.size||await sha256(bytes)!==d.sha256)corrupted++;
      else checked++;
    }catch{corrupted++;}
  }
  return {checked,missing,corrupted,unreferenced:snapshot.files.filter(f=>!expected.has(f.id)).length};
}
export async function removeDocument(id){
  if(hasRemoteWorkspace())return mutate(s=>{s.documents=s.documents.filter(d=>d.id!==id);});
  const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(['workspace','attachments'],'readwrite'),ws=tx.objectStore('workspace'),r=ws.get('state');r.onsuccess=()=>{const s=migrateState(r.result);s.documents=s.documents.filter(d=>d.id!==id);s.revision++;ws.put(s,'state');tx.objectStore('attachments').delete(id);};tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});
}
export async function exportBundle(){
  if(hasRemoteWorkspace()){
    const bundle=await workspaceRequest('workspace/export');
    for(const d of bundle.state.documents){const f=bundle.attachments.find(f=>f.id===d.id);if(!f)throw Error('Anexo ausente: '+d.name);const bytes=fromBase64(f.data,5*1024*1024);if(bytes.length!==d.size||await sha256(bytes)!==d.sha256)throw Error('Anexo corrompido: '+d.name);}
    return {...backup(bundle.state),attachments:bundle.attachments};
  }
  const db=await openDB();const snapshot=await new Promise((resolve,reject)=>{const tx=db.transaction(['workspace','attachments'],'readonly'),r=tx.objectStore('workspace').get('state'),a=tx.objectStore('attachments').getAll();tx.oncomplete=()=>resolve({state:migrateState(r.result),files:a.result});tx.onabort=()=>reject(tx.error);});
  const value=backup(snapshot.state);value.attachments=[];
  const storedById=new Map(snapshot.files.map(file=>[file.id,file]));
  for(const d of value.state.documents){const stored=storedById.get(d.id);if(!stored)throw Error('Anexo ausente: '+d.name);const bytes=new Uint8Array(await stored.blob.arrayBuffer());if(bytes.length!==d.size||await sha256(bytes)!==d.sha256)throw Error('Anexo corrompido: '+d.name);value.attachments.push({id:d.id,data:toBase64(bytes)});}
  return value;
}
export async function decodeBundle(value){
  const state=validateBackup(value),records=value.attachments||[];
  if(!Array.isArray(records)||records.length!==state.documents.length)throw Error('Backup sem todos os anexos.');
  if(state.documents.reduce((n,d)=>n+d.size,0)>MAX_TOTAL)throw Error('Anexos excedem 25 MB.');
  const byId=new Map();
  for(const record of records){if(!record||typeof record.id!=='string'||!record.id||byId.has(record.id))throw Error('Anexos duplicados ou ausentes.');byId.set(record.id,record);}
  const files=[];
  for(const d of state.documents){const found=byId.get(d.id);if(!found)throw Error('Anexos duplicados ou ausentes.');const bytes=fromBase64(found.data,5*1024*1024);if(bytes.length!==d.size||await sha256(bytes)!==d.sha256)throw Error('Integridade do anexo não confere: '+d.name);validateDocument(bytes,d.mime);files.push({id:d.id,blob:new Blob([bytes],{type:d.mime})});}
  return {state,files};
}
export async function restoreBundle(bundle){
  if(hasRemoteWorkspace()){
    const attachments=[];for(const f of bundle.files)attachments.push({id:f.id,data:toBase64(new Uint8Array(await f.blob.arrayBuffer()))});
    return remoteTransaction(state=>{
      if(state.jobs.some(j=>['queued','running'].includes(j.status)))throw Error('Cancele as consultas antes de restaurar.');
      for(const key of Object.keys(state))delete state[key];Object.assign(state,structuredClone(bundle.state));
      return {extra:{attachments,replaceAttachments:true}};
    });
  }
  const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(['workspace','attachments'],'readwrite'),ws=tx.objectStore('workspace'),r=ws.get('state');let error;
    r.onsuccess=()=>{try{const current=migrateState(r.result);if(current.jobs.some(j=>['queued','running'].includes(j.status)))throw Error('Cancele as consultas antes de restaurar.');const state=structuredClone(bundle.state);state.revision=Math.max(current.revision||0,state.revision||0)+1;ws.put(state,'state');const store=tx.objectStore('attachments');store.clear();for(const f of bundle.files)store.put(f);}catch(e){error=e;tx.abort();}};
    tx.oncomplete=()=>resolve();tx.onabort=()=>reject(error||tx.error);tx.onerror=()=>reject(error||tx.error);
  });
}
