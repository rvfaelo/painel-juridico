import test from 'node:test';import assert from 'node:assert/strict';
import {isWaitingMessage,installLoadingIndicators} from '../loading-indicator.js';
test('indicador reconhece esperas e nao anima resultados ou falhas',()=>{
  for(const s of ['Consultando DataJud pelo serviço Python...','Lendo DJEN...','Verificando os registros','Gerando PDF…','Carregando anexos'])assert.equal(isWaitingMessage(s),true);
  for(const s of ['Consulta concluída','Busca não concluída: timeout','Nenhum resultado','Na fila','Consulta aguardando resultado.'])assert.equal(isWaitingMessage(s),false);
});
test('indicador inicia e encerra sem substituir a mensagem',()=>{
  const original=globalThis.MutationObserver;let callback;
  globalThis.MutationObserver=class{constructor(fn){callback=fn;}observe(){}disconnect(){}};
  const attrs={},node={nodeType:1,textContent:'Consultando...',dataset:{},matches:()=>true,querySelectorAll:()=>[],
    setAttribute(k,v){attrs[k]=v;if(k==='data-loading')this.dataset.loading=v;},
    removeAttribute(k){delete attrs[k];if(k==='data-loading')delete this.dataset.loading;},hasAttribute:k=>k in attrs};
  try{
    const stop=installLoadingIndicators(node);assert.equal(attrs['aria-busy'],'true');
    node.textContent='Consulta concluída';callback([{target:node,addedNodes:[]}]);
    assert.equal(attrs['data-loading'],undefined);assert.equal(node.textContent,'Consulta concluída');stop();
  }finally{globalThis.MutationObserver=original;}
});
