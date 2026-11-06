import {notificationRows,notificationKey} from './notifications.js';
import {publicationDetails} from './publication-details.js';

// Uma identidade por fonte, CNJ e comunicação; mantém ações locais e remotas.
export function unifiedPublications(state,serviceEvents=[]) {
  const normalize=e=>({...e,certificateHash:e.certificateHash||e.certificate_hash||'',
    publicationDetails:publicationDetails(e),publicationStatus:e.publicationStatus||e.publication_status||''});
  const metadata=new Map();
  for(const event of [...(state.events||[]),...serviceEvents]){
    const key=notificationKey(event),old=metadata.get(key)||{},current=normalize(event);
    metadata.set(key,{certificateHash:current.certificateHash||old.certificateHash||'',
      publicationDetails:Object.keys(current.publicationDetails).length?current.publicationDetails:old.publicationDetails});
  }
  return notificationRows({...state,events:(state.events||[]).map(normalize)},serviceEvents.map(normalize))
    .filter(e=>e.kind==='publication').map(e=>{
      return {...e,...metadata.get(e.key)};
    });
}

// Seleção local, sem alterar o reconhecimento das publicações nem consultar fontes.
export const PUBLICATION_FILTERS = Object.freeze({all:'Todas',unread:'Novas',reviewed:'Conferidas',unlinked:'Sem processo'});
export const PUBLICATION_BATCH_SIZE = 100;

export function publicationView(events,query='',filter='all',limit=PUBLICATION_BATCH_SIZE) {
  if(!Object.hasOwn(PUBLICATION_FILTERS,filter))throw Error('Filtro de publicações inválido.');
  const fold=v=>String(v).normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR');
  const needle=fold(query).trim(),cnjQuery=String(query).replace(/\D/g,'');
  const matches=events.filter(e=>e.kind==='publication'&&(!needle||fold(`${e.title||''} ${e.cnj||''} ${e.text||''} ${e.tribunal||''}`).includes(needle)||cnjQuery.length>=7&&String(e.cnj||'').includes(cnjQuery)));
  const unread=e=>!e.seen&&(!e.remote||!!e.is_new||!!e.localIds?.length);
  const counts={all:matches.length,unread:0,reviewed:0,unlinked:0};
  for(const e of matches){if(e.seen)counts.reviewed++;else if(unread(e))counts.unread++;if(!e.caseId)counts.unlinked++;}
  const rows=matches.filter(e=>filter==='all'||filter==='unread'&&unread(e)||filter==='reviewed'&&!!e.seen||filter==='unlinked'&&!e.caseId)
    .sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.id).localeCompare(String(a.id)));
  const safeLimit=Number.isSafeInteger(limit)?Math.max(1,limit):PUBLICATION_BATCH_SIZE;
  return {counts,total:rows.length,rows:rows.slice(0,safeLimit),hasMore:rows.length>safeLimit};
}
