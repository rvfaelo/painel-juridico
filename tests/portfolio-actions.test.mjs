import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,saveEntity,backup,validateBackup,caseDeletionImpact,deleteCases} from '../core.js';
import {publicationDateBR,safePublicationUrl,publicationPdfFilename,publicationPdfBlob,djenCertificateUrl,officialCertificateFilename,fetchOfficialCertificate} from '../publication-pdf.js';
import {fixtureCnj} from './helpers.mjs';

test('exclusão conserva histórico, consultas, valores e vínculos não processuais',()=>{
  const s=emptyState();
  const c=saveEntity(s,'cases',{title:'Processo de teste',cnj:fixtureCnj,stage:'todo'});
  s.tasks.push({id:'task1',title:'Conferir',caseId:c.id,stage:'todo',due:'',manualCheckId:''});
  s.appointments.push({id:'appointment1',title:'Reunião',caseId:c.id,when:'2026-11-05T10:00'});
  s.fees.push({id:'fee1',title:'Honorários',caseId:c.id,amount:10000,paid:0,due:''});
  s.jobs.push({id:'job1',caseId:c.id,cnj:fixtureCnj,source:'djen',status:'queued',updatedAt:'2026-11-05T12:00:00Z',createdAt:'2026-11-05T12:00:00Z'});
  s.events.push({id:'event1',caseId:c.id,cnj:fixtureCnj,kind:'publication',source:'djen',date:'2026-11-04',text:'Texto original',discoveredAt:'2026-11-05T12:00:00Z'});
  const impact=caseDeletionImpact(s,[c.id]);
  assert.deepEqual([impact.tasks,impact.appointments,impact.fees,impact.events,impact.jobs],[1,1,1,1,1]);
  deleteCases(s,[c.id]);
  assert.equal(s.cases.length,0);
  assert.equal(s.tasks[0].caseId,'');assert.equal(s.appointments[0].caseId,'');
  assert.equal(s.fees[0].amount,10000);assert.equal(s.fees[0].caseId,'');
  assert.equal(s.events[0].text,'Texto original');assert.equal(s.events[0].caseId,'');
  assert.equal(s.jobs[0].status,'cancelled');assert.equal(s.jobs[0].caseId,'');
  assert.equal(validateBackup(backup(s)).cases.length,0);
});

test('bloqueia exclusão de anexos, comparações e conferências sem destruir dados',()=>{
  const s=emptyState(),c=saveEntity(s,'cases',{title:'Sensível',cnj:fixtureCnj,stage:'todo'});
  s.documents.push({id:'doc1',caseId:c.id});
  assert.throws(()=>deleteCases(s,[c.id]),/preservar anexos/);
  assert.equal(s.cases.length,1);assert.equal(s.documents.length,1);
  s.documents=[];c.manualChecks=[{id:'check1'}];
  assert.throws(()=>deleteCases(s,[c.id]),/conferências/);
  s.cases[0].manualChecks=[];s.coverageSamples.push({id:'sample1',caseId:c.id});
  assert.throws(()=>deleteCases(s,[c.id]),/comparações/);
  assert.equal(s.cases.length,1);
});

test('publicações mostram datas brasileiras, sem supor fuso de origem ausente',()=>{
  assert.equal(publicationDateBR('2026-11-05'),'05/11/2026');
  assert.equal(publicationDateBR('2026-11-05T01:30:00Z'),'04/11/2026');
  assert.equal(publicationDateBR('2026-11-05T01:30:00'),'05/11/2026');
  assert.equal(publicationDateBR('2026-02-30'),'Sem data');
  assert.equal(publicationDateBR('invalid'),'Sem data');
  assert.equal(safePublicationUrl('javascript:alert(1)'),'');
  assert.equal(safePublicationUrl('http://exemplo.com'),'');
  assert.equal(safePublicationUrl('https://user:password@example.com/'),'');
  assert.equal(safePublicationUrl('https://www.cnj.jus.br/documento'),'https://www.cnj.jus.br/documento');
});

test('gera PDF A4 local, pesquisável, com fonte, CNJ, texto e paginação',async()=>{
  const item={id:'djen:teste',source:'DJEN',tribunal:'TJRJ',cnj:fixtureCnj,date:'2026-11-05',url:'https://www.cnj.jus.br/',text:'Publicação de intimação fictícia.\n'+('Ação e decisão judicial de teste. '.repeat(260))};
  const blob=publicationPdfBlob(item),data=Buffer.from(await blob.arrayBuffer());
  const output=data.toString('latin1');
  assert.equal(blob.type,'application/pdf');
  assert.equal(data.subarray(0,8).toString('latin1'),'%PDF-1.4');
  assert.match(output,/\/MediaBox \[0 0 595 842\]/);
  assert.match(output,/\/Count [2-9]/);
  assert.match(output,/05\/11\/2026/);
  assert.match(output,/Publica\xe7\xe3o/);
  assert.match(output,/https:\/\/www.cnj.jus.br\//);
  assert.match(output,/%%EOF\s*$/);
  const xref=Number(output.match(/startxref\n(\d+)\n/)[1]);
  assert.equal(output.slice(xref,xref+4),'xref');
  assert.match(publicationPdfFilename(item),/\.pdf$/);
});

test('certidão DJEN: gera somente endereço oficial com hash validado',()=>{
  const hash='qo8LEjMv6g2sAodc5TGKzLJRmrz2A1';
  assert.equal(djenCertificateUrl(hash),'https://comunicaapi.pje.jus.br/api/v1/comunicacao/'+hash+'/certidao');
  for(const invalid of ['',null,'abc','../segredo','https://evil.test/', 'a'.repeat(129),'abc\n'+hash]){
    assert.equal(djenCertificateUrl(invalid),'');
  }
  assert.match(officialCertificateFilename({id:'djen:17',date:'2026-11-05',cnj:fixtureCnj}),/^CNJ-certidao-publicacao-.*\.pdf$/);
});

test('certidão oficial: download binário exige PDF e evita converter HTML em documento',async()=>{
  const item={id:'djen:17',certificateHash:'qo8LEjMv6g2sAodc5TGKzLJRmrz2A1'};
  const pdf=new TextEncoder().encode('%PDF-1.7\nCORPO TESTE');
  const requests=[];
  const fetcher=async url=>{requests.push(url);return new Response(pdf,{headers:{'Content-Type':'application/pdf'}});};
  const blob=await fetchOfficialCertificate(item,{fetcher});
  assert.equal(blob.type,'application/pdf');
  assert.equal((await blob.text()).startsWith('%PDF-'),true);
  assert.equal(requests[0],djenCertificateUrl(item.certificateHash));
  await fetchOfficialCertificate({...item,certificate_hash:item.certificateHash,certificateHash:undefined},
    {integrated:true,fetcher});
  assert.equal(requests[1],'/api/v1/publications/djen%3A17/certidao');
  await assert.rejects(()=>fetchOfficialCertificate(item,{fetcher:async()=>new Response('<html>bloqueio</html>')}),/PDF válido/);
  await assert.rejects(()=>fetchOfficialCertificate(item,{fetcher:async()=>new Response('',{status:429})}),/HTTP 429/);
  await assert.rejects(()=>fetchOfficialCertificate(item,{fetcher:async()=>{throw new TypeError('Failed to fetch');}}),/CORS/);
  await assert.rejects(()=>fetchOfficialCertificate({id:'djen:1',certificateHash:'123'}, {fetcher}),/não possui código/);
});
