import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ps=path.join(root,'central-painel-hb.ps1');
const cmd=path.join(root,'CENTRAL-PAINEL-HB.cmd');

test('central do Painel H.B preserva script unico de entrada e exige clique para comandos',()=>{
  const contents=readFileSync(cmd,'utf8');
  const ui=readFileSync(ps,'utf8');
  assert.match(contents,/central-painel-hb\.ps1/i);
  assert.match(contents,/-NoProfile -ExecutionPolicy Bypass -STA/i);
  assert.match(ui,/function Open-Command/);
  assert.match(ui,/127\.0\.0\.1:8766\/api\/v1\/health/);
  assert.match(ui,/Instalar dependências offline/);
  assert.doesNotMatch(ui,/Invoke-Expression|iex\s|DownloadString/);
});

test('central valida 11 destinos sem iniciar serviços ou acionar consultas',()=>{
  if(process.platform!=='win32')return;
  const p=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-STA','-File',ps,'-SelfTest'],{
    cwd:root,timeout:20000,encoding:'utf8'
  });
  assert.equal(p.status,0,p.stderr||p.stdout);
  const result=JSON.parse(p.stdout.trim());
  assert.equal(result.ok,true);
  assert.equal(result.actions,11);
});

test('aba de atualizações possui cinco ações sem executar rede ou instalação no autoteste',()=>{
  if(process.platform!=='win32')return;
  const p=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-STA','-File',ps,'-UpdateSelfTest'],{cwd:root,timeout:30000,encoding:'utf8'});
  assert.equal(p.status,0,p.stderr||p.stdout);
  const result=JSON.parse(p.stdout.trim());
  assert.equal(result.actionsTested,5);assert.equal(result.noNetwork,true);assert.equal(result.noInstall,true);
});

test('botões das três abas encaminham ações sem iniciá-las no autoteste',()=>{
  if(process.platform!=='win32')return;
  const p=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-STA','-File',ps,'-TestInteractions'],{
    cwd:root,timeout:30000,encoding:'utf8'
  });
  assert.equal(p.status,0,p.stderr||p.stdout);
  const result=JSON.parse(p.stdout.trim());
  assert.equal(result.ok,true);
  assert.equal(result.actionsTested,11);
  assert.equal(result.dryRun,true);
});
