import test from 'node:test';
import assert from 'node:assert/strict';
import {schedulePanel,scheduleRow} from '../schedule-panel.js';
import {serviceJobRowsHTML,selectServiceJobs} from '../service-job-history.js';
test('agendamento mantém controles nativos e separa consulta manual',()=>{
 const html=schedulePanel({autoUpdateEnabled:true,autoUpdateTimes:'08:00,18:00'});
 assert.equal((html.match(/name="autoTime"/g)||[]).length,2);
 assert.match(html,/Próxima consulta/);assert.match(html,/data-schedule-connection/);
 assert.match(html,/schedule-manual/);assert.match(html,/Salvar horários/);
 assert.match(scheduleRow('',1,false),/disabled/);
 assert.doesNotMatch(scheduleRow('" onfocus="test'),/value="" onfocus/);
});
test('cada status tem identidade de cor sem perder rótulo em texto',()=>{
 for(const status of ['queued','running','success','partial','not_found','auth_required','access_denied','unavailable','unsupported','incompatible','cancelled','error','action','interrupted']){
  const html=serviceJobRowsHTML([{status,source:'esaj_pg',message:'teste fictício'}]);
  assert.ok(html.includes('data-service-status="'+status+'"'));
 }
 assert.match(serviceJobRowsHTML([{status:'not_found',source:'djen'}]),/Não localizada/);
});

test('pesquisa reconhece o nome de status em português',()=>{assert.equal(selectServiceJobs([{status:'incompatible',source:'esaj_pg'}],{query:'resposta incompativel'}).total,1);});
