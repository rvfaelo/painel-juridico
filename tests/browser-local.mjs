import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {fixtureCnj} from './helpers.mjs';
import {decryptBackup} from '../backup-crypto.js';
import {VERSION} from '../core.js';

const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, 'docs', 'ui-test');
await mkdir(out, {recursive: true});

const browser = await chromium.launch({headless: true, channel: 'chromium'});
const context = await browser.newContext({viewport: {width: 1440, height: 1000}, acceptDownloads: true});
const page = await context.newPage();
const errors = [];
const tempFiles = [];
page.on('pageerror', error => errors.push(error.message));

await page.addInitScript(() => {
  window.__sourceCalls = [];
  window.fetch = async (url, options = {}) => {
    window.__sourceCalls.push({url: String(url), method: options.method || 'GET'});
    if (String(url).includes('/certidao')) {
      return new Response(new TextEncoder().encode('%PDF-1.7\nCertidão fictícia para teste.'),
        {headers:{'Content-Type':'application/pdf'}});
    }
    if (String(url).includes('datajud')) {
      const number = JSON.parse(options.body).query.match.numeroProcesso;
      return new Response(JSON.stringify({hits: {total: {value: 1, relation: 'eq'}, hits: [{_id: 'fixture', _source: {numeroProcesso: number, tribunal: 'TJRJ', grau: 'G1', movimentos: [{codigo: 1, nome: 'Juntada fictícia', dataHora: '2026-11-04T09:00:00Z'}]}}]}}), {headers: {'Content-Type': 'application/json'}});
    }
    const parsed = new URL(String(url));
    const number = parsed.searchParams.get('numeroProcesso');
    return new Response(JSON.stringify(number
      ? {count: 1, items: [{id: 'fixture-publication', numero_processo: number, data_disponibilizacao: '2026-11-04', texto: '<p>Publicação fictícia para teste local.</p>', siglaTribunal: 'TJRJ', ativo: true}]}
      : {count: 0, items: []}), {headers: {'Content-Type': 'application/json'}});
  };
});

const readState = () => page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open('pauta-local', 2);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result;
    const tx = db.transaction('workspace', 'readonly');
    const get = tx.objectStore('workspace').get('state');
    get.onerror = () => reject(get.error);
    get.onsuccess = () => { db.close(); resolve(get.result); };
  };
}));

const setSettings = patch => page.evaluate(patch => new Promise((resolve, reject) => {
  const request = indexedDB.open('pauta-local', 2);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result;
    const tx = db.transaction('workspace', 'readwrite');
    const store = tx.objectStore('workspace');
    const get = store.get('state');
    get.onsuccess = () => {
      const state = get.result;
      Object.assign(state.settings, patch);
      store.put(state, 'state');
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  };
}), patch);

// Simula uma consulta deixada como "running" por uma aba fechada.
const insertOrphanJob = ({caseId, cnj}) => page.evaluate(({caseId, cnj}) => new Promise((resolve, reject) => {
  const request = indexedDB.open('pauta-local', 2);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result;
    const tx = db.transaction('workspace', 'readwrite');
    const store = tx.objectStore('workspace');
    const get = store.get('state');
    get.onsuccess = () => {
      const state = get.result;
      const stamp = new Date().toISOString();
      state.jobs.push({id: 'orphan-running', runId: 'orphan-run', caseId, cnj, source: 'djen', status: 'running', leaseUntil: Date.now() + 1500, createdAt: stamp, updatedAt: stamp, cursor: null, attempt: 0, added: 0, count: 0, message: 'Em execução na aba anterior', nextAt: 0});
      store.put(state, 'state');
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  };
}), {caseId, cnj});

const waitState = async predicate => {
  for (let i = 0; i < 80; i++) {
    const state = await readState().catch(() => null);
    if (state && predicate(state)) return state;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw Error('Estado esperado não foi alcançado em 20 segundos.');
};

try {
  await page.goto(pathToFileURL(path.join(root, 'dashboard.html')).href);
  await page.waitForFunction(()=>document.querySelector('#page-title')?.textContent==='Visão geral');
  assert.equal(await page.evaluate(() => globalThis.__PAUTA_BOOTED__), true);
  assert.equal((await readState()).cases.length, 0);
  assert.equal((await readState()).jobs.length, 0);
  assert.equal(await page.locator('#release-version').innerText(), 'v'+VERSION);

  // Desativa o agendador antes da primeira verificação automática (5 s).
  await setSettings({autoUpdateEnabled: false});
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#page-title')?.textContent==='Visão geral');

  await page.locator('#new-record').click();
  await page.locator('#entity-form [name="title"]').fill('Caso local fictício');
  await page.locator('#entity-form [name="cnj"]').fill(fixtureCnj);
  await page.locator('#entity-form button[type="submit"]').click();
  await waitState(state => state.cases.length === 1);
  assert.equal((await readState()).cases[0].cnj, fixtureCnj);

  // Nova área Agendados + ficha com acompanhamento próprio, sem calcular prazos.
  await page.locator('a[href="#agendados"]').first().click();
  await page.locator('.agendados-row').first().waitFor();
  assert.match(await page.locator('.agendados-group-heading').first().innerText(),/Sem revisão marcada/);
  await page.locator('.agendados-row [data-action="detail"]').first().click();
  await page.locator('#workflow-form [name="nextStep"]').fill('Aguardar comprovante das custas');
  await page.locator('#workflow-form [name="workOwner"]').selectOption('client');
  await page.locator('#workflow-form [name="workStatus"]').selectOption('doing');
  await page.locator('#workflow-form [name="review"]').fill('2026-11-10');
  await page.locator('#workflow-form button[type="submit"]').click();
  await waitState(s=>s.cases[0].nextStep==='Aguardar comprovante das custas'&&s.cases[0].workOwner==='client');
  await page.locator('#workflow-pending-form [name="title"]').fill('Enviar comprovante de pagamento');
  await page.locator('#workflow-pending-form button[type="submit"]').click();
  await waitState(s=>s.cases[0].pendingItems?.length===1);
  await page.locator('[data-workflow-pending]').check();
  await waitState(s=>s.cases[0].pendingItems[0].done===true);
  await page.locator('[data-workflow-pending]').uncheck();
  await waitState(s=>s.cases[0].pendingItems[0].done===false);
  await page.locator('#case-workflow [data-action="workflow-viewed"]').click();
  await waitState(s=>!!s.cases[0].reviewedAt);
  assert.equal(await page.locator('#workflow-form [name="workOwner"]').inputValue(),'client');
  await page.locator('#close-dialog').click();
  await page.locator('[data-action="scheduled-owner"][data-id="client"]').click();
  assert.equal(await page.locator('.agendados-row').count(),1);
  await page.locator('[data-action="scheduled-owner"][data-id="court"]').click();
  assert.equal(await page.locator('.agendados-row').count(),0);
  await page.locator('[data-action="scheduled-owner"][data-id="all"]').click();
  assert.equal(await page.locator('.agendados-row').count(),1);
  assert.match(await page.locator('.agendados-row').innerText(),/Aguardar comprovante das custas/);
  await page.locator('a[href="#cases"]').first().click();
  await page.locator('.cases-list [data-action="edit-cases"]').first().click();
  await page.locator('#entity-form [name="title"]').fill('Caso local fictício editado');
  await page.locator('#entity-form button[type="submit"]').click();
  await waitState(s=>s.cases[0].title==='Caso local fictício editado');
  assert.equal((await readState()).cases[0].pendingItems.length,1,'Editar dados não apaga pendências.');

  await page.locator('#update-all').click();
  await page.getByText('Consultas indisponíveis no HTML direto', {exact:false}).waitFor({timeout:6000});
  const done = await readState();
  assert.equal(done.jobs.length, 0, 'Sem serviço Python, file:// não consulta fontes.');
  assert.equal(done.events.length, 0);
  assert.equal(await page.evaluate(() => window.__sourceCalls.length), 0);

  // Exporta um backup protegido pelo fluxo real da interface e confere a
  // criptografia no Node antes de restaurar o mesmo arquivo no navegador.
  const password = 'senha-local-de-teste';
  await page.locator('#backup').click();
  await page.locator('#backup-form').waitFor();
  await page.locator('#backup-form [name="password"]').fill(password);
  await page.locator('#backup-form [name="confirmation"]').fill(password);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#backup-form button[type="submit"]').click();
  const download = await downloadPromise;
  const payload = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(payload.format, 'pauta-encrypted-backup');
  const decoded = await decryptBackup(payload, password);
  assert.equal(decoded.state.cases.length, 1);
  assert.equal(decoded.state.cases[0].workOwner,'client');
  assert.equal(decoded.state.cases[0].pendingItems[0].title,'Enviar comprovante de pagamento');
  assert.ok(decoded.state.cases[0].reviewedAt);
  assert.equal(decoded.state.events.length, 0);

  const restoredFile = path.join(tmpdir(), `pauta-restore-${Date.now()}.json`);
  tempFiles.push(restoredFile);
  await writeFile(restoredFile, JSON.stringify(decoded), 'utf8');
  await page.locator('a[href="#sources"]').first().click();
  await page.locator('[data-settings-views] button').filter({hasText:'Dados'}).click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('[data-action="restore"]').click();
  await (await chooserPromise).setFiles(restoredFile);
  await page.locator('#dialog-title').filter({hasText: 'Conferir restauração'}).waitFor();
  await page.locator('#restore-form [name="confirmed"]').check();
  await page.locator('#restore-form button[type="submit"]').click();
  const restored = await waitState(state => state.cases.length === 1 && state.events.length === 0);
  assert.equal(restored.cases[0].cnj, fixtureCnj);

  await page.locator('[data-settings-views] button').filter({hasText:'Automação'}).click();
  await page.locator('#auto-form').waitFor();
  const autoEnabled = page.locator('#auto-form [name="autoUpdateEnabled"]');
  if (!await autoEnabled.isChecked()) await autoEnabled.check();
  const timeInputs = page.locator('#auto-form [name="autoTime"]');
  await timeInputs.nth(0).fill('07:30');
  await timeInputs.nth(1).fill('19:30');
  await page.locator('#auto-form button[type="submit"]').click();
  const configured = await waitState(state => state.settings.autoUpdateTimes === '07:30,19:30' && state.settings.autoUpdateEnabled === true);
  assert.equal(configured.settings.autoUpdateTimes, '07:30,19:30');
  assert.equal(await timeInputs.nth(0).inputValue(), '07:30');
  assert.equal(await timeInputs.nth(1).inputValue(), '19:30');
  assert.match(await page.locator('#auto-form').innerText(), /Próxima consulta/);

  // O HTML direto nao retoma consultas deixadas por versoes antigas.
  // Somente o servico Python e responsavel por executar uma fila.
  await insertOrphanJob({caseId: restored.cases[0].id, cnj: fixtureCnj});
  await page.reload();
  await page.locator('[data-settings-views] button').filter({hasText:'Automação'}).click();
  await page.locator('#auto-form').waitFor();
  const recovered = await readState();
  assert.equal(recovered.jobs.find(job => job.id === 'orphan-running').status, 'running');
  assert.equal(await page.evaluate(() => window.__sourceCalls.length), 0);

  // A carteira apresenta somente lista, com ações em lote após selecionar.
  await page.locator('a[href="#cases"]').first().click();
  await page.locator('.cases-list tbody tr').first().waitFor();
  assert.equal(await page.locator('[data-action="view-board"]').count(),0);
  assert.equal(await page.locator('.board').count(),0);
  await page.locator('.cases-list input[data-select]').check();
  await page.locator('[data-action="archive-selected"]').click();
  await waitState(s=>s.cases[0]?.archived===true);
  await page.locator('[data-action="filter-archived"]').click();
  await page.locator('.cases-list input[data-select]').check();
  await page.locator('[data-action="unarchive-selected"]').click();
  await waitState(s=>s.cases[0]?.archived===false);
  await page.locator('[data-action="filter-active"]').click();

  // Uma publicação fictícia permite conferir link e download sem consultar DJEN.
  await page.evaluate(number=>new Promise((resolve,reject)=>{
    const r=indexedDB.open('pauta-local',2);
    r.onerror=()=>reject(r.error);
    r.onsuccess=()=>{const db=r.result,tx=db.transaction('workspace','readwrite'),store=tx.objectStore('workspace'),get=store.get('state');
      get.onsuccess=()=>{const s=get.result;s.events.push({id:'djen:pdf-test',source:'djen',kind:'publication',cnj:number,caseId:s.cases[0].id,date:'2026-11-05',text:'Publicação de intimação fictícia.',tribunal:'TJRJ',url:'https://www.cnj.jus.br/',certificateHash:'qo8LEjMv6g2sAodc5TGKzLJRmrz2A1',seen:false,discoveredAt:'2026-11-05T12:00:00Z'});s.revision++;store.put(s,'state');};
      tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);
    };
  }),fixtureCnj);
  await page.reload();
  await page.locator('a[href="#notifications"]').click();
  await page.locator('.notification-record').waitFor();
  assert.equal(await page.locator('[data-notification-count]').innerText(),'1');
  await page.setViewportSize({width:1440,height:900});
  await page.screenshot({path:path.join(out,'notifications-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(out,'notifications-mobile.png')});
  await page.locator('[data-notification-action="seen"]').click();
  await page.locator('[data-notification-status="seen"]').click();
  await page.locator('[data-notification-action="seen"]').waitFor();
  assert.equal((await readState()).events[0].seen,true);
  await page.locator('[data-notification-action="seen"]').click();
  await page.locator('[data-notification-status="unseen"]').click();
  assert.equal((await readState()).events[0].seen,false);
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('a[href="#publications"]').first().click();
  await page.locator('.publication-actions').first().waitFor();
  assert.match(await page.locator('#content .record').first().innerText(),/05\/11\/2026/);
  assert.equal(await page.locator('.publication-actions a[href="https://www.cnj.jus.br/"]').count(),1);
  assert.match(await page.locator('.publication-actions a').first().getAttribute('href'),/comunicaapi\.pje\.jus\.br\/api\/v1\/comunicacao\/.*\/certidao/);
  const officialDownload=page.waitForEvent('download');
  await page.locator('[data-action="unified-publication-official-pdf"]').click();
  const certidao=await officialDownload;
  assert.match(certidao.suggestedFilename(),/^CNJ-certidao-publicacao-.*\.pdf$/);
  assert.equal((await readFile(await certidao.path())).subarray(0,8).toString(),'%PDF-1.7');
  const pdfDownload=page.waitForEvent('download');
  await page.locator('[data-action="unified-publication-pdf"]').first().click();
  const pdf=await pdfDownload;
  assert.match(pdf.suggestedFilename(),/^Painel-HB-publicacao-.*\.pdf$/);
  assert.equal((await readFile(await pdf.path())).subarray(0,8).toString(),'%PDF-1.4');

  // A exclusão requer confirmação; tarefas e consultas mantêm conteúdo e
  // tornam-se desvinculadas, sem afetar qualquer carteira real.
  await page.locator('a[href="#cases"]').first().click();
  await page.locator('.cases-list input[data-select]').check();
  await page.locator('[data-action="delete-selected"]').click();
  assert.equal((await readState()).cases.length,1);
  await page.locator('[data-action="confirm-delete-selected"]').click();
  const withoutCase=await waitState(s=>s.cases.length===0);
  assert.equal(withoutCase.events.length,1);
  assert.equal(withoutCase.events[0].caseId,'');
  assert.equal(withoutCase.jobs.find(j=>j.id==='orphan-running').status,'cancelled');
  // Carteira sintética extensa: Agendados limita a listagem a 15 por página.
  await page.evaluate(()=>new Promise((resolve,reject)=>{
    const request=indexedDB.open('pauta-local',2);
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result,tx=db.transaction('workspace','readwrite'),store=tx.objectStore('workspace'),get=store.get('state');
      get.onsuccess=()=>{
        const state=get.result;
        state.cases=Array.from({length:21},(_,i)=>({id:'synthetic-schedule-'+i,title:'Revisão fictícia '+String(i+1),cnj:'',clientId:'',area:'Civil',stage:'todo',notes:'',review:'2026-11-12',nextStep:'Solicitar documento fictício',workOwner:'me',workStatus:'todo',pendingItems:[],archived:false}));
        state.revision++;store.put(state,'state');
      };
      tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);
    };
  }));
  await page.reload();
  await page.locator('a[href="#agendados"]').first().click();
  await page.locator('.agendados-row').first().waitFor();
  assert.equal(await page.locator('.agendados-row').count(),15);
  assert.match(await page.locator('.agendados-footer').innerText(),/1 de 2/);
  await page.locator('[data-action="scheduled-next"]').click();
  assert.equal(await page.locator('.agendados-row').count(),6);
  assert.match(await page.locator('.agendados-footer').innerText(),/2 de 2/);
  await page.locator('[data-action="scheduled-prev"]').click();
  assert.equal(await page.locator('.agendados-row').count(),15);
  await page.setViewportSize({width:1440,height:900});
  await page.screenshot({path:path.join(out,'agendados-desktop.png'),fullPage:false});
  await page.setViewportSize({width:375,height:900});
  assert.equal(await page.locator('.agendados-row').first().evaluate(el=>el.scrollWidth<=el.clientWidth+3),true);
  await page.screenshot({path:path.join(out,'agendados-mobile-375.png'),fullPage:false});
  await page.setViewportSize({width:1440,height:900});
  await page.locator('a[href="#sources"]').first().click();

  // Checkup transversal: rotas reais, navegação pelo teclado e breakpoints
  // representativos; a única origem usada é este perfil descartável.
  const routeTitles={home:'Visão geral',notifications:'Notificações',agendados:'Agendados',cases:'Processos',clients:'Clientes',tasks:'Tarefas',
    agenda:'Agenda',finance:'Honorários',publications:'Publicações',sources:'Fontes e ajustes'};
  for(const width of [375,620,768,900,1024,1440]){
    await page.setViewportSize({width,height:900});
    for(const [path,title] of Object.entries(routeTitles)){
      await page.evaluate(path=>{location.hash='#'+path;},path);
      await page.waitForFunction(title=>document.querySelector('#page-title')?.textContent===title,title);
      const bounds=await page.evaluate(()=>{
        const content=document.querySelector('#content'),main=document.querySelector('main');
        return {content:content.scrollWidth-content.clientWidth,mainRight:main.getBoundingClientRect().right,viewport:innerWidth};
      });
      assert.ok(bounds.content<=3,`${path}: conteúdo transborda ${bounds.content}px em ${width}px`);
      assert.ok(bounds.mainRight<=bounds.viewport+3,`${path}: painel ultrapassa a largura em ${width}px`);
    }
  }
  await page.locator('#skip-to-content').focus();
  const beforeSkip=await page.evaluate(()=>location.hash);
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'content',
    'Atalho de teclado deve focar o conteúdo principal.');
  assert.equal(await page.evaluate(()=>location.hash),beforeSkip,
    'Atalho não deve alterar a rota da aplicação.');
  await page.setViewportSize({width:375,height:900});
  await page.screenshot({path:path.join(out,'audit-mobile-375.png'),fullPage:false});
  await page.setViewportSize({width:1440,height:900});
  await page.screenshot({path:path.join(out,'audit-desktop-1440.png'),fullPage:false});

  // A ficha local mostra 12 linhas por página sem truncar o 13º registro.
  // Inserção exclusivamente na IndexedDB descartável deste teste Playwright.
  await page.evaluate(()=>new Promise((resolve,reject)=>{
    const req=indexedDB.open('pauta-local',2);
    req.onerror=()=>reject(req.error);
    req.onsuccess=()=>{
      const db=req.result,tx=db.transaction('workspace','readwrite');
      const store=tx.objectStore('workspace'),get=store.get('state');
      get.onsuccess=()=>{
        const s=get.result,caseId=s.cases[0].id;
        s.events.push(...Array.from({length:31},(_,i)=>({
          id:'synthetic-local-history-'+i,source:'datajud',kind:'movement',
          caseId,cnj:'',date:'2026-05-14',text:i===30?'Último movimento fictício':'Documento',
          tribunal:'TJRJ',seen:true,discoveredAt:'2026-11-05T12:00:00Z'
        })));
        s.revision++;store.put(s,'state');
      };
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>reject(tx.error);
    };
  }));
  await page.reload();
  await page.locator('a[href="#cases"]').first().click();
  await page.locator('.cases-list [data-action="detail"][data-id="synthetic-schedule-0"]').first().click();
  assert.equal(await page.locator('#local-case-history .case-history-event').count(),12);
  assert.match(await page.locator('#local-case-history').innerText(),/31 registro\(s\)/i);
  await page.locator('#local-case-history [data-case-page="2"]').click();
  assert.equal(await page.locator('#local-case-history .case-history-event').count(),12);
  await page.locator('#local-case-history [data-case-page="3"]').click();
  assert.equal(await page.locator('#local-case-history .case-history-event').count(),7);
  await page.locator('#local-case-history .case-history-event').last().locator('summary').click();
  assert.match(await page.locator('#local-case-history .case-history-extra').last().innerText(),/Último movimento fictício/);
  await page.setViewportSize({width:375,height:812});
  assert.equal(await page.locator('#editor').evaluate(el=>el.scrollWidth<=el.clientWidth+2),true);
  await page.screenshot({path:path.join(out,'case-history-local-mobile.png')});
  await page.locator('#close-dialog').click();

  // Fluxo real do Excel/CSV com a ordem do escritório, somente no perfil descartável.
  // Retira os movimentos artificiais sem CNJ usados no ensaio visual anterior;
  // eles não são historico válido para uma importação com checagem de integridade.
  await page.evaluate(()=>new Promise((resolve,reject)=>{
    const request=indexedDB.open('pauta-local',2);
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result,tx=db.transaction('workspace','readwrite');
      const store=tx.objectStore('workspace'),get=store.get('state');
      get.onsuccess=()=>{
        const current=get.result;
        current.events=current.events.filter(e=>!e.id.startsWith('synthetic-local-history-'));
        current.revision++;store.put(current,'state');
      };
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>reject(tx.error);
    };
  }));
  await page.reload();
  await page.locator('a[href="#cases"]').first().click();
  await page.setViewportSize({width:1440,height:900});
  await page.locator('[data-action="import-spreadsheet"]').click();
  await page.locator('#sheet-file-form [name="file"]').setInputFiles({
    name:'carteira-sete-colunas-ficticia.csv',mimeType:'text/csv',
    buffer:Buffer.from('Tribunal;Processo;Autor;Reu;Ação;Audiencia;Hora\n'+
      'TJRJ;'+fixtureCnj+';Parte autora de teste;Parte ré de teste;Ação fictícia;18/11/2026;14:30','utf8')
  });
  await page.locator('#sheet-file-form button[type="submit"]').click();
  await page.locator('#sheet-mapping-form').waitFor();
  for(const [field,index] of Object.entries({court:0,cnj:1,plaintiff:2,defendant:3,title:4,hearingDate:5,hearingTime:6})){
    assert.equal(await page.locator('#sheet-mapping-form [name="map-'+field+'"]').inputValue(),String(index));
  }
  assert.equal(await page.locator('#sheet-mapping-form [name="map-client"]').inputValue(),'-1');
  await page.locator('#sheet-mapping-form button[type="submit"]').click();
  await page.locator('#sheet-confirm-form').waitFor();
  assert.match(await page.locator('#dialog-body').innerText(),/1 audiência\(s\)/);
  assert.match(await page.locator('#dialog-body').innerText(),/1 processo\(s\) novo\(s\)/);
  await page.locator('#sheet-confirm-form [name="confirmed"]').check();
  await page.locator('#sheet-confirm-form button[type="submit"]').click();
  const withImported=await waitState(s=>s.cases.some(c=>c.cnj===fixtureCnj));
  const imported=withImported.cases.find(c=>c.cnj===fixtureCnj);
  assert.equal(imported.plaintiff,'Parte autora de teste');
  assert.equal(imported.defendant,'Parte ré de teste');
  assert.equal(imported.clientId,'');
  assert.equal(withImported.appointments.find(a=>a.caseId===imported.id)?.when,'2026-11-18T14:30');
  assert.equal(await page.evaluate(()=>window.__sourceCalls.length),0,'Importação não consulta tribunal.');
  await page.locator('.cases-list [data-action="detail"][data-id="'+imported.id+'"]').first().click();
  assert.match(await page.locator('#dialog-body').innerText(),/Autor: Parte autora de teste/);
  assert.match(await page.locator('#dialog-body').innerText(),/Réu: Parte ré de teste/);
  await page.locator('#close-dialog').click();

  assert.deepEqual(errors, []);
  await page.screenshot({path: path.join(out, 'local-01-fontes.png'), fullPage: true});
  console.log(JSON.stringify({
    ok: true,
    origin: 'file://',
    cases: done.cases.length,
    jobs: done.jobs.map(job => ({source: job.source, status: job.status})),
    events: done.events.length,
    autoUpdateTimes: configured.settings.autoUpdateTimes,
    pageErrors: errors.length
  }, null, 2));
} finally {
  await Promise.all(tempFiles.map(file => rm(file, {force: true}).catch(() => {})));
  await context.close();
  await browser.close();
}
