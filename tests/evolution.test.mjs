import test from 'node:test';import assert from 'node:assert/strict';
import {emptyState,migrateState,saveEntity,registerPayment,reversePayment,backup,validateBackup,validDay,validDateTime} from '../core.js';
import {encryptBackup,decryptBackup,toBase64,fromBase64} from '../backup-crypto.js';
import {sha256,validateDocument} from '../documents.js';
test('migração da 0.1 preserva saldos, metadados e gera uma abertura por honorário',()=>{
  const old=emptyState();old.schemaVersion=1;delete old.payments;delete old.documents;old.fees=[{id:'old-fee',title:'Contrato legado',amount:150000,paid:30000,due:'',caseId:'',createdAt:'2026-10-01T12:00:00Z'}];
  const next=migrateState(old);assert.equal(next.schemaVersion,2);assert.equal(next.fees[0].paid,30000);assert.equal(next.payments.length,1);assert.equal(next.payments[0].amount,30000);assert.equal(next.payments[0].opening,true);assert.equal(migrateState(next).payments.length,1);assert.equal(old.schemaVersion,1);
  const restored=validateBackup({format:'pauta-backup',version:1,state:old});assert.equal(restored.payments.length,1);
});
test('edição do caso preserva dados trazidos pelas fontes',()=>{
  const s=emptyState(),c=saveEntity(s,'cases',{title:'Caso'});c.sourceInfo={datajud:[{id:'external',grade:'G1'}]};saveEntity(s,'cases',{...c,title:'Novo nome'});assert.equal(s.cases[0].sourceInfo.datajud[0].id,'external');
});
test('recebimentos parciais e estornos mantêm histórico e saldo coerentes',()=>{
  const s=emptyState(),f=saveEntity(s,'fees',{title:'Contrato',amount:'1000'});const p=registerPayment(s,{feeId:f.id,amount:'250.25',date:'2026-11-01',notes:'Primeiro pagamento'});assert.equal(f.paid,25025);
  reversePayment(s,p.id,{date:'2026-11-02',notes:'Correção de lançamento'});assert.equal(f.paid,0);assert.equal(s.payments.length,2);
  assert.throws(()=>reversePayment(s,p.id,{date:'2026-11-02',notes:'Duplicado'}),/já foi/);
  assert.throws(()=>registerPayment(s,{feeId:f.id,amount:'1001',date:'2026-11-01'}),/saldo/);
  registerPayment(s,{feeId:f.id,amount:'1000',date:'2026-11-02'});assert.equal(validateBackup(backup(s)).fees[0].paid,100000);
  assert.throws(()=>saveEntity(s,'fees',{...f,amount:'999',paid:undefined}),/positivo/);
});
test('backup rejeita adulteração de saldo ou estorno sem recebimento',()=>{
  const s=emptyState(),f=saveEntity(s,'fees',{title:'Teste',amount:'100',paid:'20'});const b=backup(s);b.state.fees[0].paid=3000;assert.throws(()=>validateBackup(b),/inconsistente/);
  const c=backup(s);c.state.payments.push({id:'fake',feeId:f.id,kind:'reversal',reverses:'missing',amount:2000,date:'2026-11-05'});assert.throws(()=>validateBackup(c),/Estorno/);
});
test('AES-GCM restaura fielmente, usa aleatoriedade e recusa senha incorreta ou adulteração',async()=>{
  const payload=backup(emptyState()),password='senha-de-teste-2026';const a=await encryptBackup(payload,password),b=await encryptBackup(payload,password);assert.notEqual(a.data,b.data);assert.deepEqual(await decryptBackup(a,password),payload);
  await assert.rejects(()=>decryptBackup(a,'senha-incorreta'),/incorreta/);const bytes=fromBase64(a.data);bytes[0]^=1;await assert.rejects(()=>decryptBackup({...a,data:toBase64(bytes)},password),/corrompido/);
  await assert.rejects(()=>encryptBackup(payload,'curta'),/10/);await assert.rejects(()=>decryptBackup({...a,iterations:999999999},password),/suportado/);
});
test('anexos têm assinatura válida, hash e limites; datas impossíveis são rejeitadas',async()=>{
  const text=new TextEncoder().encode('Documento de teste');assert.equal(validateDocument(text,'text/plain'),true);assert.equal((await sha256(text)).length,64);assert.throws(()=>validateDocument(text,'application/pdf'),/formato/);assert.throws(()=>validateDocument(new Uint8Array(0),'text/plain'),/5 MB/);assert.throws(()=>validateDocument(new Uint8Array([65,0]),'text/plain'),/binário/);
  assert.equal(validDay('2026-02-30'),false);assert.equal(validDay('2024-02-29'),true);
});
test('agenda rejeita datas e horários impossíveis no cadastro e na restauração',()=>{
  const s=emptyState();
  assert.equal(validDateTime('2024-02-29T23:59'),true);
  for(const when of ['2026-02-30T12:00','2026-11-05T24:00','2026-11-05T12:60','2026-11-05T99:99']){
    assert.equal(validDateTime(when),false);
    assert.throws(()=>saveEntity(s,'appointments',{title:'Audiência',when}),/data\/hora/);
  }
  saveEntity(s,'appointments',{title:'Audiência',when:'2026-11-05T14:30'});
  assert.equal(validateBackup(backup(s)).appointments.length,1);
  const invalid=backup(s);invalid.state.appointments[0].when='2026-11-05T25:30';
  assert.throws(()=>validateBackup(invalid),/Compromisso inválido/);
});
