import {readFile, writeFile} from 'node:fs/promises';
import {parseDatajud,parseDjen} from '../sources.js';
import {emptyState,enqueue,mergeEvents} from '../core.js';
import {step} from '../runner.js';

const root = new URL('../tests/fixtures/scan/', import.meta.url);
const load = async name => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const cnj = '08129777920238190066';
const normEvent = e => ({id:e.id,source:e.source,kind:e.kind,cnj:e.cnj,caseId:e.caseId||'',date:e.date,text:e.text,tribunal:e.tribunal||'',url:e.url||'',certificateHash:e.certificateHash||'',publicationStatus:e.publicationStatus||'',seen:!!e.seen});

const datajudPage1 = parseDatajud(await load('datajud-page-1.json'), cnj, 0);
const datajudPage2 = parseDatajud(await load('datajud-page-2.json'), cnj, 0);
const djenPage = parseDjen(await load('djen-page.json'), 1);

const state = emptyState();
state.cases.push({id:'case1',title:'Caso',cnj,archived:false,stage:'todo'});
mergeEvents(state, datajudPage1.events);
mergeEvents(state, datajudPage2.events);
mergeEvents(state, djenPage.events);
mergeEvents(state, djenPage.events);

let runnerState = emptyState();
runnerState.cases.push({id:'case1',title:'Caso',cnj,archived:false,stage:'todo'});
enqueue(runnerState, ['case1'], ['djen']);
const adapter = async () => ({...djenPage, periodStart:'2026-11-01', periodEnd:'2026-11-05'});
const read = async () => structuredClone(runnerState);
const mutate = async fn => fn(runnerState);
await step({read,mutate,adapters:{djen:adapter},clock:()=>1700000000000});
const job = runnerState.jobs[0];

const expected = {
  datajudPage1: {events:datajudPage1.events,tramitations:datajudPage1.tramitations,count:datajudPage1.count,nextCursor:datajudPage1.nextCursor,notFound:datajudPage1.notFound,sourceUpdatedAt:datajudPage1.sourceUpdatedAt},
  datajudPage2: {events:datajudPage2.events,tramitations:datajudPage2.tramitations,count:datajudPage2.count,nextCursor:datajudPage2.nextCursor,notFound:datajudPage2.notFound,sourceUpdatedAt:datajudPage2.sourceUpdatedAt},
  djenPage: {events:djenPage.events,count:djenPage.count,nextCursor:djenPage.nextCursor,notFound:djenPage.notFound},
  mergedEvents: state.events.map(normEvent),
  runner: {
    status: job.status,
    count: job.count,
    added: job.added,
    cursor: job.cursor,
    message: job.message,
    events: runnerState.events.map(normEvent)
  }
};
await writeFile(new URL('expected.json', root), JSON.stringify(expected, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({events:expected.mergedEvents.length,runner:expected.runner.status}));
