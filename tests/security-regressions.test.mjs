import test from 'node:test';
import assert from 'node:assert/strict';
import {safeDateLabel,validStoredDate} from '../safe-dates.js';
import {emptyState,saveEntity,validateBackup,backup,enqueue} from '../core.js';
import {fixtureCnj} from './helpers.mjs';
test('datas nunca devolvem markup e rejeitam calendario impossivel',()=>{
 for(const value of ['<textarea>','<img>',{},null,'2026-02-30','2026-11-06<script>'])assert.equal(safeDateLabel(value),'Sem data');
 assert.equal(safeDateLabel('2026-11-06T10:30:00Z'),'06/11/2026');
 assert.equal(validStoredDate('2026-11-06T25:00:00Z'),false);
});
test('restauracao rejeita metadados de datas sem rejeitar campos legados ausentes',()=>{
 const s=emptyState(),c=saveEntity(s,'cases',{title:'Caso fictício',cnj:fixtureCnj});
 s.documents.push({id:'doc-test',caseId:c.id,name:'teste.txt',mime:'text/plain',size:1,sha256:'a'.repeat(64)});
 assert.doesNotThrow(()=>validateBackup(backup(s)));
 s.documents[0].createdAt='<textarea>';assert.throws(()=>validateBackup(backup(s)),/Anexo inválido/);
 s.documents[0].createdAt='2026-11-06T10:00:00Z';enqueue(s,[c.id]);
 s.jobs[0].periodStart='<textarea>';assert.throws(()=>validateBackup(backup(s)),/Período/);
 s.jobs[0].periodStart='2026-11-05';s.jobs[0].periodEnd='2026-11-04';assert.throws(()=>validateBackup(backup(s)),/invertido/);
 s.jobs[0].periodEnd='2026-11-06';assert.doesNotThrow(()=>validateBackup(backup(s)));
});
