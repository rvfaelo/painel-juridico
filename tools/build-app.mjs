// Gera app.bundle.js para abrir o painel direto de file://.
// Navegadores bloqueiam imports de módulos ES em arquivos locais; o bundle
// clássico mantém o código-fonte separado em módulos sem exigir servidor.
import {build} from 'esbuild';
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = new URL('../', import.meta.url);
const entry = fileURLToPath(new URL('app.js', root));
const outfile = fileURLToPath(new URL('app.bundle.js', root));
const packageJSON = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));

await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome110', 'edge110'],
  charset: 'utf8',
  legalComments: 'none',
  sourcemap: false,
  minify: false,
  banner: {
    js: `/* Painel H.B v${packageJSON.version} · bundle gerado por tools/build-app.mjs. Edite os módulos-fonte, não este arquivo. */`
  },
  logLevel: 'info'
});

const text = await readFile(outfile, 'utf8');
if (/\bimport\s*\(|\bfrom\s*["']\.\//.test(text)) {
  throw Error('O bundle ainda contém imports relativos; ele não funcionaria em file://.');
}
await writeFile(outfile, text);
