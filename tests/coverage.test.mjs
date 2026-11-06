import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,migrateState,saveEntity,enqueue,registerCoverageSample,latestCoverageJob,coverageSummary,coverageEvidenceMatrix,backup,validateBackup} from '../core.js';
import {fixtureCnj,cnj} from './helpers.mjs';

const notes='Conferi a publicação e as datas na fonte oficial correspondente.';
const base=(state,c,source='djen')=>({caseId:c.id,source,referenceDate:'2026-11-05',result:'match',notes});

test('comparação positiva exige consulta local concluída e guarda evidência manual no backup',()=>{
  const state=emptyState(),c=saveEntity(state,'cases',{title:'Caso público de demonstração',cnj:fixtureCnj});
  assert.equal(latestCoverageJob(state,c.id,'djen'),null);
  assert.throws(()=>registerCoverageSample(state,base(state,c)),/consulta concluída/);
  enqueue(state,[c.id]);assert.throws(()=>registerCoverageSample(state,base(state,c)),/consulta concluída/);
  const job=state.jobs.find(j=>j.source==='djen');job.status='success';job.updatedAt='2026-11-05T12:00:00.000Z';
  const record=registerCoverageSample(state,base(state,c));
  assert.equal(record.cnj,fixtureCnj);assert.equal(record.jobId,job.id);
  assert.equal(coverageSummary(state).sources.djen.match,1);
  const exported=backup(state),restored=validateBackup(exported);
  assert.equal(restored.coverageSamples[0].id,record.id);
  assert.equal(restored.coverageSamples[0].notes,notes);
  assert.equal(restored.jobs.find(j=>j.id===job.id).status,'success');
  assert.equal(restored.settings.datajudKey,'');
});

test('falha, ausência de chave ou fonte inacessível não pode ser registrada como coincidência',()=>{
  const state=emptyState(),c=saveEntity(state,'cases',{title:'Caso sem consulta',cnj:fixtureCnj});
  const report=registerCoverageSample(state,{...base(state,c,'datajud'),result:'unavailable'});
  assert.equal(report.jobId,'');assert.equal(coverageSummary(state).sources.datajud.unavailable,1);
  assert.throws(()=>registerCoverageSample(state,{...base(state,c),notes:'curto'}),/12 a 1.500/);
  assert.throws(()=>registerCoverageSample(state,{...base(state,c),referenceDate:'2099-01-01'}),/data/);
  state.settings.datajud=true;enqueue(state,[c.id]);
  state.jobs.find(j=>j.source==='datajud').status='error';
  assert.throws(()=>registerCoverageSample(state,base(state,c,'datajud')),/consulta concluída/);
  const inconclusive=registerCoverageSample(state,{...base(state,c,'datajud'),result:'inconclusive'});
  assert.equal(inconclusive.result,'inconclusive');
  assert.equal(coverageSummary(state).sources.datajud.match,0);
});

test('backup antigo mantém compatibilidade e adulteração de amostra é recusada',()=>{
  const old=emptyState();delete old.coverageSamples;
  const migrated=migrateState(old);assert.deepEqual(migrated.coverageSamples,[]);
  assert.deepEqual(validateBackup(backup(old)).coverageSamples,[]);
  const state=emptyState(),c=saveEntity(state,'cases',{title:'Exemplo',cnj:fixtureCnj});
  enqueue(state,[c.id]);const job=state.jobs[0];job.status='not_found';
  registerCoverageSample(state,{...base(state,c,'datajud'),result:'inconclusive'});
  const saved=backup(state);
  saved.state.coverageSamples[0].result='match';
  assert.throws(()=>validateBackup(saved),/Amostra de cobertura inválida/);
  saved.state.coverageSamples[0].result='inconclusive';
  saved.state.coverageSamples[0].caseId='inexistente';
  assert.throws(()=>validateBackup(saved),/Amostra de cobertura inválida/);
});

test('correção do número CNJ mantém histórico mas exclui amostra antiga do resumo atual',()=>{
  const state=emptyState(),c=saveEntity(state,'cases',{title:'Exemplo',cnj:fixtureCnj});
  registerCoverageSample(state,{...base(state,c),result:'inconclusive'});
  const before=state.coverageSamples[0].cnj;
  saveEntity(state,'cases',{...c,cnj:cnj(7,'8','19'),confirmCnjChange:'yes'});
  assert.equal(coverageSummary(state).total,0);
  assert.equal(coverageSummary(state).history,1);
  assert.equal(state.coverageSamples[0].cnj,before);
  assert.equal(validateBackup(backup(state)).coverageSamples.length,1);
});

test('mapa de cobertura mantém classificação registrada e conta casos distintos por fonte',()=>{
  const state=emptyState();
  const trf2=saveEntity(state,'cases',{title:'JEF fictício',cnj:cnj(901,'4','02'),court:'trf2',courtLevel:'jef',processSystem:'eproc'});
  const tjsp=saveEntity(state,'cases',{title:'TJSP fictício',cnj:cnj(902,'8','26'),court:'tjsp',courtLevel:'second',processSystem:'esaj'});
  const first=registerCoverageSample(state,{...base(state,trf2),result:'unavailable'});
  assert.deepEqual([first.court,first.courtLevel,first.processSystem],['trf2','jef','eproc']);
  registerCoverageSample(state,{...base(state,trf2),result:'inconclusive'});
  registerCoverageSample(state,{...base(state,trf2,'datajud'),result:'unavailable'});
  registerCoverageSample(state,{...base(state,tjsp),result:'unavailable'});
  const report=coverageEvidenceMatrix(state);
  assert.equal(report.historical,4);
  assert.equal(report.latestComparisons,3);
  assert.equal(report.distinctCases,2);
  assert.equal(report.outdated,0);
  assert.deepEqual(report.noSamples,['tjrj','stj','stf']);
  assert.equal(report.rows.find(r=>r.court==='trf2'&&r.source==='djen').cases,1);
  assert.equal(report.rows.find(r=>r.court==='trf2'&&r.source==='djen').inconclusive,1);
  assert.equal(report.rows.find(r=>r.court==='trf2'&&r.source==='djen').unavailable,0);
  assert.equal(report.rows.find(r=>r.court==='tjsp').processSystem,'esaj');
  assert.equal(validateBackup(backup(state)).coverageSamples[0].courtLevel,'jef');
});

test('edição da classificação não reatribui amostras antigas ao tribunal novo',()=>{
  const state=emptyState();
  const c=saveEntity(state,'cases',{title:'Caso de teste',cnj:cnj(910,'8','19'),court:'tjrj',courtLevel:'first',processSystem:'pje'});
  registerCoverageSample(state,{...base(state,c),result:'inconclusive'});
  assert.equal(coverageEvidenceMatrix(state).rows[0].court,'tjrj');
  saveEntity(state,'cases',{...c,court:'tjsp',courtLevel:'second',processSystem:'esaj'});
  const matrix=coverageEvidenceMatrix(state);
  assert.equal(matrix.latestComparisons,0);
  assert.equal(matrix.outdated,1);
  assert.equal(matrix.historical,1);
  assert.equal(coverageSummary(state).total,0);
  assert.equal(coverageSummary(state).history,1);
  assert.equal(state.coverageSamples[0].court,'tjrj');
  registerCoverageSample(state,{...base(state,c),result:'unavailable'});
  const updated=coverageEvidenceMatrix(state);
  assert.equal(updated.latestComparisons,1);
  assert.equal(updated.rows[0].court,'tjsp');
  assert.equal(updated.historical,2);
  assert.equal(state.coverageSamples[0].court,'tjrj');
  assert.equal(validateBackup(backup(state)).coverageSamples.length,2);
});

test('amostra legada sem classificação fica não informada e backup inválido é bloqueado',()=>{
  const state=emptyState();
  const c=saveEntity(state,'cases',{title:'Exemplo legado',cnj:cnj(920,'8','19'),court:'tjrj',courtLevel:'jec',processSystem:'projudi'});
  const item=registerCoverageSample(state,{...base(state,c),result:'inconclusive'});
  delete item.court;delete item.courtLevel;delete item.processSystem;
  const legacy=validateBackup(backup(state));
  const matrix=coverageEvidenceMatrix(legacy);
  assert.equal(matrix.latestComparisons,1);
  assert.equal(matrix.rows[0].court,'');
  assert.equal(matrix.rows[0].courtLevel,'');
  assert.equal(matrix.rows[0].processSystem,'');
  assert.ok(matrix.noSamples.includes('tjrj'));
  const modified=backup(legacy);
  modified.state.coverageSamples[0].court='tributal-inventado';
  assert.throws(()=>validateBackup(modified),/Classificação da amostra/);
});
