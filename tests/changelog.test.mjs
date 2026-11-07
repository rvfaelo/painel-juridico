import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CHANGELOG} from '../changelog.js';
import {VERSION} from '../core.js';

test('changelog e versão atual estão sincronizados no pacote',async()=>{
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url),'utf8'));
  assert.equal(CHANGELOG[0].version,VERSION);
  const service=await readFile(new URL('../service/main.py',import.meta.url),'utf8');
  assert.ok(service.includes(`APP_VERSION = "${VERSION}"`));
  assert.equal(pkg.version,VERSION);
  assert.equal(lock.version,VERSION);
  assert.equal(lock.packages[''].version,VERSION);
});

test('versões únicas com resumos, histórico e datas sem rede',()=>{
  assert.ok(CHANGELOG.length>=3);
  assert.equal(new Set(CHANGELOG.map(r=>r.version)).size,CHANGELOG.length);
  assert.deepEqual(CHANGELOG.map(r=>r.version),['0.6.7','0.6.6','0.6.5','0.6.4','0.6.3','0.6.2','0.6.1','0.6.0','0.5.11','0.5.10','0.5.9','0.5.8','0.5.7','0.5.6','0.5.5','0.5.4','0.5.3','0.5.2','0.5.1','0.5.0','0.4.2','0.4.1','0.4.0','0.3.0','0.2.16','0.2.15','0.2.14','0.2.13','0.2.12','0.2.11','0.2.10','0.2.9','0.2.8','0.2.7','0.2.6','0.2.5','0.2.4','0.2.3','0.2.2','0.2.1','0.2.0','0.1.0']);
  for(const release of CHANGELOG){
    assert.match(release.version,/^\d+\.\d+\.\d+$/);
    assert.ok(release.title.length>=5);
    assert.ok(release.summary.length>=15);
    assert.ok(release.changes.length>=2);
    assert.ok(release.changes.every(c=>c.length>=15));
    if(release.date)assert.equal(new Date(release.date+'T12:00:00Z').toISOString().slice(0,10),release.date);
  }
});

test('changelog preserva acentos e não contém letras substituídas por interrogações',()=>{
  const text=CHANGELOG.flatMap(r=>[r.title,r.summary,...r.changes]).join('\n');
  assert.doesNotMatch(text,/\p{L}\?+\p{L}|\uFFFD/u);
  const migration=CHANGELOG.find(r=>r.version==='0.5.0');
  assert.match(migration.summary,/serviço/);
  assert.ok(migration.changes.some(s=>s.includes('cópia original')&&s.includes('migração')));
  assert.ok(migration.changes.some(s=>s.includes('edição')&&s.includes('exclusão')&&s.includes('validações')));
});
