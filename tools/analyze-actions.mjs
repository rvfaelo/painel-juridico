// Extrai nomes de ações tratados e emitidos pelos templates.
// Uso: node tools/analyze-actions.mjs [--write tests/fixtures/action-names.json]
import {readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const skip = new Set(['app.bundle.js']);
const allSources = [];
for (const name of await readdir(root)) {
  if (name.endsWith('.js') && !skip.has(name)) allSources.push(name);
}
const actionSources = allSources.filter(name => name.startsWith('action-'));

const handled = new Set();
const prefixes = new Set();
const emitted = new Set();

const appText = await readFile(path.join(root, 'app.js'), 'utf8');
const actionStart = appText.indexOf('async function action(name,id,caseId=');
const actionEnd = appText.indexOf("document.addEventListener('click'", actionStart);
const actionBody = actionStart >= 0 && actionEnd > actionStart
  ? appText.slice(actionStart, actionEnd) : '';
for (const match of actionBody.matchAll(/\bname\s*===\s*['"]([^'"]+)['"]/g)) handled.add(match[1]);
for (const match of actionBody.matchAll(/\bname\s*==\s*['"]([^'"]+)['"]/g)) handled.add(match[1]);
for (const match of actionBody.matchAll(/\bname\.startsWith\(\s*['"]([^'"]+)['"]\s*\)/g)) prefixes.add(match[1]);

for (const relative of actionSources) {
  const text = await readFile(path.join(root, relative), 'utf8');
  for (const match of text.matchAll(/^\s*['"]?([A-Za-z0-9_-]+)['"]?\s*:\s*async\b/gm)) handled.add(match[1]);
  for (const match of text.matchAll(/\bname\.startsWith\(\s*['"]([^'"]+)['"]\s*\)/g)) prefixes.add(match[1]);
}

for (const relative of [...allSources, ...actionSources]) {
  const text = await readFile(path.join(root, relative), 'utf8');
  for (const match of text.matchAll(/data-action\s*=\s*["']([^"'$]+)["']/g)) emitted.add(match[1]);
  for (const match of text.matchAll(/\b(?:app\.)?button\(\s*['"]([^'"]+)['"]/g)) emitted.add(match[1]);
}

const result = {
  handled: [...handled].sort(),
  prefixes: [...prefixes].sort(),
  emitted: [...emitted].sort(),
};
const text = JSON.stringify(result, null, 2) + '\n';
const targetIndex = process.argv.indexOf('--write');
if (targetIndex >= 0 && process.argv[targetIndex + 1]) {
  await writeFile(path.join(root, process.argv[targetIndex + 1]), text, 'utf8');
}
process.stdout.write(text);
