import test from 'node:test';
import assert from 'node:assert/strict';
import {cnj,fixtureCnj} from './helpers.mjs';
import {emptyState,saveEntity,backup,validateBackup} from '../core.js';
import {suggestions,applyEmptyFields,normalizedDetails,mergeDetails} from '../datajud-prefill.js';

const row1={id:'datajud:g1',tribunal:'TJRJ',grau:'G1',sistema:'PJe',
  classe:'Procedimento Comum',assuntos:['Responsabilidade Civil'],orgao:'2ª Vara Cível',
  dataAjuizamento:'2025-10-21',sourceUpdatedAt:'2026-11-05'};
const row2={id:'datajud:g2',tribunal:'TJRJ',grau:'G2',sistema:'eproc',
  classe:'Apelação',assuntos:['Danos morais'],orgao:'Câmara Cível'};

function form(selects={}) {
  const controls=Object.fromEntries(['court','courtLevel','processSystem'].map(name=>[name,{
    value:selects[name]||'',options:(name==='court'?['','tjrj','trf2','tjsp','stj','stf','other']:
      name==='courtLevel'?['','first','second','superior','other']:['','pje','eproc','projudi','esaj','other'])
      .map(value=>({value}))
  }]));
  return {elements:{namedItem:name=>controls[name]},controls};
}

test('DataJud: grau G1/G2 e sistemas são mapeados apenas de nome legível',()=>{
  assert.deepEqual(suggestions(row1),{court:'tjrj',courtLevel:'first',processSystem:'pje'});
  assert.deepEqual(suggestions(row2),{court:'tjrj',courtLevel:'second',processSystem:'eproc'});
  assert.equal(suggestions({...row1,tribunal:'TJMG'}).court,'other');
  assert.equal(suggestions({...row1,grau:'',sistema:''}).courtLevel,'');
  assert.equal(suggestions({...row1,grau:'',sistema:''}).processSystem,'');
});

test('DataJud: preenche somente selects vazios e preserva campos manuais',()=>{
  const f=form({court:'tjrj',processSystem:'esaj'});
  const result=applyEmptyFields(f,row2,null,fixtureCnj);
  assert.equal(f.controls.court.value,'tjrj');
  assert.equal(f.controls.processSystem.value,'esaj');
  assert.equal(f.controls.courtLevel.value,'second');
  assert.deepEqual(result.filled,['Grau']);
  assert.deepEqual(result.preserved,['Tribunal','Sistema']);
  assert.equal(result.details.classe,'Apelação');
  assert.equal(result.details.orgao,'Câmara Cível');
  assert.equal(result.details.cnj,fixtureCnj);
});

test('DataJud: tribunal manual divergente não preenche grau nem sistema incompatíveis',()=>{
  const f=form({court:'stj'});
  const result=applyEmptyFields(f,row1,null,fixtureCnj);
  assert.equal(f.controls.court.value,'stj');
  assert.equal(f.controls.courtLevel.value,'');
  assert.equal(f.controls.processSystem.value,'');
  assert.ok(result.missing.some(x=>x.includes('tribunal')));
});

test('DataJud: campos ausentes são sinalizados, sem inventar grau ou outros dados',()=>{
  const f=form(),result=applyEmptyFields(f,{id:'datajud:sem',tribunal:'TJRJ',grau:'',sistema:'',
    classe:'',assuntos:[],orgao:''},null,fixtureCnj);
  assert.equal(f.controls.court.value,'tjrj');
  assert.equal(f.controls.courtLevel.value,'');
  assert.equal(f.controls.processSystem.value,'');
  assert.deepEqual(result.missing,['Grau','Sistema','Classe','Assuntos','Órgão julgador','Data de ajuizamento']);
});

test('DataJud: metadados anteriores não são sobrescritos, mas lacunas são preenchidas',()=>{
  const existing=normalizedDetails({...row1,orgao:'',assuntos:[]},fixtureCnj);
  const combined=mergeDetails(existing,normalizedDetails(row2,fixtureCnj));
  assert.equal(combined.classe,'Procedimento Comum');
  assert.equal(combined.orgao,'Câmara Cível');
  assert.equal(combined.grau,'G1');
  assert.deepEqual(combined.assuntos,['Danos morais']);
});

test('DataJud: informa quando só os dados públicos foram adicionados',()=>{
  const f=form({court:'tjrj',courtLevel:'first',processSystem:'pje'});
  const result=applyEmptyFields(f,row1,null,fixtureCnj);
  assert.deepEqual(result.filled,[]);
  assert.ok(result.metadataFilled.includes('Classe'));
  assert.ok(result.metadataFilled.includes('Assuntos'));
  assert.ok(result.metadataFilled.includes('Data de ajuizamento'));
});

test('DataJud: reaplicar dados existentes não informa preenchimento inexistente',()=>{
  const f=form(),first=applyEmptyFields(f,row1,null,fixtureCnj);
  const repeated=applyEmptyFields(f,row1,first.details,fixtureCnj);
  assert.deepEqual(repeated.filled,[]);
  assert.deepEqual(repeated.metadataFilled,[]);
  assert.deepEqual(repeated.details,first.details);
  f.controls.courtLevel.value='';
  const refill=applyEmptyFields(f,row1,repeated.details,fixtureCnj);
  assert.deepEqual(refill.filled,['Grau']);
  assert.deepEqual(refill.metadataFilled,[]);
});

test('DataJud: salva metadados separados de notas, backup preserva e CNJ corrigido invalida associação',()=>{
  const s=emptyState(),details=normalizedDetails(row1,fixtureCnj);
  const record=saveEntity(s,'cases',{title:'Título escrito pela pessoa',cnj:fixtureCnj,
    notes:'Observação particular',court:'tjrj',courtLevel:'first',processSystem:'pje',
    datajudDetails:details});
  assert.equal(record.notes,'Observação particular');
  assert.equal(record.datajudDetails.classe,'Procedimento Comum');
  const restored=validateBackup(backup(s));
  assert.equal(restored.cases[0].datajudDetails.orgao,'2ª Vara Cível');
  assert.throws(()=>saveEntity(s,'cases',{...record,datajudDetails:{...details,cnj:cnj(5)}}),/Dados públicos/);
  saveEntity(s,'cases',{...record,cnj:cnj(5),confirmCnjChange:'yes',datajudDetails:undefined});
  assert.equal(s.cases[0].datajudDetails,undefined);
});

test('DataJud: backup rejeita metadados injetados ou CNJ divergente',()=>{
  const s=emptyState(),record=saveEntity(s,'cases',{title:'Teste',cnj:fixtureCnj});
  for(const payload of [
    {...normalizedDetails(row1,fixtureCnj),cnj:cnj(6)},
    {...normalizedDetails(row1,fixtureCnj),classe:'x'.repeat(181)},
    {...normalizedDetails(row1,fixtureCnj),assuntos:['x'.repeat(181)]}
  ]){
    record.datajudDetails=payload;
    assert.throws(()=>validateBackup(backup(s)),/Metadados DataJud/);
  }
});
