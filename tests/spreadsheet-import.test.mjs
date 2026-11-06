import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,saveEntity} from '../core.js';
import {cnj} from './helpers.mjs';
import {parseDelimited,suggestMapping,planSpreadsheetImport,commitSpreadsheetImport,hearingFromCells} from '../spreadsheet-import.js';

const first=cnj(1,'8','19'),second=cnj(2,'4','02'),third=cnj(3,'8','26');

test('CSV em português preserva caracteres, delimitador e campo com quebras de linha',()=>{
  const csv='\uFEFFsep=;\r\nNúmero do Processo;Cliente;Assunto;Observações\r\n"'+first+'";"Cliente Exemplo";"Ação, Cível";"Linha 1\nLinha 2"\r\n';
  const sheet=parseDelimited(csv);
  assert.equal(sheet.headers.length,4);
  assert.equal(sheet.rows.length,1);
  assert.equal(sheet.rows[0].cells[3].text,'Linha 1\nLinha 2');
  const mapping=suggestMapping(sheet.headers);
  assert.equal(mapping.cnj,0);assert.equal(mapping.client,1);
  assert.equal(mapping.title,2);assert.equal(mapping.notes,3);
  assert.throws(()=>parseDelimited('CNJ;Título\n"aberto;X'),/aspas/);
});
test('linha reportada corresponde ao arquivo original mesmo com quebras e linhas vazias',()=>{
  const raw='\uFEFFsep=;\r\nCNJ;Assunto\r\n\r\n"'+first+'";"Linha 1\nLinha 2"\r\n\r\n123;Inválido';
  const sheet=parseDelimited(raw);
  assert.equal(sheet.rows[0].line,4);
  assert.equal(sheet.rows[1].line,7);
  const mapping=suggestMapping(sheet.headers),preview=planSpreadsheetImport(emptyState(),sheet,mapping);
  assert.equal(preview.rows[0].line,4);
  assert.equal(preview.rows[1].line,7);
  assert.equal(preview.invalid.length,1);
});

test('importação só acrescenta casos novos e clientes por nome sem sobrescrever os existentes',()=>{
  const s=emptyState();
  const old=saveEntity(s,'clients',{name:'Cliente Exemplo',notes:'Não alterar'});
  saveEntity(s,'cases',{cnj:third,title:'Já existente'});
  const sheet=parseDelimited(['CNJ;Cliente;Assunto;Etapa;Data Revisão;Tribunal;Grau;Observações',
    first+';Cliente Exemplo;Ação de Teste;Fazendo;10/11/2026;TJRJ;Primeiro grau;Texto de teste',
    second+';Cliente Novo;Recurso JEF;A Fazer;11/11/2026;TRF2;Turma recursal;Verificar origem',
    third+';Cliente Duplicado;Ignorar;A Fazer;12/11/2026;TJSP;Juizado;Ignorado',
    '00000000000000000000;Incorreto;Ignorar;A Fazer;12/11/2026;TJSP;Juizado;Ignorado'].join('\n'));
  const mapping=suggestMapping(sheet.headers);
  const preview=planSpreadsheetImport(s,sheet,mapping);
  assert.equal(preview.ready.length,2);assert.equal(preview.duplicates.length,1);assert.equal(preview.invalid.length,1);
  assert.deepEqual(preview.unmapped,[]);
  assert.deepEqual(s.cases.map(c=>c.cnj),[third]);
  assert.throws(()=>commitSpreadsheetImport(s,sheet,mapping,preview),/Confirme explicitamente/);
  const result=commitSpreadsheetImport(s,sheet,mapping,preview,{linkExistingClients:true});
  assert.deepEqual(result,{imported:2,clientsAdded:1,ignored:2});
  assert.equal(s.cases.length,3);
  assert.equal(s.clients.length,2);
  assert.equal(s.clients[0].id,old.id);assert.equal(s.clients[0].notes,'Não alterar');
  const inserted=s.cases.find(c=>c.cnj===first);
  assert.equal(inserted.clientId,old.id);
  assert.equal(inserted.stage,'doing');
  assert.equal(inserted.review,'2026-11-10');
  assert.equal(inserted.court,'tjrj');
  assert.equal(inserted.courtLevel,'first');
  assert.equal(s.cases.find(c=>c.cnj===second).courtLevel,'federal_panel');
  assert.equal(s.jobs.length,0);
  const duplicatePreview=planSpreadsheetImport(s,sheet,mapping);
  assert.equal(duplicatePreview.ready.length,0);
  assert.throws(()=>commitSpreadsheetImport(s,sheet,mapping,preview),/alterado|Nenhum processo/);
});

test('CNJ inválido, CNJ como número e fórmulas nunca são cadastrados',()=>{
  const s=emptyState(),sheet=parseDelimited(['CNJ;Assunto',
    first+';Novo',
    first+';Repetido',
    '9.99999999999999E+19;Científico',
    '123;Incorreto',
    second+';Novo 2'].join('\n'));
  sheet.rows[4].cells[0].kind='formula';
  const mapping=suggestMapping(sheet.headers),preview=planSpreadsheetImport(s,sheet,mapping);
  assert.equal(preview.ready.length,1);
  assert.equal(preview.duplicates.length,1);
  assert.equal(preview.invalid.length,3);
  assert.match(preview.rows.at(-1).reason,/fórmula/);
  assert.throws(()=>planSpreadsheetImport(s,sheet,{cnj:0,title:0}),/Cada coluna/);
});

test('plano de importação rejeita revisão alterada após prévia, sem modificar banco',()=>{
  const s=emptyState(),sheet=parseDelimited('CNJ;Assunto\n'+first+';Teste\n'+second+';Outro'),mapping=suggestMapping(sheet.headers);
  const preview=planSpreadsheetImport(s,sheet,mapping);
  saveEntity(s,'cases',{cnj:first,title:'Criado por outra aba'});
  const snapshot=structuredClone(s);
  assert.throws(()=>commitSpreadsheetImport(s,sheet,mapping,preview),/alterado/);
  assert.deepEqual(s,snapshot);
});

test('importa registros STJ e STF sem CNJ somente com tribunal e número adicional',()=>{
  const s=emptyState();
  const sheet=parseDelimited([
    'CNJ;Assunto;Tribunal;Grau;Registro adicional',
    ';Recurso especial teste;STJ;Tribunal superior;REsp 123456',
    ';Recurso extraordinário teste;STF;Tribunal superior;RE 789000',
    ';Outra linha igual;STJ;Tribunal superior;  resp   123456 ',
    ';Juizado sem CNJ;TRF2;JEF;Recurso 57',
    ';STJ sem registro;STJ;Tribunal superior;',
    '123;CNJ inválido;STF;Tribunal superior;RE 888'
  ].join('\n'));
  const mapping=suggestMapping(sheet.headers),plan=planSpreadsheetImport(s,sheet,mapping);
  assert.equal(plan.ready.length,2);
  assert.equal(plan.duplicates.length,1);
  assert.equal(plan.invalid.length,3);
  assert.match(plan.rows[2].reason,/registro superior já cadastrado|repetido/);
  assert.match(plan.rows[3].reason,/Sem CNJ/);
  const result=commitSpreadsheetImport(s,sheet,mapping,plan);
  assert.deepEqual(result,{imported:2,clientsAdded:0,ignored:4});
  assert.equal(s.cases.length,2);
  assert.equal(s.cases[0].cnj,'');
  assert.equal(s.cases[0].court,'stj');
  assert.equal(s.cases[1].court,'stf');
  const newPlan=planSpreadsheetImport(s,sheet,mapping);
  assert.equal(newPlan.ready.length,0);
  assert.equal(newPlan.duplicates.length,3);
});

test('planilha sem coluna CNJ ainda aceita STJ/STF com registro e recusa demais',()=>{
  const s=emptyState(),sheet=parseDelimited('Assunto;Tribunal;Registro adicional\nREsp teste;STJ;REsp 420\nComum;TJSP;123');
  const mapping=suggestMapping(sheet.headers);
  assert.equal(mapping.cnj,-1);
  const plan=planSpreadsheetImport(s,sheet,mapping);
  assert.equal(plan.ready.length,1);
  assert.equal(plan.invalid.length,1);
  assert.equal(plan.ready[0].record.title,'REsp teste');
  commitSpreadsheetImport(s,sheet,mapping,plan);
  assert.equal(s.cases[0].docketNumber,'REsp 420');
});

test('importação por planilha não altera arrays em caso de erro tardio',()=>{
  const s=emptyState(),sheet=parseDelimited('CNJ;Cliente;Assunto\n'+first+';Cliente novo;Importar primeira\n'+second+';Outro cliente;Importar segunda');
  const mapping=suggestMapping(sheet.headers),plan=planSpreadsheetImport(s,sheet,mapping);
  // Simula uma validação tardia da criação sem modificar as linhas da prévia.
  s.cases.push({id:'legado',title:'Registro legado',cnj:'',court:'trf2',courtLevel:'first',parentCaseId:'inexistente',stage:'todo'});
  const before=structuredClone(s);
  assert.throws(()=>commitSpreadsheetImport(s,sheet,mapping,plan),/inconsistências nos dados locais/);
  assert.deepEqual(s,before);
});

test('sete colunas existentes são identificadas na ordem e criam audiência vinculada sem inventar cliente',()=>{
  const state=emptyState();
  const sheet=parseDelimited(['Tribunal;Processo;Autor;Reu;Ação;Audiencia;Hora',
    `TJRJ;${first};Maria Autora;Empresa Ré;Ação Indenizatória;18/11/2026;14:30`,
    `TRF2;${second};João da Silva;Instituto;Obrigação de Fazer;20/11/2026;9h`
  ].join('\n'));
  const mapping=suggestMapping(sheet.headers);
  assert.deepEqual(
    ['court','cnj','plaintiff','defendant','title','hearingDate','hearingTime'].map(x=>mapping[x]),
    [0,1,2,3,4,5,6]
  );
  assert.equal(mapping.client,-1,'Autor não é automaticamente o cliente.');
  const plan=planSpreadsheetImport(state,sheet,mapping);
  assert.equal(plan.ready.length,2);
  assert.deepEqual(plan.unmapped,[]);
  assert.equal(plan.ready[0].record.hearingWhen,'2026-11-18T14:30');
  assert.equal(plan.ready[1].record.hearingWhen,'2026-11-20T09:00');
  const result=commitSpreadsheetImport(state,sheet,mapping,plan);
  assert.deepEqual(result,{imported:2,clientsAdded:0,ignored:0,appointmentsAdded:2});
  assert.equal(state.clients.length,0);
  assert.equal(state.cases[0].title,'Ação Indenizatória');
  assert.equal(state.cases[0].plaintiff,'Maria Autora');
  assert.equal(state.cases[0].defendant,'Empresa Ré');
  assert.equal(state.cases[1].plaintiff,'João da Silva');
  assert.equal(state.cases[0].clientId,'');
  assert.equal(state.appointments.length,2);
  assert.equal(state.appointments[0].kind,'Audiência');
  assert.equal(state.appointments[0].when,'2026-11-18T14:30');
  assert.equal(state.appointments[0].caseId,state.cases[0].id);
  const again=planSpreadsheetImport(state,sheet,mapping);
  assert.equal(again.duplicates.length,2);
  assert.equal(state.appointments.length,2,'Nova importação não duplica agendamento.');
});

test('audiências sem data e hora completas preservam texto original sem fabricar horário',()=>{
  const state=emptyState();
  const sheet=parseDelimited(['Tribunal;Processo;Autor;Réu;Ação;Audiência;Hora',
    `TJRJ;${first};Parte A;Parte B;Ação A;18/11/2026;`,
    `TJRJ;${second};Parte C;Parte D;Ação B;Aguardando designação;15:00`,
    `TJRJ;${third};Parte E;Parte F;Ação C;31/02/2026;09:30`
  ].join('\n'));
  const mapping=suggestMapping(sheet.headers),plan=planSpreadsheetImport(state,sheet,mapping);
  assert.equal(plan.ready.length,3);
  assert.equal(plan.ready.filter(x=>x.record.hearingWhen).length,0);
  assert.equal(plan.ready.filter(x=>x.hearingNote).length,3);
  const result=commitSpreadsheetImport(state,sheet,mapping,plan);
  assert.equal(result.appointmentsAdded,undefined);
  assert.equal(state.appointments.length,0);
  assert.match(state.cases[0].notes,/Audiência informada.*18\/11\/2026/);
  assert.match(state.cases[1].notes,/Aguardando designação/);
  assert.match(state.cases[2].notes,/31\/02\/2026/);
});

test('datas e horas seriais de Excel são interpretadas quando numéricas, nunca como prazos',()=>{
  const numberDate=(date,epoch)=>String((Date.UTC(...date)-Date.UTC(...epoch))/86400000);
  const serial=numberDate([2026,10,18],[1899,11,30]);
  const from1904=numberDate([2026,10,18],[1904,0,1]);
  assert.equal(hearingFromCells({text:serial,kind:'number'},{text:'0.625',kind:'number'}).when,'2026-11-18T15:00');
  assert.equal(hearingFromCells({text:from1904,kind:'number'},{text:'0.375',kind:'number'},true).when,'2026-11-18T09:00');
  assert.equal(hearingFromCells({text:'31/02/2026',kind:'text'},{text:'14:00',kind:'text'}).when,'');
  assert.equal(hearingFromCells({text:'2026-11-18',kind:'text'},{text:'14',kind:'number'}).when,'');
  assert.equal(hearingFromCells({text:'2026-11-18',kind:'formula'},{text:'12:00',kind:'text'}).when,'');
});
