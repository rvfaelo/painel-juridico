import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMoneyInput} from '../form-inputs.js';
test('valores brasileiros e decimais preservam centavos sem inferir formatos ambiguos',()=>{
 for(const value of ['1.250,50','1250,50',' R$ 1.250,50 ','1250.50'])assert.equal(normalizeMoneyInput(value),'1250.50');
 for(const value of ['1.250','1,250','1.25,50','-10','10abc','1 250,50'])assert.throws(()=>normalizeMoneyInput(value));
 assert.equal(normalizeMoneyInput('0,01'),'0.01');
});
