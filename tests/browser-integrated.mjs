// Teste do modo localhost, sem requisicoes reais a tribunais.
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdtemp, mkdir, readFile, rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {cnj,fixtureCnj} from './helpers.mjs';
import {decryptBackup} from '../backup-crypto.js';

const {chromium} = createRequire(import.meta.url)('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const temp = await mkdtemp(path.join(tmpdir(), 'pauta-browser-integ-'));
const port = 18765;
const base = `http://127.0.0.1:${port}`;
const venvPython = path.join(root,'.venv','Scripts','python.exe');
const python = process.platform === 'win32' && existsSync(venvPython)
  ? venvPython : (process.env.PYTHON || 'python');
const child = spawn(python, ['-m', 'service.main'], {
  cwd:root, env:{...process.env, PAUTA_DATA_DIR:temp, PAUTA_PORT:String(port)},
  stdio:['ignore','pipe','pipe'], windowsHide:true
});
let stderr = '', stopped = false;
child.stderr.on('data', v => stderr += String(v));
const browser = await chromium.launch({headless:true,channel:'chromium'});
const context = await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
const page = await context.newPage();
const errors=[];
page.on('pageerror', error=>errors.push(error.message));
page.on('dialog', dialog=>dialog.accept());

async function available() {
  for (let i=0;i<80;i++) {
    if (child.exitCode !== null) throw Error('Serviço encerrou antes da abertura: '+stderr);
    try {
      const res = await fetch(base+'/api/v1/health',{signal:AbortSignal.timeout(400)});
      const info = await res.json();
      if (info.product !== 'pauta-local-service') throw Error('Porta ocupada por outro programa.');
      if(res.ok) return;
    } catch (error) {
      if (error.message.includes('Porta ocupada')) throw error;
    }
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  throw Error('Servico Python nao iniciou em tempo adequado: '+stderr);
}

async function shutdown() {
  if (stopped) return;
  stopped = true;
  try {
    const session = await (await fetch(base+'/api/v1/session')).json();
    await fetch(base+'/api/v1/shutdown',{method:'POST',
      headers:{'Content-Type':'application/json','X-Pauta-CSRF':session.csrf},body:'{}'});
  } catch {}
}

async function readBrowserState() {
  const session=await (await fetch(base+'/api/v1/session')).json();
  return (await (await fetch(base+'/api/v1/workspace',{headers:{'X-Pauta-CSRF':session.csrf}})).json()).state;
}

async function protectedGet(path) {
  const session=await (await fetch(base+'/api/v1/session')).json();
  return fetch(base+path,{headers:{'X-Pauta-CSRF':session.csrf}});
}

try {
  await available();
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.locator('#service-status').getByText('Serviço Python local conectado',{exact:false}).waitFor({timeout:15000});
  await page.waitForFunction(()=>document.querySelector('#page-title')?.textContent==='Visão geral');
  await page.locator('[data-action="changelog"]').click();
  const migrationRelease=page.locator('.release-entry').filter({has:page.locator('summary',{hasText:'v0.5.0'})});
  await migrationRelease.locator('summary').click();
  assert.match(await migrationRelease.innerText(),/serviço local/);
  assert.match(await migrationRelease.innerText(),/cópia original/);
  assert.match(await migrationRelease.innerText(),/migração/);
  assert.match(await migrationRelease.innerText(),/edição, arquivamento e exclusão/);
  assert.doesNotMatch(await migrationRelease.innerText(),/\p{L}\?+\p{L}|\uFFFD/u);
  await page.locator('#close-dialog').click();
  // Só a interface recebe mocks: o endpoint Python é validado separadamente em unittest.
  const previewCalls=[];
  await page.route('**/api/v1/datajud/preview',async route=>{
    const payload=route.request().postDataJSON();
    assert.deepEqual(Object.keys(payload),['cnj'],'A API recebe apenas o CNJ digitado.');
    const number=payload.cnj;
    previewCalls.push(number);
    const mocked=number===fixtureCnj?{
      contractVersion:1,status:'success',cnj:number,partial:false,
      message:'Metadados públicos recebidos. Confira antes de salvar.',
      records:[
        {id:'datajud:first',tribunal:'TJRJ',grau:'G1',sistema:'PJe',classe:'Procedimento comum',
         assuntos:['Direito Civil'],orgao:'1ª Vara Cível',dataAjuizamento:'2025-01-01',sourceUpdatedAt:'2026-11-05'},
        {id:'datajud:second',tribunal:'TJRJ',grau:'G2',sistema:'eproc',classe:'Apelação',
         assuntos:[],orgao:'2ª Câmara Cível',dataAjuizamento:'',sourceUpdatedAt:''}]
    }:number===cnj(3)?{error:'Fonte respondeu HTTP 429.'}: {
      contractVersion:1,status:'not_found',cnj:number,partial:false,records:[],
      message:'Nenhum registro localizado nesta resposta. Isso não comprova inexistência do processo.'
    };
    await route.fulfill({status:number===cnj(3)?429:200,contentType:'application/json',body:JSON.stringify(mocked)});
  });
  await page.locator('#new-record').click();
  await page.locator('#entity-form [name="title"]').fill('Caso simulado no localhost');
  await page.locator('#entity-form [name="cnj"]').fill(fixtureCnj);
  await page.locator('#entity-form [name="court"]').selectOption('tjrj');
  await page.locator('#entity-form [name="processSystem"]').selectOption('esaj');
  await page.locator('#entity-form [name="notes"]').fill('Observação pessoal preservada.');
  await page.locator('#entity-form .datajud-lookup summary').click();
  await page.locator('[data-action="datajud-search"]').click();
  await page.locator('#datajud-choice').waitFor();
  assert.equal((await readBrowserState()).cases.length,0,'Buscar a prévia não altera a carteira.');
  assert.equal(await page.locator('#entity-form [name="courtLevel"]').inputValue(),'');
  await page.locator('#datajud-choice').selectOption('1');
  assert.match(await page.locator('#datajud-preview').innerText(),/2ª Câmara Cível/);
  await page.locator('[data-action="datajud-apply"]').click();
  assert.equal(await page.locator('#entity-form [name="court"]').inputValue(),'tjrj');
  assert.equal(await page.locator('#entity-form [name="courtLevel"]').inputValue(),'second');
  assert.equal(await page.locator('#entity-form [name="processSystem"]').inputValue(),'esaj');
  assert.match(await page.locator('#datajud-fields').innerText(),/Apelação/);
  const applyButton=page.locator('[data-action="datajud-apply"]');
  const applyStatus=page.locator('#datajud-apply-status');
  assert.match(await applyStatus.innerText(),/Dados aplicados ao formulário\. Ainda não foram salvos/);
  assert.match(await applyStatus.innerText(),/Campos preenchidos: Grau/);
  assert.match(await applyStatus.innerText(),/Não disponíveis: Assuntos/);
  assert.equal(await applyButton.isDisabled(),true);
  assert.match(await applyButton.innerText(),/Dados aplicados/);
  assert.equal(await applyButton.evaluate(el=>getComputedStyle(el).cursor),'default');
  // Trocar de registro libera uma nova aplicação; voltar ao mesmo detecta ausência de novidades.
  await page.locator('#datajud-choice').selectOption('0');
  assert.equal(await applyButton.isEnabled(),true);
  assert.equal(await applyStatus.isVisible(),false);
  await page.locator('#datajud-choice').selectOption('1');
  await applyButton.click();
  assert.match(await applyStatus.innerText(),/Nenhum campo foi alterado nesta aplicação/);
  assert.match(await applyButton.innerText(),/Nenhum dado novo para aplicar/);
  assert.equal(await applyButton.isDisabled(),true);
  // Se o usuário esvaziar um campo, pode aplicar novamente sem consultar a rede.
  await page.locator('#entity-form [name="courtLevel"]').selectOption('');
  assert.equal(await applyButton.isEnabled(),true);
  await applyButton.click();
  assert.equal(await page.locator('#entity-form [name="courtLevel"]').inputValue(),'second');
  assert.match(await applyStatus.innerText(),/Campos preenchidos: Grau/);
  assert.equal((await readBrowserState()).cases.length,0,'Aplicar ainda não salva o processo.');
  await page.locator('#entity-form button[type="submit"]').click();
  await page.locator('a[href="#cases"]').first().click();
  await page.locator('.cases-list tbody tr').first().waitFor();
  const local = await readBrowserState();
  assert.equal(local.cases.length,1);
  assert.equal(local.cases[0].notes,'Observação pessoal preservada.');
  assert.equal(local.cases[0].courtLevel,'second');
  assert.equal(local.cases[0].processSystem,'esaj');
  assert.equal(local.cases[0].datajudDetails.classe,'Apelação');
  assert.equal(local.cases[0].datajudDetails.orgao,'2ª Câmara Cível');
  assert.equal(local.cases[0].datajudDetails.cnj,fixtureCnj);
  assert.deepEqual(previewCalls,[fixtureCnj]);
  // Alteração pelo serviço, sem controlar a interface, aparece na aba aberta.
  const session=(await (await fetch(base+'/api/v1/session')).json());
  async function backgroundEdit(fields){
    const current=await readBrowserState();
    const response=await fetch(base+'/api/v1/cases/command',{method:'POST',
      headers:{'Content-Type':'application/json','X-Pauta-CSRF':session.csrf},
      body:JSON.stringify({expectedRevision:current.revision,
        command:{action:'edit',id:local.cases[0].id,fields}})});
    assert.equal(response.status,200);return response.json();
  }
  await backgroundEdit({title:'Alterado em segundo plano'});
  await page.getByText('Alterado em segundo plano',{exact:true}).first().waitFor({timeout:15000});
  await page.locator('.cases-list .cell-title').first().click();
  await page.locator('#dialog-body [data-action="edit-cases"]').click();
  await page.locator('#entity-form [name="title"]').fill('Formulário antigo');
  await backgroundEdit({notes:'Edição concorrente preservada'});
  await page.locator('#entity-form button[type="submit"]').click();
  await page.getByText('A carteira foi alterada em segundo plano. Feche e reabra este formulário para conferir os dados atuais.',{exact:true}).waitFor();
  assert.equal((await readBrowserState()).cases[0].notes,'Edição concorrente preservada');
  await page.locator('#close-dialog').click();
  await page.locator('#editor').waitFor({state:'hidden'});
  await backgroundEdit({title:local.cases[0].title,notes:local.cases[0].notes});
  await page.getByText(local.cases[0].title,{exact:true}).first().waitFor({timeout:15000});
  await page.locator('.cases-list .cell-title').first().click();
  const upload=page.waitForEvent('filechooser');
  await page.locator('[data-action="attach"]').click();
  await (await upload).setFiles({name:'anexo-ficticio.txt',mimeType:'text/plain',buffer:Buffer.from('Anexo de teste preservado.')});
  await page.getByText('anexo-ficticio.txt',{exact:true}).waitFor();
  const documentDownload=page.waitForEvent('download');
  await page.locator('[data-action="download-document"]').click();
  assert.equal(await readFile(await (await documentDownload).path(),'utf8'),'Anexo de teste preservado.');
  assert.equal((await readBrowserState()).documents.length,1);
  assert.match(await page.locator('#dialog-body').innerText(),/METADADOS PÚBLICOS · DATAJUD/i);
  await page.locator('#dialog-body [data-action="edit-cases"]').click();
  await page.locator('#entity-form .datajud-lookup summary').click();
  assert.match(await page.locator('#datajud-fields').innerText(),/Apelação/);
  await page.locator('#entity-form [name="cnj"]').fill(cnj(2));
  assert.doesNotMatch(await page.locator('#datajud-fields').innerText(),/Apelação/,
    'A ficha não exibe metadados de um CNJ antigo após editar o número.');
  await page.locator('[data-action="datajud-search"]').click();
  await page.waitForFunction(()=>document.querySelector('#datajud-status')?.textContent.includes('não comprova inexistência'));
  assert.match(await page.locator('#datajud-status').innerText(),/não comprova inexistência/);
  assert.equal(await page.locator('#entity-form [name="processSystem"]').inputValue(),'esaj');
  await page.locator('#entity-form [name="cnj"]').fill(cnj(3));
  await page.locator('[data-action="datajud-search"]').click();
  await page.waitForFunction(()=>document.querySelector('#datajud-status')?.textContent.includes('HTTP 429'));
  assert.match(await page.locator('#datajud-status').innerText(),/HTTP 429/);
  assert.equal(await page.locator('#entity-form [name="courtLevel"]').inputValue(),'second');
  await page.locator('#entity-form [name="cnj"]').fill('1234');
  await page.locator('[data-action="datajud-search"]').click();
  await page.waitForFunction(()=>document.querySelector('#datajud-status')?.textContent.includes('20 dígitos'));
  assert.match(await page.locator('#datajud-status').innerText(),/20 dígitos/);
  await page.locator('#entity-form [name="cnj"]').fill(fixtureCnj);
  assert.match(await page.locator('#datajud-fields').innerText(),/Apelação/,
    'Voltar ao CNJ original restaura os metadados já salvos.');
  await page.locator('[data-action="close"]').first().click();
  assert.equal((await readBrowserState()).cases[0].cnj,fixtureCnj,
    'Cancelar a edição preserva a carteira original.');
  let registered;
  for (let n=0;n<40;n++) {
    const resp=await protectedGet('/api/v1/processes/'+encodeURIComponent(local.cases[0].id));
    if(resp.ok){registered=await resp.json();break;}
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  assert.equal(registered?.case?.cnj,fixtureCnj);
  assert.equal(registered.events.length,0);
  // UI de acompanhamento: resposta reproduzida isoladamente no navegador,
  // sem escrever eventos de teste no SQLite ou chamar tribunais.
  const sampleEvents=[
    {id:'g1-mov',source:'datajud',tramitation_id:'datajud:g1',kind:'movement',
      occurred_at:'2026-11-03T13:20:00Z',text:'Conclusão ao relator',is_new:1,seen:0,
      first_seen:'2026-11-05T15:00:00Z',last_seen:'2026-11-05T16:00:00Z',
      source_updated_at:'2026-11-05T12:00:00Z',correction_count:0},
    {id:'g2-mov',source:'datajud',tramitation_id:'datajud:g2',kind:'movement',
      occurred_at:'2026-11-03T13:20:00Z',text:'Conclusão ao relator',is_new:0,seen:1,
      first_seen:'2026-11-05T15:01:00Z',last_seen:'2026-11-05T16:00:00Z',
      source_updated_at:'2026-11-05T12:00:00Z',correction_count:0},
    {id:'djen-pub',source:'djen',tramitation_id:'djen:1',kind:'publication',
      occurred_at:'2026-11-02',text:'Publicação no Diário',is_new:0,seen:0,
      first_seen:'2026-11-05T15:02:00Z',last_seen:'2026-11-05T16:00:00Z',
      source_updated_at:'',correction_count:0}
  ];
  const sampleTracks=[
    {id:'datajud:g1',source:'datajud',tribunal:'TJRJ',grau:'G1',sistema:{nome:'PJe',codigo:1},
      orgao:{nome:'1ª Vara Cível',codigo:1},ultimaAtualizacaoFonte:'2026-11-05T12:00:00Z'},
    {id:'datajud:g2',source:'datajud',tribunal:'TJRJ',grau:'G2',sistema:'eproc',
      orgao:{nome:'2ª Câmara Cível'},ultimaAtualizacaoFonte:'2026-11-05T12:00:00Z'}
  ];
  const mockDetail={case:registered.case,events:sampleEvents,tramitations:sampleTracks,
    lastAttempt:{attempted_at:'2026-11-05T19:00:00Z'},
    lastSuccess:{attempted_at:'2026-11-05T19:00:00Z'}};
  await page.route('**/api/v1/processes/**',async route=>{
    if(!route.request().url().endsWith('/'+encodeURIComponent(local.cases[0].id)))return route.continue();
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(mockDetail)});
  });
  const recordedSeen=[];
  await page.route('**/api/v1/events/seen',async route=>{
    const payload=route.request().postDataJSON();
    recordedSeen.push(payload);
    const event=sampleEvents.find(item=>item.id===payload.eventId&&item.source===payload.source);
    if(event){event.is_new=0;event.seen=1;}
    await route.fulfill({status:200,contentType:'application/json',body:'{"count":1}'});
  });
  await page.locator('.cases-list .cell-title').first().click();
  await page.locator('.integrated-event').first().waitFor();
  assert.match(await page.locator('#integrated-case-detail .integrated-count').innerText(),
    /2 movimentos · 1 publicação no histórico\s*·\s*1 por conferir/);
  assert.equal(await page.locator('#integrated-case-detail .integrated-event-pending').count(),1);
  assert.equal(await page.locator('#integrated-case-detail .integrated-event').count(),3);
  assert.match(await page.locator('.integrated-event').first().innerText(),/03\/11\/2026 às 10:20/);
  assert.doesNotMatch(await page.locator('.integrated-event').first().innerText(),/Primeira identificação|Última identificação|Atualização informada pela fonte/);
  assert.equal(await page.locator('.integrated-possible-duplicate').count(),2);
  assert.match(await page.locator('[aria-label="Tramitações do 1º grau"]').innerText(),/PJe.*1ª Vara Cível/s);
  assert.match(await page.locator('[aria-label="Tramitações do 2º grau"]').innerText(),/eproc.*2ª Câmara Cível/s);
  assert.doesNotMatch(await page.locator('#integrated-case-detail').innerText(),/\[object Object\]/);
  assert.equal(await page.locator('.integrated-technical').evaluate(el=>el.open),false);
  await page.locator('.integrated-technical summary').click();
  assert.equal(await page.locator('.integrated-technical').evaluate(el=>el.open),true);
  assert.match(await page.locator('.integrated-technical').innerText(),/Última consulta tentada/);
  await page.locator('.integrated-technical summary').click();
  await page.locator('.integrated-event-pending summary').click();
  await page.locator('[data-integrated="seen"]').click();
  await page.locator('#integrated-case-detail .integrated-count').getByText('0 por conferir').waitFor();
  assert.deepEqual(recordedSeen,[{caseId:local.cases[0].id,source:'datajud',eventId:'g1-mov'}]);
  assert.equal(await page.locator('#integrated-case-detail .integrated-event').count(),3,
    'Conferir não exclui nenhum movimento ou publicação.');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.locator('#integrated-case-detail').evaluate(el=>el.scrollWidth<=el.clientWidth+2),true,
    'Acompanhamento não deve transbordar horizontalmente no celular.');
  await page.locator('#close-dialog').click();
  // Histórico volumoso só no mock do navegador: o SQLite do serviço fica intacto.
  sampleEvents.push(...Array.from({length:155},(_,i)=>({...sampleEvents[1],
    id:'simulated-history-'+i,tramitation_id:i%2?'datajud:g1':'datajud:g2',
    occurred_at:'2026-05-14T13:11:00',text:i===154?'Movimento da última página':'Documento',
    is_new:0,seen:1})));
  await page.setViewportSize({width:1440,height:900});
  await page.locator('.cases-list .cell-title').first().click();
  await page.locator('#integrated-case-detail .case-history-pagination').first().waitFor();
  assert.equal(await page.locator('#integrated-case-detail .integrated-event').count(),13,
    'Doze movimentos DataJud por página, além da publicação DJEN independente.');
  assert.equal(await page.locator('#integrated-case-detail .integrated-event-disclosure[open]').count(),0);
  assert.match(await page.locator('#integrated-case-detail').innerText(),/157 movimentos · 1 publicação/);
  const dialogStyle=await page.locator('#editor').evaluate(el=>{
    const style=getComputedStyle(el),bounds=el.getBoundingClientRect();
    return {border:style.borderTopWidth,outline:style.outlineStyle,width:bounds.width,height:bounds.height,
      scrollable:el.querySelector('#dialog-body').scrollHeight>el.querySelector('#dialog-body').clientHeight,
      overflow:el.scrollWidth>el.clientWidth+2};
  });
  assert.equal(dialogStyle.border,'1px');
  assert.equal(dialogStyle.outline,'none');
  assert.equal(dialogStyle.overflow,false);
  assert.equal(dialogStyle.scrollable,true);
  assert.ok(dialogStyle.height<=868);
  const rowHeight=await page.locator('[data-event-id="simulated-history-0"]').evaluate(el=>el.getBoundingClientRect().height);
  assert.ok(rowHeight<=75,'Linha compacta na vista desktop (não cartão gigante): '+rowHeight);
  await page.locator('#integrated-case-detail .integrated-event-list').first().scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(root,'docs','ui-test','case-history-compact-desktop.png')});
  await page.locator('[data-integrated="events-page"][data-key="datajud-history"][data-page="2"]').click();
  assert.equal(await page.locator('[data-event-id="simulated-history-0"]').count(),0);
  assert.equal(await page.locator('[data-event-id="simulated-history-10"]').count(),1);
  await page.locator('[data-event-id="simulated-history-10"] summary').click();
  assert.match(await page.locator('[data-event-id="simulated-history-10"] .integrated-event-extra').innerText(),/Documento/);
  await page.setViewportSize({width:375,height:812});
  assert.equal(await page.locator('#editor').evaluate(el=>el.scrollWidth<=el.clientWidth+2),true);
  assert.equal(await page.locator('#integrated-case-detail').evaluate(el=>el.scrollWidth<=el.clientWidth+2),true);
  await page.locator('#integrated-case-detail .integrated-event').first().scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(root,'docs','ui-test','case-history-compact-mobile.png')});
  await page.locator('#close-dialog').click();
  await page.setViewportSize({width:1280,height:900});
  assert.equal((await readBrowserState()).cases.length,1);
  assert.equal((await (await protectedGet('/api/v1/processes/'+encodeURIComponent(local.cases[0].id))).json()).events.length,0,
    'Os eventos simulados nunca foram gravados no serviço SQLite.');
  await page.route('**/api/v1/publications',async route=>{
    const first={
      id:'djen:integrado-teste',source:'djen',kind:'publication',cnj:fixtureCnj,occurred_at:'2026-11-05',
      text:'Publicação integrada fictícia.',first_seen:'2026-11-05T13:00:00Z',
      case_id:local.cases[0].id,seen:1,is_new:0,url:'https://www.cnj.jus.br/',
      certificate_hash:'qo8LEjMv6g2sAodc5TGKzLJRmrz2A1'
    };
    const more=Array.from({length:25},(_,i)=>({...first,id:`djen:extra-${i}`,text:`Teor adicional fictício ${i} `.repeat(35)}));
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({events:[first,...more]})});
  });
  await page.route('**/api/v1/publications/*/certidao',async route=>{
    assert.match(route.request().url(),/djen%3Aintegrado-teste\/certidao$/);
    await route.fulfill({status:200,contentType:'application/pdf',body:Buffer.from('%PDF-1.7\nCertidão fictícia.')});
  });
  await page.locator('a[href="#publications"]').first().click();
  await page.locator('[data-action="refresh-publications"]').click();
  await page.locator('#publication-list .publication-actions').first().waitFor();
  assert.match(await page.locator('#publication-list').innerText(),/05\/11\/2026/);
  assert.equal(await page.locator('#publication-list .record').count(),26,
    'A lista unificada mantém todas as publicações do lote atual.');
  assert.equal(await page.locator('#publication-list details[open]').count(),0);
  assert.equal(await page.locator('#publication-list .publication-actions a[href="https://www.cnj.jus.br/"]').count(),26);
  assert.match(await page.locator('#publication-list .publication-actions a').first().getAttribute('href'),/comunicaapi\.pje\.jus\.br\/api\/v1\/comunicacao\/.*\/certidao/);
  const officialDownload=page.waitForEvent('download');
  await page.locator('[data-action="unified-publication-official-pdf"]').first().click();
  const certificate=await officialDownload;
  assert.match(certificate.suggestedFilename(),/^CNJ-certidao-publicacao-.*\.pdf$/);
  assert.equal((await readFile(await certificate.path())).subarray(0,8).toString(),'%PDF-1.7');
  const publicationDownload=page.waitForEvent('download');
  await page.locator('[data-action="unified-publication-pdf"]').first().click();
  const publicationPdf=await publicationDownload;
  assert.equal((await readFile(await publicationPdf.path())).subarray(0,8).toString(),'%PDF-1.4');
  assert.equal((await (await protectedGet('/api/v1/processes/'+encodeURIComponent(local.cases[0].id))).json()).events.length,0,
    'Exportação de publicação fictícia não persiste evento no serviço.');
  await page.locator('a[href="#sources"]').first().click();
  await page.locator('#integrated-source-panel').waitFor();
  assert.match(await page.locator('#integrated-source-panel').innerText(),/Monitoramento pelo serviço Python/);
  assert.match(await page.locator('#integrated-source-panel').innerText(),/Jus.br\/PDPJ/);
  assert.equal(await page.locator('#source-technical-info details').evaluate(el=>el.open),false);
  await page.locator('#source-technical-info summary').click();
  assert.match(await page.locator('#source-technical-info').innerText(),/CPF\/CNPJ/);
  assert.match(await page.locator('#source-technical-info').innerText(),/TRTs e TREs/);
  assert.match(await page.locator('[data-action="source-diagnostics"]').innerText(),/conexão real/);
  const dashboard=await (await protectedGet('/api/v1/dashboard')).json();
  const abundant=Array.from({length:80},(_,i)=>({id:`consult-${i}`,source:i%2?'datajud':'djen',
    status:['unavailable','running','success','cancelled'][i%4],cnj:cnj(i+1),
    case_id:i%3===0?local.cases[0].id:'',message:`Falha de referência ${i} (simulada)`,
    created_at:'2026-11-05T13:00:00Z',updated_at:'2026-11-05T14:00:00Z',
    source_updated_at:'2026-11-05T12:00:00Z'}));
  await page.route('**/api/v1/dashboard',async route=>{
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...dashboard,jobs:abundant})});
  });
  await page.reload();
  await page.locator('a[href="#sources"]').first().click();
  await page.locator('[data-settings-views] button').filter({hasText:'Diagnóstico'}).click();
  await page.locator('#integrated-service-jobs .service-job-row').first().waitFor();
  assert.equal(await page.locator('#integrated-service-jobs .service-job-row').count(),6);
  assert.match(await page.locator('#service-jobs-progress').innerText(),/1 a 6 de 80/);
  const firstJob=await page.locator('.service-job-reference').first().innerText();
  await page.locator('[data-integrated="jobs-next"]').click();
  assert.equal(await page.locator('#integrated-service-jobs .service-job-row').count(),6);
  assert.notEqual(await page.locator('.service-job-reference').first().innerText(),firstJob);
  assert.match(await page.locator('#service-jobs-page').innerText(),/2 de 14/);
  await page.locator('[data-integrated="jobs-filter"][data-value="attention"]').click();
  assert.match(await page.locator('#service-jobs-progress').innerText(),/1 a 6 de 20/);
  assert.equal(await page.locator('.service-job-alert').count(),6);
  await page.locator('#service-jobs-search').fill('REFERENCIA 20');
  assert.equal(await page.locator('.service-job-row').count(),1);
  assert.match(await page.locator('.service-job-reference').first().innerText(),new RegExp(cnj(21)));
  await page.waitForTimeout(4100);
  assert.equal(await page.locator('#service-jobs-search').inputValue(),'REFERENCIA 20');
  assert.equal(await page.locator('.service-job-row').count(),1);
  await page.locator('#service-jobs-search').focus();
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'service-jobs-search');
  await page.locator('#service-jobs-search').fill('');
  await page.locator('[data-integrated="jobs-filter"][data-value="all"]').click();
  const shots=path.join(root,'docs','ui-test');
  await mkdir(shots,{recursive:true});
  await page.setViewportSize({width:1440,height:900});
  await page.locator('#integrated-service-jobs').evaluate(el=>el.scrollIntoView({block:'start'}));
  await page.screenshot({path:path.join(shots,'integrated-jobs-desktop.png'),fullPage:false});
  for(const width of [375,390,768,1024,1440]){
    await page.setViewportSize({width,height:900});
    assert.equal(await page.locator('#integrated-service-jobs').evaluate(el=>el.scrollWidth<=el.clientWidth+3),true,
      `Histórico deve caber na tela de ${width}px.`);
    if(width===375){
      await page.locator('#integrated-service-jobs').evaluate(el=>el.scrollIntoView({block:'start'}));
      await page.screenshot({path:path.join(shots,'integrated-jobs-mobile-375.png'),fullPage:false});
    }
  }
  await page.setViewportSize({width:1280,height:900});
  await page.unroute('**/api/v1/dashboard');
  await page.locator('#backup').click();
  await page.locator('#backup-form [name="password"]').fill('senha-de-teste-local');
  await page.locator('#backup-form [name="confirmation"]').fill('senha-de-teste-local');
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#backup-form button[type="submit"]').click();
  const download=await downloadPromise;
  const bundle=await decryptBackup(JSON.parse(await readFile(await download.path(),'utf8')),
    'senha-de-teste-local');
  assert.equal(bundle.state.cases.length,1);
  assert.equal(bundle.state.documents.length,1);
  assert.equal(Buffer.from(bundle.attachments[0].data,'base64').toString(),'Anexo de teste preservado.');
  assert.equal(bundle.monitoring.format,'pauta-monitoramento');
  assert.equal(bundle.monitoring.version,3);
  assert.equal(bundle.monitoring.tables.cases.length,1);
  assert.equal(bundle.monitoring.tables.events.length,0);
  // Regressão de UX: versão 2 do monitoramento deve chegar à prévia de
  // restauração; nunca confirmar a substituição neste teste.
  if(await page.locator('#editor').evaluate(element=>element.open))await page.locator('#close-dialog').click();
  await page.locator('[data-settings-views] button').filter({hasText:'Dados'}).click();
  const fileChoice=page.waitForEvent('filechooser');
  await page.locator('[data-action="restore"]').first().click();
  const chooser=await fileChoice;
  await chooser.setFiles({name:'backup-sintetico.json',mimeType:'application/json',buffer:await readFile(await download.path())});
  await page.locator('#decrypt-form [name="password"]').fill('senha-de-teste-local');
  await page.locator('#decrypt-form button[type="submit"]').click();
  await page.getByText('Conferir restauração',{exact:true}).first().waitFor();
  assert.match(await page.locator('#dialog-body').innerText(),/Monitoramento integrado:/);
  // Restauração real só neste banco temporário, incluindo bytes do anexo.
  await page.locator('#restore-form [name="confirmed"]').check();
  await page.locator('#restore-form button[type="submit"]').click();
  await page.waitForFunction(()=>!document.querySelector('#editor').open);
  assert.equal((await readBrowserState()).documents.length,1);
  assert.deepEqual(errors,[]);

  await shutdown();
  await page.waitForFunction(()=>document.getElementById('service-status')?.textContent.includes('desconectado'),
    {timeout:15000});
  await assert.rejects(readBrowserState(),'Sem o serviço não há gravação/leitura de uma cópia concorrente.');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,origin:base,cases:1,backupIncludesMonitoring:true,
    backgroundEditVisible:true,staleFormBlocked:true,offlineApiUnavailable:true,pageErrors:errors.length},null,2));
} finally {
  await shutdown();
  await context.close();
  await browser.close();
  child.kill();
  await rm(temp,{recursive:true,force:true,maxRetries:6,retryDelay:200}).catch(()=>{});
}
