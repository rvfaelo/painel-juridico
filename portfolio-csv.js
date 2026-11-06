import {COURTS,COURT_LEVELS,PROCESS_SYSTEMS,STAGES,formatCnj} from './core.js';

// CSV is a human-readable migration aid, NOT a complete Pauta backup.
// It intentionally omits financial history, attachments, queries and credentials.
export const PORTFOLIO_HEADERS=Object.freeze([
  'CNJ','Assunto','Cliente','Área','Etapa','Data Revisão','Observações',
  'Tribunal','Grau','Sistema','Registro adicional','Processo de origem','Situação cadastro',
  'Autor','Réu'
]);

function cell(value){
  let text=String(value??'');
  // Protect values opened in Excel/Sheets from spreadsheet formula injection
  // and long numeric identifiers from conversion/rounding.
  if(/^[\s\u0000-\u001f]*[=+@-]/u.test(text)||/^\d{15,}$/u.test(text))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
function csv(rows){
  return '\uFEFFsep=;\r\n'+rows.map(row=>row.map(cell).join(';')).join('\r\n')+'\r\n';
}
export function portfolioTemplateCsv(){
  return csv([PORTFOLIO_HEADERS]);
}
export function exportPortfolioCsv(state){
  if(!Array.isArray(state?.cases)||!Array.isArray(state?.clients))throw Error('Dados da carteira inválidos.');
  const clients=new Map(state.clients.map(c=>[c.id,c.name]));
  const cases=new Map(state.cases.map(c=>[c.id,c]));
  const rows=state.cases.map(c=>{
    const origin=cases.get(c.parentCaseId);
    const originNumber=origin?(origin.cnj?formatCnj(origin.cnj):origin.docketNumber||''):'';
    return [
      c.cnj?formatCnj(c.cnj):'',
      c.title,clients.get(c.clientId)||'',c.area||'',STAGES[c.stage]||'',
      c.review||'',c.notes||'',COURTS[c.court]&&c.court?COURTS[c.court]:'',
      COURT_LEVELS[c.courtLevel]&&c.courtLevel?COURT_LEVELS[c.courtLevel]:'',
      PROCESS_SYSTEMS[c.processSystem]&&c.processSystem?PROCESS_SYSTEMS[c.processSystem]:'',
      c.docketNumber||'',c.originReference||originNumber,
      c.archived?'Arquivado':'Ativo',c.plaintiff||'',c.defendant||''
    ];
  });
  return csv([PORTFOLIO_HEADERS,...rows]);
}
// The operator explicitly downloads this review file; it may contain
// confidential spreadsheet cells and must never be sent to a server.
export function exportImportReportCsv(plan){
  if(!Array.isArray(plan?.rows))throw Error('Prévia da importação indisponível.');
  const headers=['Linha original','Situação da prévia','Motivo','CNJ original','CNJ interpretado','Registro adicional','Assunto','Cliente','Tribunal','Grau','Sistema','Arquivado','Autor','Réu','Audiência na agenda','Aviso da audiência'];
  const status={ready:'Pronto',duplicate:'Duplicado',invalid:'Revisar'};
  return csv([headers,...plan.rows.map(item=>[
    item.line,status[item.status]||'Revisar',item.reason||'',item.rawCnj||'',
    item.record.cnj?formatCnj(item.record.cnj):'',item.record.docketNumber||'',
    item.record.title||'',item.record.client||'',COURTS[item.record.court]||'',
    COURT_LEVELS[item.record.courtLevel]||'',PROCESS_SYSTEMS[item.record.processSystem]||'',
    item.record.archived?'Arquivado':'Ativo',item.record.plaintiff||'',item.record.defendant||'',item.record.hearingWhen||'',item.hearingNote||''
  ])]);
}
