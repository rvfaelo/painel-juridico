import {validCnj,digits,formatCnj,COURTS,MANUAL_COURT_SOURCES} from './core.js';

// Official entry pages checked on 2026-11-05. None is a guaranteed
// process-specific result URL, API endpoint or authenticated session.
const PORTALS=Object.freeze({
  tjrj:Object.freeze([
    {id:'portal',label:'Consulta processual TJRJ',url:'https://www.tjrj.jus.br/consultas/processos-jud/formas-dispo-consultas'},
    {id:'pje2',label:'PJe · 2º grau',url:'https://tjrj.pje.jus.br/2g/ConsultaPublica/listView.seam'},
    {id:'projudi',label:'Projudi · consulta pública',url:'https://www3.tjrj.jus.br/projudi/processo/consultaPublica.do?actionType=pesquisar'},
    {id:'eproc',label:'eproc · orientações TJRJ',url:'https://www.tjrj.jus.br/servicos/processo-eletronico'}
  ]),
  trf2:Object.freeze([
    {id:'portal',label:'Consultas processuais · TRF2',url:'https://www.trf2.jus.br/trf2/consultas-e-servicos/consultas-processuais'},
    {id:'eproc',label:'eproc · consulta pública unificada',url:'https://balcaojus.trf2.jus.br/balcaojus/#/consultar'},
    {id:'orientacoes',label:'Orientações do eproc · TRF2',url:'https://portaleproc.trf2.jus.br/'}
  ]),
  tjsp:Object.freeze([
    {id:'portal',label:'Consulta de processos · TJSP',url:'https://www.tjsp.jus.br/Processos'},
    {id:'eproc',label:'eproc · acesso e consulta unificada',url:'https://portal.tjsp.jus.br/eproc'},
    {id:'esaj',label:'e-SAJ · consultas por grau',url:'https://esaj.tjsp.jus.br/esaj?servico=190090'}
  ]),
  stj:Object.freeze([
    {id:'portal',label:'Consulta processual · STJ',url:'https://www.stj.jus.br/sites/portalp/Processos/Consulta-Processual/'}
  ]),
  stf:Object.freeze([
    {id:'portal',label:'Consulta processual · STF',url:'https://portal.stf.jus.br/processos/'}
  ])
});

// For legacy cases without an explicitly selected tribunal, retain only
// the pre-existing TJRJ behavior. Do NOT guess TRF2/TJSP/STJ/STF by CNJ.
export function officialConsultation(input,system='',court=''){
  const isCase=input!==null&&typeof input==='object'&&!Array.isArray(input);
  const cnj=isCase?input.cnj:input;
  const chosenCourt=isCase?String(input.court||''):String(court||'');
  const selectedSystem=isCase?String(input.processSystem||input.judicialSystem||''):String(system||'');
  const valid=validCnj(cnj),number=valid?formatCnj(digits(cnj)):'';
  const resolved=chosenCourt||((valid&&digits(cnj).slice(13,16)==='819')?'tjrj':'');
  if(!Object.hasOwn(PORTALS,resolved))return null;
  const docket=isCase?String(input.docketNumber||'').trim():'';
  if(!valid&&!docket)return null;
  const links=PORTALS[resolved];
  const priority={pje:'pje2',projudi:'projudi',esaj:'esaj',eproc:'eproc',portal:'portal'}[selectedSystem];
  const sorted=priority?[...links].sort((a,b)=>Number(b.id===priority)-Number(a.id===priority)):links;
  return {court:resolved,courtLabel:COURTS[resolved],number,docket,links:sorted,manualSources:MANUAL_COURT_SOURCES[resolved],system:selectedSystem,explicitCourt:!!chosenCourt};
}
