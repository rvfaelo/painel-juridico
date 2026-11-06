import test from 'node:test';
import assert from 'node:assert/strict';
import {inferCnjJurisdiction,updateCnjInference} from '../cnj-inference.js';

// Números sintéticos com dígito verificador válido; não representam consultas reais.
function number(j='8',tr='19',unit='0021'){
  const base='0000001'+'2026'+j+tr+unit;
  const check=String(98n-BigInt(base+'00')%97n).padStart(2,'0');
  return base.slice(0,7)+check+base.slice(7);
}
function form(cnj,court=''){
  const controls={cnj:{value:cnj},court:{value:court},originUnit:{value:''},courtLevel:{value:'second'},processSystem:{value:'pje'}};
  const summary={textContent:'',dataset:{}};
  return {controls,summary,elements:{namedItem:name=>controls[name]},querySelector:()=>summary};
}

test('CNJ: número informado pelo usuário identifica tribunal, ano e Duque de Caxias',()=>{
  const r=inferCnjJurisdiction('0818446-42.2026.8.19.0021');
  assert.equal(r.tribunal,'TJRJ');
  assert.equal(r.year,'2026');
  assert.equal(r.originCode,'0021');
  assert.equal(r.originUnit,'Comarca de Duque de Caxias');
  assert.match(r.segment,/Estadual/);
});
test('CNJ: incompleto e dígito verificador incorreto não geram classificação',()=>{
  assert.equal(inferCnjJurisdiction('0818446'),null);
  assert.equal(inferCnjJurisdiction('0818446-43.2026.8.19.0021'),null);
});
test('CNJ: Federal, Trabalhista e STF são distinguidos sem inventar sistema ou grau',()=>{
  for(const [j,tr,expected] of [['4','02','TRF2'],['5','01','TRT da 1ª Região'],['1','00','STF']]){
    const r=inferCnjJurisdiction(number(j,tr));
    assert.equal(r.tribunal,expected);
    assert.equal(r.originUnit,'');
    assert.equal(Object.hasOwn(r,'processSystem'),false);
    assert.equal(Object.hasOwn(r,'courtLevel'),false);
  }
});
test('Tabela: código desconhecido e tribunal sem tabela não reutilizam nomes do TJRJ',()=>{
  assert.equal(inferCnjJurisdiction(number('8','19','8998')).originUnit,'');
  assert.equal(inferCnjJurisdiction(number('8','26','0021')).originUnit,'');
});
test('Tabela: código 0001 mantém as duas designações e comunica ambiguidade',()=>{
  const r=inferCnjJurisdiction(number('8','19','0001'));
  assert.deepEqual(r.originUnitNames,['Comarca da Capital','Processos da VEP']);
  assert.match(r.originUnit,/ambíguo/);
});
test('Formulário: preenche tribunal e unidade sem modificar grau e sistema',()=>{
  const f=form(number());updateCnjInference(f);
  assert.equal(f.controls.court.value,'tjrj');
  assert.equal(f.controls.originUnit.value,'Comarca de Duque de Caxias');
  assert.equal(f.controls.courtLevel.value,'second');
  assert.equal(f.controls.processSystem.value,'pje');
});
test('Formulário: seleção manual divergente é preservada e sinalizada',()=>{
  const f=form(number(),'stj');updateCnjInference(f);
  assert.equal(f.controls.court.value,'stj');
  assert.equal(f.summary.dataset.level,'warning');
  assert.match(f.summary.textContent,/preservado/);
});
test('Formulário: trocar CNJ elimina a unidade anterior e atualiza tribunal automático',()=>{
  const f=form(number());updateCnjInference(f);
  f.controls.cnj.value=number('4','02');updateCnjInference(f);
  assert.equal(f.controls.court.value,'trf2');
  assert.equal(f.controls.originUnit.value,'');
  f.controls.cnj.value='123';updateCnjInference(f);
  assert.equal(f.controls.court.value,'');
  assert.equal(f.controls.originUnit.value,'');
});
test('Formulário: ambiguidade não aparece como uma unidade confirmada',()=>{
  const f=form(number('8','19','0001'));updateCnjInference(f);
  assert.match(f.controls.originUnit.value,/ambíguo/);
  assert.match(f.summary.textContent,/mais de uma designação/);
});
