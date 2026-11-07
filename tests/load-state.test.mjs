import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {backup, emptyState, mergeEvents, reconcileEventLinks, validateBackup} from '../core.js';
import {cnj} from './helpers.mjs';

function buildState(cases = 10000, events = 98000) {
  const state = emptyState();
  state.revision = 1;
  for (let i = 0; i < cases; i++) {
    state.cases.push({id: 'case' + i, title: 'Caso ' + i, cnj: cnj(i + 1),
      archived: false, stage: 'todo', review: '', notes: '', clientId: ''});
  }
  for (let i = 0; i < events; i++) {
    const index = i % cases;
    state.events.push({id: 'event:' + i, caseId: 'case' + index, source: 'djen',
      kind: 'publication', cnj: cnj(index + 1), date: '2026-11-06',
      text: 'Publicação sintética ' + i, discoveredAt: '2026-11-06T12:00:00Z',
      seen: false});
  }
  return state;
}

function timed(label, fn, limitMs) {
  const started = performance.now();
  const result = fn();
  const elapsed = performance.now() - started;
  assert.ok(elapsed < limitMs, `${label}: ${elapsed.toFixed(0)} ms excedeu ${limitMs} ms`);
  return result;
}

test('carteira com 10 mil processos e 100 mil eventos permanece operacional', () => {
  const state = timed('construção', () => buildState(), 30000);
  const batch = state.events.slice(0, 2000).map(event => ({...event, id: 'new:' + event.id,
    text: 'Movimento novo ' + event.id}));
  const added = timed('mergeEvents 2 mil eventos', () => mergeEvents(state, batch), 60000);
  assert.equal(added, 2000);
  const updated = timed('reconcileEventLinks', () => reconcileEventLinks(state), 30000);
  assert.equal(updated, 0);
  const payload = timed('backup', () => backup(state), 30000);
  const restored = timed('validateBackup', () => validateBackup(payload), 60000);
  assert.equal(restored.cases.length, 10000);
  assert.ok(restored.events.length >= 100000);
  console.log(JSON.stringify({cases: restored.cases.length, events: restored.events.length}));
});
