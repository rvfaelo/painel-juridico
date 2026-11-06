import test from 'node:test';
import assert from 'node:assert/strict';
import {autoConfig,autoScheduleInfo,parseAutoTimes} from '../engine.js';
import {emptyState,migrateState} from '../core.js';

test('horários automáticos são validados, deduplicados e ordenados',()=>{
  assert.deepEqual(parseAutoTimes('18:00, 08:00,18:00'),['08:00','18:00']);
  assert.throws(()=>parseAutoTimes(''),/ao menos um horário/);
  assert.throws(()=>parseAutoTimes('25:00'),/Horário inválido/);
  assert.deepEqual(parseAutoTimes('8:00 ; 18:00, ,'),['08:00','18:00']);
  assert.throws(()=>parseAutoTimes('08:00,09:00,10:00,11:00,12:00,13:00,14:00'),/no máximo 6/);
});

test('configuração padrão ativa duas consultas diárias',()=>{
  assert.deepEqual(autoConfig({}),{enabled:true,times:['08:00','18:00'],last:''});
  assert.equal(autoConfig({autoUpdateEnabled:false}).enabled,false);
});

test('agenda calcula a janela vencida e a próxima no fuso de São Paulo',()=>{
  const settings={autoUpdateTimes:'08:00,18:00'};
  const morning=autoScheduleInfo(settings,new Date('2026-11-05T11:30:00Z'));
  assert.equal(morning.due,'2026-11-05T08:00');
  assert.equal(morning.next,'2026-11-05T18:00');
  assert.equal(morning.dueReached,true);

  const afternoon=autoScheduleInfo({...settings,autoUpdateLast:'2026-11-05T08:00'},new Date('2026-11-05T20:00:00Z'));
  assert.equal(afternoon.due,'2026-11-05T08:00');
  assert.equal(afternoon.dueReached,false);
  assert.equal(afternoon.next,'2026-11-05T18:00');

  const night=autoScheduleInfo({...settings,autoUpdateLast:'2026-11-05T18:00'},new Date('2026-11-05T22:00:00Z'));
  assert.equal(night.due,'2026-11-05T18:00');
  assert.equal(night.next,'2026-11-06T08:00');
});

test('antes do primeiro horário, a última janela é a de ontem',()=>{
  const info=autoScheduleInfo({autoUpdateTimes:'08:00,18:00'},new Date('2026-11-05T09:00:00Z'));
  assert.equal(info.due,'2026-11-04T18:00');
  assert.equal(info.next,'2026-11-05T08:00');
});

test('horário inválido salvo cai no padrão sem derrubar a página',()=>{
  assert.deepEqual(autoConfig({autoUpdateTimes:'99:99'}).times,['08:00','18:00']);
});

test('última execução corrompida não vira data inválida na tela',()=>{
  assert.equal(autoConfig({autoUpdateLast:'ontem'}).last,'');
  assert.equal(autoConfig({autoUpdateLast:'2026-11-05T08:00'}).last,'2026-11-05T08:00');
});

test('estado local antigo recebe os padrões de atualização automática',()=>{
  const old=emptyState();
  delete old.settings.autoUpdateEnabled;
  delete old.settings.autoUpdateTimes;
  delete old.settings.autoUpdateLast;
  const next=migrateState(old);
  assert.equal(next.settings.autoUpdateEnabled,true);
  assert.equal(next.settings.autoUpdateTimes,'08:00,18:00');
  assert.equal(next.settings.autoUpdateLast,'');
});
