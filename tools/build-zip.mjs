// Build a self-contained, offline zip inflater used only for local XLSX reads.
// fflate is MIT licensed; full license text is in THIRD-PARTY-LICENSES.md.
import {build} from 'esbuild';
await build({stdin:{contents:'export { unzipSync } from "fflate";',resolveDir:process.cwd(),sourcefile:'zip-import-entry.js'},bundle:true,platform:'browser',format:'esm',minify:true,legalComments:'inline',outfile:'zip-inflate.js'});
console.log('zip-inflate.js atualizado');
