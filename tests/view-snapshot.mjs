import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const root = path.resolve(args.root || path.join(import.meta.dirname, '..'));
const out = path.resolve(args.out || path.join(root, 'tests', 'fixtures', 'view-snapshots'));
const require = createRequire(path.join(root, 'package.json'));
const {chromium} = require('playwright');

const routes = {
  home: 'Visão geral',
  notifications: 'Notificações',
  agendados: 'Agendados',
  cases: 'Processos',
  clients: 'Clientes',
  tasks: 'Tarefas',
  agenda: 'Agenda',
  finance: 'Honorários',
  publications: 'Publicações',
  sources: 'Fontes e ajustes'
};

const state = {
  schemaVersion: 2,
  revision: 1,
  clients: [
    {id: 'client1', name: 'Cliente <A> & "B" \'C\'', phone: '21999990000', email: 'cliente@example.test', notes: 'Notas <cliente> & "aspas" \'simples\''},
    {id: 'client2', name: 'Outro Cliente', phone: '', email: '', notes: ''}
  ],
  cases: [
    {id: 'case1', title: 'Caso <um> & "dois" \'três\'', cnj: '08129777920238190066', clientId: 'client1', plaintiff: 'Autor <A> & "B"', defendant: 'Réu <C> & \'D\'', stage: 'doing', review: '2026-11-06', notes: 'Observação <especial> & "texto" \'literal\'', nextStep: 'Aguardar <manifestação> & "documento"', workOwner: 'me', workStatus: 'doing', reviewedAt: '2026-11-05T12:00:00Z', court: 'tjrj', courtLevel: 'first', processSystem: 'pje', parentCaseId: '', docketNumber: '', originReference: '', pendingItems: [{id: 'pending1', title: 'Pendência <P> & "Q"', done: false, createdAt: '2026-11-05T12:00:00Z', completedAt: ''}]},
    {id: 'case2', title: 'Caso dois & <teste>', cnj: '00000000000000000000', clientId: 'client2', plaintiff: 'Parte <X>', defendant: 'Parte & Y', stage: 'todo', review: '', notes: '', nextStep: '', workOwner: 'court', workStatus: 'todo', court: 'trf2', courtLevel: 'second', processSystem: 'eproc', parentCaseId: '', docketNumber: '', originReference: ''},
    {id: 'case3', title: 'Caso três "aspas"', cnj: '', clientId: '', plaintiff: '', defendant: '', stage: 'ready', review: '2026-11-20', notes: '', nextStep: '', workOwner: 'client', workStatus: 'ready', court: '', courtLevel: '', processSystem: '', parentCaseId: '', docketNumber: 'REG-3', originReference: ''}
  ],
  tasks: [
    {id: 'task1', caseId: 'case1', title: 'Tarefa <T> & "U" \'V\'', stage: 'todo', due: '2026-11-06', notes: 'Notas <tarefa>'},
    {id: 'task2', caseId: 'case2', title: 'Tarefa concluída', stage: 'done', due: '', notes: ''}
  ],
  appointments: [
    {id: 'appt1', caseId: 'case1', title: 'Audiência <A> & "B"', when: '2026-11-06T10:30', kind: 'Audiência', notes: 'Sala <1>'},
    {id: 'appt2', caseId: 'case2', title: 'Reunião & "cliente"', when: '2026-11-07T14:00', kind: 'Reunião', notes: ''}
  ],
  fees: [
    {id: 'fee1', caseId: 'case1', title: 'Honorário <H> & "I"', amount: 150000, paid: 50000, due: '2026-11-10', notes: 'Contrato <antigo>'},
    {id: 'fee2', caseId: 'case2', title: 'Honorário dois', amount: 80000, paid: 0, due: '', notes: ''}
  ],
  payments: [
    {id: 'pay1', feeId: 'fee1', kind: 'receipt', amount: 50000, date: '2026-11-05', notes: 'Parcela <1>', createdAt: '2026-11-05T12:00:00Z'}
  ],
  documents: [],
  events: [
    {id: 'djen:event1', caseId: 'case1', source: 'djen', kind: 'publication', cnj: '08129777920238190066', date: '2026-11-05', text: 'Publicação <P> & "Q" \'R\'', tribunal: 'TJRJ', discoveredAt: '2026-11-05T12:00:00Z', seen: false},
    {id: 'djen:event2', caseId: 'case2', source: 'djen', kind: 'publication', cnj: '00000000000000000000', date: '2026-11-04', text: 'Outra publicação & <teste>', tribunal: 'TRF2', discoveredAt: '2026-11-04T12:00:00Z', seen: true}
  ],
  jobs: [
    {id: 'job1', caseId: 'case1', cnj: '08129777920238190066', source: 'djen', status: 'success', createdAt: '2026-11-05T12:00:00Z', updatedAt: '2026-11-05T12:00:00Z', cursor: null, attempt: 0, added: 0, count: 1, message: 'Consulta <ok>', leaseUntil: 0, nextAt: 0, periodStart: '2026-11-01', periodEnd: '2026-11-05'}
  ],
  coverageSamples: [],
  settings: {datajudKey: '', datajud: false, djen: true, djenDays: 30, oab: '', ufOab: '', autoUpdateEnabled: true, autoUpdateTimes: '08:00,18:00', autoUpdateLast: '', privacy: false}
};

const browser = await chromium.launch({headless: true, channel: 'chromium'});
const context = await browser.newContext({viewport: {width: 1440, height: 1000}});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('dialog', dialog => dialog.accept());
await page.goto(pathToFileURL(path.join(root, 'dashboard.html')).href);
await page.waitForFunction(() => globalThis.__PAUTA_BOOTED__ === true);
await page.evaluate(value => new Promise((resolve, reject) => {
  const request = indexedDB.open('pauta-local', 2);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result;
    const tx = db.transaction('workspace', 'readwrite');
    tx.objectStore('workspace').put(value, 'state');
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  };
}), state);
await page.reload();
await page.waitForFunction(() => document.querySelector('#page-title')?.textContent);

await mkdir(out, {recursive: true});
for (const [route, title] of Object.entries(routes)) {
  await page.evaluate(route => { location.hash = '#' + route; }, route);
  await page.waitForFunction(title => document.querySelector('#page-title')?.textContent === title, title);
  await page.waitForTimeout(50);
  await writeFile(path.join(out, 'content-' + route + '.html'),
    await page.locator('#content').evaluate(element => element.innerHTML), 'utf8');
}

const editRoutes = {
  clients: ['#clients', 'edit-clients'],
  cases: ['#cases', 'edit-cases'],
  tasks: ['#tasks', 'edit-tasks'],
  agenda: ['#agenda', 'edit-appointments'],
  finance: ['#finance', 'edit-fees']
};
for (const [name, [route, action]] of Object.entries(editRoutes)) {
  await page.evaluate(route => { location.hash = route; }, route);
  await page.waitForFunction(() => document.querySelector('#page-title')?.textContent);
  await page.waitForTimeout(50);
  await page.locator('[data-action="' + action + '"]').first().click();
  await page.locator('#entity-form').waitFor();
  await writeFile(path.join(out, 'dialog-' + name + '.html'),
    await page.locator('#dialog-body').evaluate(element => element.innerHTML), 'utf8');
  await page.locator('#close-dialog').click();
  await page.locator('#editor').waitFor({state: 'hidden'});
}

await page.evaluate(() => { location.hash = '#cases'; });
await page.waitForFunction(() => document.querySelector('#page-title')?.textContent === 'Processos');
await page.locator('.cases-list .cell-title').first().click();
await page.locator('#editor').waitFor({state: 'visible'});
await writeFile(path.join(out, 'dialog-case-detail.html'),
  await page.locator('#dialog-body').evaluate(element => element.innerHTML), 'utf8');

await browser.close();
if (errors.length) throw Error(errors.join('\n'));
console.log(JSON.stringify({root, out, files: Object.keys(routes).length + Object.keys(editRoutes).length}));
