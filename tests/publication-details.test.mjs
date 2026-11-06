import test from 'node:test';
import assert from 'node:assert/strict';
import {rawDjenDetails,publicationDetailsHTML} from '../publication-details.js';
import {integratedCaseHTML} from '../integrated-case-view.js';

test('DJEN apresenta destinatarios e OAB sem expor campos privados extras ou executar HTML',()=>{
  const data=rawDjenDetails({nomeOrgao:'Vara exemplo',destinatarios:[{nome:'<img src=x>',polo:'A',cpf:'nao copiar'}],
    destinatarioadvogados:[{advogado:{nome:'Advogado exemplo',numero_oab:'123',uf_oab:'RJ',cpf:'nao copiar'}}]});
  const html=publicationDetailsHTML({publication_details:JSON.stringify(data)});
  assert.match(html,/OAB RJ 123/);assert.match(html,/Polo ativo/);assert.match(html,/&lt;img src=x&gt;/);
  assert.doesNotMatch(html,/<img|nao copiar/);
});
test('registro antigo ou JSON invalido nao inventa destinatarios',()=>{
  for(const value of ['', 'invalid', '{}'])assert.match(publicationDetailsHTML({publication_details:value}),/ainda não disponíveis/);
});
test('secoes separam fontes e nao usam metadados DJEN como cadastro',()=>{
  const html=integratedCaseHTML({events:[
    {id:'mov1',source:'datajud',kind:'movement',text:'MOVIMENTO EXEMPLO'},
    {id:'pub1',source:'djen',kind:'publication',text:'PUBLICACAO EXEMPLO',publicationDetails:{orgao:'ORGAO DA PUBLICACAO'}}],
    tramitations:[{id:'x',source:'djen',sistema:'NAO USAR COMO SISTEMA'}]},'case1');
  const split=html.indexOf('aria-label="Publicações · DJEN"');
  const datajud=html.slice(0,split),djen=html.slice(split);
  assert.match(datajud,/MOVIMENTO EXEMPLO/);assert.doesNotMatch(datajud,/PUBLICACAO EXEMPLO/);
  assert.match(djen,/PUBLICACAO EXEMPLO/);assert.doesNotMatch(djen,/MOVIMENTO EXEMPLO/);
  assert.doesNotMatch(html,/NAO USAR COMO SISTEMA/);
  assert.match(datajud,/update-datajud/);assert.match(djen,/update-djen/);
});
