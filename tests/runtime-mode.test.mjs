import assert from 'node:assert/strict';
import test from 'node:test';
import {isIntegratedRuntime} from '../runtime-mode.js';

test('runtime aceita somente o servico local, mesmo com marcador legado de nuvem',()=>{
  const oldLocation=globalThis.location,oldDocument=globalThis.document;
  try{
    globalThis.document={querySelector:()=>null};
    globalThis.location={protocol:'file:',hostname:''};assert.equal(isIntegratedRuntime(),false);
    globalThis.location={protocol:'http:',hostname:'127.0.0.1'};assert.equal(isIntegratedRuntime(),true);
    globalThis.location={protocol:'https:',hostname:'painel.example'};assert.equal(isIntegratedRuntime(),false);
    globalThis.document={querySelector:()=>({content:'cloud'})};assert.equal(isIntegratedRuntime(),false);
    globalThis.location={protocol:'http:',hostname:'painel.example'};assert.equal(isIntegratedRuntime(),false);
  }finally{globalThis.location=oldLocation;globalThis.document=oldDocument;}
});
