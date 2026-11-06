import test from 'node:test';
import assert from 'node:assert/strict';
import {unifiedPublications,publicationView,PUBLICATION_BATCH_SIZE} from '../publications.js';

const events=Array.from({length:235},(_,i)=>({id:`djen:${i}`,source:'djen',kind:'publication',date:'2026-11-04',cnj:String(i).padStart(20,'0'),text:`Comunicação número ${i}`,tribunal:'TJRJ',seen:i%2===0,caseId:i%5?'processo':''}));

test('lista unificada não duplica identidade e preserva conferência, teor e certidão',()=>{
  const cnj='12345678901234567890',id='djen:comunicacao';
  const state={cases:[{id:'c1',cnj,title:'Ação de Maria'}],events:[{id,cnj,source:'djen',kind:'publication',date:'2026-11-05',text:'Resumo local',seen:true}]};
  const remote=[{id,cnj,source:'djen',kind:'publication',case_id:'c1',occurred_at:'2026-11-05',text:'Teor completo do serviço',seen:0,is_new:1,certificate_hash:'abcdefghijklmnop',publication_details:'{"orgao":"Vara de exemplo"}'},
    {id,cnj,source:'djen',kind:'publication',case_id:'outro-vinculo',occurred_at:'2026-11-05',text:'Teor completo do serviço',seen:0,is_new:1,certificate_hash:'abcdefghijklmnop'},
    {id,cnj:'99999999999999999999',source:'djen',kind:'publication',occurred_at:'2026-11-04',text:'Outro processo',seen:1}];
  const before=JSON.stringify({state,remote});
  const rows=unifiedPublications(state,remote),merged=rows.find(e=>e.cnj===cnj);
  assert.equal(rows.length,2);assert.equal(merged.seen,false);assert.equal(merged.text,'Teor completo do serviço');
  assert.equal(merged.date,'2026-11-05');assert.equal(merged.caseId,'c1');assert.equal(merged.certificateHash,'abcdefghijklmnop');
  assert.equal(merged.publicationDetails.orgao,'Vara de exemplo');assert.equal(merged.serviceRefs.length,2);assert.deepEqual(merged.localIds,[id]);
  assert.equal(publicationView(rows,'acao de maria').total,1);
  assert.equal(publicationView(rows,'1234567-89.0123').total,1);
  assert.equal(JSON.stringify({state,remote}),before);
});

test('referência inicial mantém estado original e registros locais funcionam sem serviço',()=>{
  const remote=[{id:'djen:base',source:'djen',cnj:'12345678901234567890',kind:'publication',seen:0,is_new:0,occurred_at:'2026-11-04'}];
  const [base]=unifiedPublications({cases:[],events:[]},remote);
  assert.equal(base.is_new,0);assert.equal(base.seen,false);assert.equal(base.localIds.length,0);
  assert.equal(publicationView([base],'','unread').total,0);
  assert.equal(publicationView([base]).counts.unread,0);
  assert.equal(unifiedPublications({events},[]).length,235);
});
events.push({id:'datajud:1',source:'datajud',kind:'movement',cnj:'999',date:'2026-11-05',text:'Movimento',seen:false});

test('triagem mantém estado de conferência e contagens corretas entre filtros',()=>{
  const full=publicationView(events);
  assert.equal(full.counts.all,235);assert.equal(full.counts.reviewed,118);assert.equal(full.counts.unread,117);assert.equal(full.counts.unlinked,47);
  assert.equal(full.rows.length,PUBLICATION_BATCH_SIZE);assert.equal(full.hasMore,true);
  const unread=publicationView(events,'','unread',500);
  assert.equal(unread.rows.length,117);assert.equal(unread.hasMore,false);
  assert.ok(unread.rows.every(e=>!e.seen));
  const reviewed=publicationView(events,'','reviewed',500);assert.equal(reviewed.rows.length,118);
  const unlinked=publicationView(events,'','unlinked',500);assert.equal(unlinked.rows.length,47);
  assert.ok(unlinked.rows.every(e=>!e.caseId));
  assert.equal(events.length,236);assert.equal(events[0].id,'djen:0');
});

test('pesquisa e paginação mostram registros depois do primeiro lote sem ocultá-los',()=>{
  const first=publicationView(events,'','all',100);
  const second=publicationView(events,'','all',200);
  const end=publicationView(events,'','all',300);
  assert.equal(first.rows.length,100);assert.equal(second.rows.length,200);
  assert.equal(end.rows.length,235);assert.equal(end.hasMore,false);
  assert.equal(new Set(end.rows.map(e=>e.id)).size,235);
  const one=publicationView(events,'número 234','all',100);
  assert.equal(one.total,1);assert.equal(one.rows[0].id,'djen:234');
  const accent=publicationView(events,'comunicação','all',100);assert.equal(accent.total,235);
  const noMatches=publicationView(events,'sem correspondência','all',100);assert.equal(noMatches.total,0);
  assert.throws(()=>publicationView(events,'','unknown'),/Filtro de publicações inválido/);
});
