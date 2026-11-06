import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,saveEntity,formatCnj} from '../core.js';
import {parseDelimited,suggestMapping,planSpreadsheetImport,commitSpreadsheetImport} from '../spreadsheet-import.js';
import {exportPortfolioCsv,portfolioTemplateCsv,exportImportReportCsv,PORTFOLIO_HEADERS} from '../portfolio-csv.js';
import {cnj} from './helpers.mjs';

test('modelo CSV é vazio, legível pelo importador e não inclui dados fictícios',()=>{
  const template=portfolioTemplateCsv();
  assert.ok(template.startsWith('\uFEFFsep=;\r\n'));
  const sheet=parseDelimited(template);
  assert.deepEqual(sheet.headers,PORTFOLIO_HEADERS);
  assert.equal(sheet.rows.length,0);
  const mapping=suggestMapping(sheet.headers);
  for(const field of ['cnj','title','client','area','stage','review','notes','court','courtLevel','processSystem','docketNumber','originReference'])assert.ok(mapping[field]>=0,field+' mapeado');
});

test('exportação local cria CSV com processo original, recurso e arquivados',()=>{
  const state=emptyState();
  const client=saveEntity(state,'clients',{name:'Cliente; "Confidencial"'});
  const a=saveEntity(state,'cases',{cnj:cnj(701,'8','19'),title:'Ação com; vírgulas, e "aspas"',clientId:client.id,stage:'doing',court:'tjrj',courtLevel:'first',processSystem:'pje',review:'2026-11-05',notes:'Primeira linha\nSegunda linha'});
  const b=saveEntity(state,'cases',{cnj:cnj(702,'3','00'),title:'Recurso STJ',court:'stj',courtLevel:'superior',docketNumber:'REsp 123456',parentCaseId:a.id});
  b.archived=true;
  const revision=JSON.stringify(state);
  const output=exportPortfolioCsv(state);
  assert.equal(JSON.stringify(state),revision,'exportação não modifica o banco');
  const sheet=parseDelimited(output),mapping=suggestMapping(sheet.headers);
  assert.equal(sheet.rows.length,2);
  assert.deepEqual(sheet.headers,PORTFOLIO_HEADERS);
  assert.equal(sheet.rows[0].cells[0].text,formatCnj(a.cnj));
  assert.equal(sheet.rows[0].cells[2].text,client.name);
  assert.equal(sheet.rows[0].cells[6].text,'Primeira linha\nSegunda linha');
  assert.equal(sheet.rows[1].cells[11].text,formatCnj(a.cnj));
  assert.equal(sheet.rows[1].cells[12].text,'Arquivado');
  const preview=planSpreadsheetImport(emptyState(),sheet,mapping);
  assert.equal(preview.ready.length,2);
  assert.equal(preview.invalid.length,0);
  assert.equal(preview.ready[0].record.court,'tjrj');
  assert.equal(preview.ready[1].record.court,'stj');
  assert.equal(preview.ready[1].record.originReference,formatCnj(a.cnj));
  assert.equal(preview.ready[1].record.archived,true);
  const recovered=emptyState();
  const result=commitSpreadsheetImport(recovered,sheet,mapping,preview);
  assert.equal(result.imported,2);
  assert.equal(recovered.cases.find(c=>c.cnj===b.cnj).archived,true);
});

test('exportação evita execução de fórmulas em células de Excel/Sheets',()=>{
  const state=emptyState();
  saveEntity(state,'cases',{title:'=HYPERLINK("https://example.invalid","x")',cnj:cnj(703,'4','02'),notes:'  +SUM(1;2)\nObservação'});
  const sheet=parseDelimited(exportPortfolioCsv(state));
  assert.ok(sheet.rows[0].cells[1].text.startsWith("'=HYPERLINK"));
  assert.ok(sheet.rows[0].cells[6].text.startsWith("'+SUM"));
  assert.ok(!exportPortfolioCsv(state).includes('"+SUM('));
});
test('relatório completo da prévia contém todas as linhas, motivos e CNJs originais',()=>{
  const s=emptyState();
  const sheet=parseDelimited('CNJ;Assunto\n'+cnj(701,'8','19')+';Recurso válido\n123;=HYPERLINK("https://example.invalid")\n');
  const mapping=suggestMapping(sheet.headers),plan=planSpreadsheetImport(s,sheet,mapping);
  const report=exportImportReportCsv(plan);
  const parsed=parseDelimited(report);
  assert.equal(parsed.rows.length,2);
  assert.equal(parsed.rows[1].cells[0].text,'3');
  assert.equal(parsed.rows[1].cells[3].text,'123');
  assert.ok(parsed.rows[1].cells[6].text.startsWith("'=HYPERLINK"));
  assert.match(parsed.rows[1].cells[2].text,/inválido/);
  assert.deepEqual(s.cases,[]);
});
