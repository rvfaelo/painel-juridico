import test from 'node:test';
import assert from 'node:assert/strict';
import {officialConsultation} from '../official-links.js';
import {cnj,fixtureCnj} from './helpers.mjs';

test('consultas manuais do TJRJ estão limitadas a CNJs válidos da Justiça Estadual RJ',()=>{
  const info=officialConsultation(fixtureCnj);
  assert.ok(info);
  assert.match(info.number,/^\d{7}-\d{2}\.\d{4}\.8\.19\.\d{4}$/);
  assert.deepEqual(info.links.map(link=>link.id),['portal','pje2','projudi','eproc']);
  for(const item of info.links){
    assert.equal(new URL(item.url).protocol,'https:');
    assert.ok(['www.tjrj.jus.br','www3.tjrj.jus.br','tjrj.pje.jus.br'].includes(new URL(item.url).hostname));
    assert.ok(!item.url.includes(fixtureCnj));
  }
  assert.equal(officialConsultation(cnj(3,'4','02')),null);
  assert.equal(officialConsultation(cnj(4,'8','26')),null);
  assert.equal(officialConsultation(fixtureCnj.slice(0,7)+'00'+fixtureCnj.slice(9)),null);
  assert.equal(officialConsultation(''),null);
  assert.equal(officialConsultation(fixtureCnj,'eproc').links[0].id,'eproc');
  assert.equal(officialConsultation(fixtureCnj,'pje').links[0].id,'pje2');
  assert.equal(officialConsultation(fixtureCnj,'projudi').links[0].id,'projudi');
});

test('portais oficiais são separados por tribunal declarado e não inferidos de outros CNJs',()=>{
  const samples=[
    {court:'trf2',cnj:cnj(201,'4','02'),processSystem:'eproc',expected:['eproc','portal','orientacoes'],domain:'trf2.jus.br'},
    {court:'tjsp',cnj:cnj(202,'8','26'),processSystem:'esaj',expected:['esaj','portal','eproc'],domain:'tjsp.jus.br'},
    {court:'stj',cnj:cnj(203,'3','00'),docketNumber:'REsp fictício',expected:['portal'],domain:'stj.jus.br'},
    {court:'stf',cnj:'',docketNumber:'RE fictício 123',expected:['portal'],domain:'stf.jus.br'}
  ];
  for(const sample of samples){
    const found=officialConsultation(sample);
    assert.equal(found.court,sample.court);
    assert.deepEqual(found.links.map(l=>l.id),sample.expected);
    assert.ok(found.links.every(l=>new URL(l.url).hostname.endsWith(sample.domain)));
    assert.ok(found.links.every(l=>(!sample.cnj||!l.url.includes(sample.cnj))&&(!sample.docketNumber||!l.url.includes(sample.docketNumber))));
  }
  assert.equal(officialConsultation(cnj(204,'4','02')),null,'CNJ sem tribunal selecionado não define sistema sozinho.');
  assert.equal(officialConsultation({court:'other',cnj:cnj(204,'4','02')}),null,'Outro tribunal não deve gerar link genérico falso.');
  assert.equal(officialConsultation({court:'stf',cnj:''}),null,'Sem CNJ nem registro não há referência para consultar.');
  assert.equal(officialConsultation({court:'tjsp',cnj:cnj(205,'8','26'),processSystem:'eproc'}).links[0].id,'eproc');
});
