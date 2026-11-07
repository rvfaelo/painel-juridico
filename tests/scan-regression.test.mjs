import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseDatajud,parseDjen,SourceError} from '../sources.js';
import {emptyState,enqueue,mergeEvents} from '../core.js';
import {step} from '../runner.js';

// Golden master do scan de movimentações. Qualquer mudança no parser, na
// deduplicação ou no runner deve ser intencional e refletida neste arquivo.
const root = new URL('./fixtures/scan/', import.meta.url);
const load = async name => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const expected = await load('expected.json');
const cnj = '08129777920238190066';
const normEvent = e => ({
  id: e.id, source: e.source, kind: e.kind, cnj: e.cnj, caseId: e.caseId || '',
  date: e.date, text: e.text, tribunal: e.tribunal || '', url: e.url || '',
  certificateHash: e.certificateHash || '', publicationStatus: e.publicationStatus || '',
  seen: !!e.seen
});
test('parseDatajud mantém o golden master exato', async () => {
  const page1 = parseDatajud(await load('datajud-page-1.json'), cnj, 0);
  const page2 = parseDatajud(await load('datajud-page-2.json'), cnj, 0);
  assert.deepEqual({
    events: page1.events, count: page1.count, nextCursor: page1.nextCursor,
    notFound: page1.notFound, sourceUpdatedAt: page1.sourceUpdatedAt
  }, expected.datajudPage1);
  assert.deepEqual({
    events: page2.events, count: page2.count, nextCursor: page2.nextCursor,
    notFound: page2.notFound, sourceUpdatedAt: page2.sourceUpdatedAt
  }, expected.datajudPage2);
});

test('parseDjen mantém o golden master exato, inclusive duplicata e hash inválido', async () => {
  const page = parseDjen(await load('djen-page.json'), 1);
  assert.deepEqual({
    events: page.events, count: page.count, nextCursor: page.nextCursor, notFound: page.notFound
  }, expected.djenPage);
  assert.equal(page.events[0].id, page.events[1].id);
  assert.equal(page.events[2].certificateHash, '');
  assert.equal(page.events[2].url, '');
  assert.equal(page.events[2].publicationStatus, 'Cancelada');
});

test('mergeEvents deduplica e preserva o golden master', async () => {
  const page1 = parseDatajud(await load('datajud-page-1.json'), cnj, 0);
  const page2 = parseDatajud(await load('datajud-page-2.json'), cnj, 0);
  const djen = parseDjen(await load('djen-page.json'), 1);
  const state = emptyState();
  state.cases.push({id: 'case1', title: 'Caso', cnj, archived: false, stage: 'todo'});
  mergeEvents(state, page1.events);
  mergeEvents(state, page2.events);
  mergeEvents(state, djen.events);
  mergeEvents(state, djen.events);
  assert.deepEqual(state.events.map(normEvent), expected.mergedEvents);
});

test('step mantém o golden master da fila de scan', async () => {
  const djen = parseDjen(await load('djen-page.json'), 1);
  const state = emptyState();
  state.cases.push({id: 'case1', title: 'Caso', cnj, archived: false, stage: 'todo'});
  enqueue(state, ['case1'], ['djen']);
  const adapter = async () => ({...djen, periodStart: '2026-11-01', periodEnd: '2026-11-05'});
  await step({
    read: async () => structuredClone(state),
    mutate: async fn => fn(state),
    adapters: {djen: adapter},
    clock: () => 1700000000000
  });
  const job = state.jobs[0];
  assert.deepEqual({
    status: job.status, count: job.count, added: job.added, cursor: job.cursor,
    message: job.message, events: state.events.map(normEvent)
  }, expected.runner);
});

test('o pipeline rejeita página incompleta e CNJ divergente sem alterar o golden', async () => {
  const page = await load('datajud-page-1.json');
  assert.throws(() => parseDatajud({...page, hits: {...page.hits, total: {value: 150, relation: 'eq'}}}, cnj),
    error => error instanceof SourceError && /incompleta/.test(error.message));
  assert.throws(() => parseDatajud(page, '00000000000000000000'), /válidos/);
  const djen = await load('djen-page.json');
  assert.throws(() => parseDjen({...djen, count: 150}, 1), /incompleta/);
});
