import test from 'node:test';
import assert from 'node:assert/strict';
import {notificationRows,selectNotifications,notificationKey,NotificationCenter} from '../notifications.js';
import {cnj} from './helpers.mjs';

const local=(id='djen:1',extra={})=>({id,cnj:cnj(),caseId:'c1',source:'djen',kind:'publication',text:'Intimação para manifestação',date:'2026-11-05',discoveredAt:'2026-11-06T10:00:00Z',seen:false,...extra});
const state={cases:[{id:'c1',cnj:cnj(),title:'Caso de demonstração',court:'tjrj'}],events:[local()]};

test('central deduplica por fonte, CNJ e ID sem perder referências de conferência',()=>{
  const remote={id:'djen:1',source:'djen',cnj:cnj(),kind:'publication',case_id:'c1',seen:1,text:'Teor do serviço',first_seen:'2026-11-06T11:00:00Z',occurred_at:'2026-11-05'};
  const rows=notificationRows(state,[remote,{...remote,case_id:''}]);
  assert.equal(rows.length,1);assert.equal(rows[0].serviceRefs.length,2);assert.deepEqual(rows[0].localIds,['djen:1']);
  assert.equal(rows[0].seen,false);assert.equal(rows[0].title,state.cases[0].title);assert.equal(rows[0].tribunal,'TJRJ');
  assert.equal(notificationRows(state,[{...remote,cnj:cnj(2)}]).length,2);
  assert.notEqual(notificationKey(local()),notificationKey(local('djen:1',{source:'datajud'})));
});

test('filtros combinam estado, CNJ formatado, texto sem acento, tipo, fonte e período',()=>{
  const rows=notificationRows({...state,events:[local(),local('datajud:1',{source:'datajud',kind:'movement',seen:true,date:'2026-11-01'})]});
  assert.equal(selectNotifications(rows,{status:'unseen'}).total,1);
  assert.equal(selectNotifications(rows,{status:'seen',kind:'movement',source:'datajud'}).total,1);
  assert.equal(selectNotifications(rows,{search:'intimacao',from:'2026-11-05',to:'2026-11-05',court:'TJRJ',caseId:'c1'}).total,1);
  assert.equal(selectNotifications(rows,{search:'0000001-16.2026.8.19.0001'.replace('-16','-'+cnj().slice(7,9))}).total,2);
  assert.equal(selectNotifications(rows,{from:'2026-11-06'}).total,0);
  assert.equal(selectNotifications(rows,{search:'inexistente'}).total,0);
});

test('paginação não descarta histórico e ajusta página após conferência/filtro',()=>{
  const rows=notificationRows({...state,events:Array.from({length:47},(_,i)=>local('djen:'+i,{seen:i<7}))});
  const last=selectNotifications(rows,{status:'all'},3);assert.equal(last.rows.length,7);assert.equal(last.total,47);
  assert.deepEqual(last.counts,{all:47,unseen:40,seen:7});
  assert.equal(selectNotifications(rows,{status:'seen'},3).page,1);
  assert.equal(new Set([1,2,3].flatMap(p=>selectNotifications(rows,{},p).rows.map(e=>e.key))).size,47);
});

test('filtro de período usa a mesma data brasileira exibida no evento',()=>{
  const rows=notificationRows({...state,events:[local('utc',{date:'2026-11-05T01:00:00Z'})]});
  assert.equal(selectNotifications(rows,{from:'2026-11-04',to:'2026-11-04'}).total,1);
  assert.equal(selectNotifications(rows,{from:'2026-11-05'}).total,0);
});

test('CNJ alterado não vincula notificação antiga à ficha nova',()=>{
  const rows=notificationRows({cases:[{id:'c1',cnj:cnj(2),title:'Outro número'}],events:[local()]});
  assert.equal(rows[0].caseId,'');assert.equal(rows[0].title,'Processo não vinculado');
});

test('resposta de leitura antiga não sobrescreve conferência mais recente',async()=>{
  const previous=globalThis.document;let resolve;
  globalThis.document={querySelectorAll:()=>[],getElementById:()=>null};
  try{
    const center=new NotificationCenter({getState:()=>state,isIntegrated:()=>true,apiGet:()=>new Promise(r=>resolve=r)});
    const pending=center.refresh(true);
    center.writeEpoch++;center.events=[{id:'current'}];
    resolve({events:[{id:'stale'}]});await pending;
    assert.equal(center.events[0].id,'current');
  }finally{globalThis.document=previous;}
});
