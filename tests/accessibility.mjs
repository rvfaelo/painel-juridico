// Teste de acessibilidade com axe-core, sem serviço nem rede.
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {emptyState} from '../core.js';

const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const axePath = require.resolve('axe-core/axe.min.js');

const state = emptyState();
state.revision = 1;
state.clients.push({id: 'client1', name: 'Cliente Exemplo', phone: '21999990000',
  email: 'cliente@example.test', notes: 'Observação & <teste>'});
state.cases.push({
  id: 'case1', title: 'Caso Exemplo & <teste>', cnj: '08129777920238190066',
  clientId: 'client1', plaintiff: 'Autor Exemplo', defendant: 'Réu Exemplo',
  stage: 'doing', review: '2026-11-07', notes: 'Observação do caso',
  nextStep: 'Aguardar manifestação', workOwner: 'me', workStatus: 'doing',
  reviewedAt: '2026-11-06T12:00:00Z', court: 'tjrj', courtLevel: 'first',
  processSystem: 'pje', parentCaseId: '', docketNumber: '', originReference: '',
  pendingItems: [{id: 'pending1', title: 'Enviar comprovante', done: false,
    createdAt: '2026-11-06T12:00:00Z', completedAt: ''}],
  manualChecks: []
});
state.tasks.push({id: 'task1', caseId: 'case1', title: 'Tarefa Exemplo',
  stage: 'todo', due: '2026-11-07', notes: '', manualCheckId: ''});
state.appointments.push({id: 'appt1', caseId: 'case1', title: 'Audiência Exemplo',
  when: '2026-11-07T10:00', notes: ''});
state.fees.push({id: 'fee1', caseId: 'case1', title: 'Honorário Exemplo',
  amount: 100000, paid: 10000, due: '2026-11-10', notes: ''});
state.payments.push({id: 'pay1', feeId: 'fee1', kind: 'receipt', amount: 10000,
  date: '2026-11-06', notes: 'Parcela', createdAt: '2026-11-06T12:00:00Z'});
state.events.push({id: 'djen:event1', caseId: 'case1', source: 'djen',
  kind: 'publication', cnj: '08129777920238190066', date: '2026-11-06',
  text: 'Publicação fictícia para teste.', tribunal: 'TJRJ',
  discoveredAt: '2026-11-06T12:00:00Z', seen: false, is_new: 1,
  publicationDetails: {tribunal: 'TJRJ', orgao: '1ª Vara Cível'}});
state.jobs.push({id: 'job1', caseId: 'case1', cnj: '08129777920238190066',
  source: 'djen', status: 'success', createdAt: '2026-11-06T12:00:00Z',
  updatedAt: '2026-11-06T12:00:00Z', cursor: null, attempt: 0, added: 0,
  count: 1, message: 'Concluída', leaseUntil: 0, nextAt: 0,
  periodStart: '2026-11-01', periodEnd: '2026-11-06'});

const routes = {
  home: 'Visão geral', notifications: 'Notificações', agendados: 'Agendados',
  cases: 'Processos', clients: 'Clientes', tasks: 'Tarefas', agenda: 'Agenda',
  finance: 'Honorários', publications: 'Publicações', sources: 'Fontes e ajustes'
};
const dialogs = [
  ['#clients', 'edit-clients'], ['#cases', 'edit-cases'], ['#tasks', 'edit-tasks'],
  ['#agenda', 'edit-appointments'], ['#finance', 'edit-fees']
];

const browser = await chromium.launch({headless: true, channel: 'chromium'});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
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
await page.addScriptTag({path: axePath});

async function violations(label) {
  const result = await page.evaluate(async () => {
    const report = await axe.run(document, {
      runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']}
    });
    return report.violations.map(item => ({id: item.id, impact: item.impact,
      help: item.help, targets: item.nodes.map(node => node.target.join(' ')).slice(0, 5)}));
  });
  assert.deepEqual(result, [], `${label}: ${JSON.stringify(result, null, 2)}`);
}

try {
  for (const [route, title] of Object.entries(routes)) {
    await page.evaluate(route => { location.hash = '#' + route; }, route);
    await page.waitForFunction(title => document.querySelector('#page-title')?.textContent === title, title);
    await violations(route);
  }
  for (const [route, action] of dialogs) {
    await page.evaluate(route => { location.hash = route; }, route);
    await page.waitForFunction(() => document.querySelector('#page-title')?.textContent);
    await page.locator(`[data-action="${action}"]`).first().click();
    await page.locator('#entity-form').waitFor();
    await violations('dialog ' + action);
    await page.locator('#close-dialog').click();
    await page.locator('#editor').waitFor({state: 'hidden'});
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ok: true, routes: Object.keys(routes).length,
    dialogs: dialogs.length, violations: 0}));
} finally {
  await browser.close();
}
