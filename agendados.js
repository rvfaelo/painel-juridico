// Projeção somente leitura para organizar o acompanhamento manual dos processos.
// Datas são dias locais informados pelo usuário; não são prazos judiciais calculados.
import {workOwnerOf,workStatusOf} from './state-machines.js';
export const SCHEDULE_GROUPS=Object.freeze({overdue:'Revisões atrasadas',today:'Revisar hoje',week:'Revisar nos próximos 7 dias',later:'Próximas revisões',undated:'Sem revisão marcada'});
export const SCHEDULE_SORTS=Object.freeze({priority:'Data de revisão',client:'Cliente',status:'Situação do próximo passo'});
export function scheduleGroup(caseRow,today){
  const review=String(caseRow?.review||'');
  if(!/^\d{4}-\d\d-\d\d$/.test(review))return 'undated';
  if(review<today)return 'overdue';
  if(review===today)return 'today';
  const difference=(Date.parse(review+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000;
  return difference<=7?'week':'later';
}
export function scheduledCases(cases,{owner='all',query='',sort='priority',today,clientName=()=>''}={}){
  const todayKey=today||new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
  const all=(cases||[]).filter(c=>!c.archived);
  const counts={all:all.length,me:0,court:0,other:0,client:0};
  for(const c of all)counts[workOwnerOf(c)]++;
  const needle=String(query||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
  const rows=all.filter(c=>(owner==='all'||workOwnerOf(c)===owner)&&(!needle||normalize([
    c.title,c.cnj,c.docketNumber,c.area,c.nextStep,clientName(c.clientId),...(c.pendingItems||[]).map(x=>x.title)
  ].join(' ')).includes(needle)));
  const groups=Object.fromEntries(Object.keys(SCHEDULE_GROUPS).map(key=>[key,[]]));
  for(const c of rows)groups[scheduleGroup(c,todayKey)].push(c);
  const byText=(a,b)=>String(a||'').localeCompare(String(b||''),'pt-BR');
  for(const group of Object.values(groups))group.sort((a,b)=>{
    if(sort==='client')return byText(clientName(a.clientId),clientName(b.clientId))||byText(a.title,b.title);
    if(sort==='status')return byText(workStatusOf(a),workStatusOf(b))||byText(a.review||'9999',b.review||'9999');
    return byText(a.review||'9999',b.review||'9999')||byText(a.title,b.title);
  });
  return {groups,counts,rows,total:rows.length,today:todayKey,
    overview:{overdue:all.filter(c=>scheduleGroup(c,todayKey)==='overdue').length,
      today:all.filter(c=>scheduleGroup(c,todayKey)==='today').length,
      week:all.filter(c=>scheduleGroup(c,todayKey)==='week').length,
      pending:all.reduce((sum,c)=>sum+(c.pendingItems||[]).filter(x=>!x.done).length,0)}};
}
