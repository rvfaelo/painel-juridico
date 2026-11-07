import {unzipSync} from './zip-inflate.js';
import {digits,formatCnj,saveEntity,validCnj,validDay,validDateTime,COURTS,COURT_LEVELS,PROCESS_SYSTEMS,normalizeDocket,backup,validateBackup} from './core.js';
import {fold} from './text-utils.js';

export const IMPORT_FIELDS=Object.freeze({
  cnj:'Número CNJ (opcional se STJ/STF com registro)',title:'Título/assunto',client:'Nome do cliente',
  plaintiff:'Autor / parte autora',defendant:'Réu / parte ré',
  hearingDate:'Audiência · data',hearingTime:'Audiência · hora',
  area:'Área',stage:'Etapa interna',review:'Data para conferir',notes:'Observações',
  court:'Tribunal',courtLevel:'Grau / instância',processSystem:'Sistema de tramitação',
  docketNumber:'Registro adicional',originReference:'Processo de origem (referência)',
  archived:'Situação do cadastro (Ativo/Arquivado)'
});
export const MAX_IMPORT_ROWS=2000,MAX_IMPORT_BYTES=6*1024*1024;
const MAX_COLUMNS=60,MAX_SHEETS=12;
const normalized=value=>fold(value).replace(/[^a-z0-9]/g,'');
const cell=(text='',kind='text')=>({text:String(text??''),kind});
const empty=x=>!x?.text?.trim();

export function parseDelimited(text,filename='planilha.csv'){
  if(typeof text!=='string'||text.length>MAX_IMPORT_BYTES)throw Error('Arquivo de texto muito grande.');
  text=text.replace(/^\uFEFF/,'');
  let specified='',preambleLines=0;
  if(/^sep=[;,\t]\r?\n/i.test(text)){specified=text[4];text=text.slice(text.indexOf('\n')+1);preambleLines=1;}
  const first=text.split(/\r?\n/,1)[0];
  const countDelimiter=delimiter=>{let quoted=false,count=0;for(let i=0;i<first.length;i++){if(first[i]==='"'){if(first[i+1]==='"'&&quoted){i++;continue;}quoted=!quoted;}else if(first[i]===delimiter&&!quoted)count++;}return count;};
  const delimiter=specified||([';','\t',','].sort((a,b)=>countDelimiter(b)-countDelimiter(a))[0]);
  if(!countDelimiter(delimiter)&&!specified)throw Error('Não encontrei colunas separadas por vírgula, ponto e vírgula ou tabulação.');
  const rows=[];let row=[],value='',quoted=false,physicalLine=preambleLines+1,rowStart=physicalLine;
  function finish(){row.push(cell(value));value='';if(row.some(x=>!empty(x))){row.sourceLine=rowStart;rows.push(row);}row=[];rowStart=physicalLine;if(rows.length>MAX_IMPORT_ROWS+1)throw Error('A planilha excede 2.000 linhas. Separe-a em arquivos menores.');}
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if((ch==='\r'||ch==='\n')&&!(ch==='\n'&&text[i-1]==='\r'))physicalLine++;
    if(ch==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else if(!quoted&&value==='')quoted=true;else if(quoted)quoted=false;else value+=ch;}
    else if(ch===delimiter&&!quoted){row.push(cell(value));value='';if(row.length>MAX_COLUMNS)throw Error('A planilha excede 60 colunas.');}
    else if((ch==='\r'||ch==='\n')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;finish();}
    else value+=ch;
  }
  if(quoted)throw Error('Arquivo CSV contém aspas sem fechamento.');
  if(row.length||value)finish();
  return makeSheet(filename,rows);
}

function makeSheet(name,rows,date1904=false){
  if(!rows.length||!rows[0]?.length)throw Error('Planilha sem cabeçalho.');
  const width=Math.max(...rows.map(r=>r.length));
  if(width>MAX_COLUMNS)throw Error('A planilha excede 60 colunas.');
  const headers=Array.from({length:width},(_,i)=>rows[0][i]?.text?.trim()||`Coluna ${i+1}`);
  return {name,headers,date1904,rows:rows.slice(1).filter(row=>row.some(c=>!empty(c))).map((row,i)=>({line:row.sourceLine||i+2,cells:row}))};
}

const xmlNodes=(node,name)=>Array.from(node.getElementsByTagNameNS('*',name));
const firstNode=(node,name)=>xmlNodes(node,name)[0]||null;
function xmlDocument(bytes,name){
  if(!bytes)throw Error('Arquivo Excel incompleto: '+name);
  const data=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if(/<!DOCTYPE|<!ENTITY/i.test(data))throw Error('XML com entidades não permitido em arquivos Excel.');
  const doc=new DOMParser().parseFromString(data,'application/xml');
  if(doc.getElementsByTagName('parsererror').length)throw Error('XML do Excel inválido: '+name);
  return doc;
}
function indexFromColumn(label){
  let n=0;for(const letter of label.toUpperCase()){const code=letter.charCodeAt(0)-64;if(code<1||code>26)throw Error('Coluna Excel inválida.');n=n*26+code;}return n-1;
}
function readWorksheet(bytes,shared,name,date1904=false){
  const doc=xmlDocument(bytes,name),rows=[];
  for(const rowEl of xmlNodes(doc,'row')){
    const values=[];let position=0;
    for(const c of xmlNodes(rowEl,'c')){
      const ref=c.getAttribute('r'),col=ref?.match(/^([A-Z]+)\d+$/i)?.[1];
      const idx=col?indexFromColumn(col):position;
      if(idx>=MAX_COLUMNS)throw Error('A planilha excede 60 colunas.');
      position=idx+1;
      const t=c.getAttribute('t')||'n';
      const v=firstNode(c,'v')?.textContent||'';
      const formula=Boolean(firstNode(c,'f'));
      const displayed=t==='s'?shared[Number(v)]??'':t==='inlineStr'?xmlNodes(firstNode(c,'is')||c,'t').map(x=>x.textContent).join(''):t==='b'?(v==='1'?'Sim':'Não'):v;
      values[idx]=cell(displayed,formula?'formula':t==='n'?'number':'text');
    }
    if(values.some(v=>!empty(v))){values.sourceLine=Number(rowEl.getAttribute('r'))||rows.length+1;rows.push(values);if(rows.length>MAX_IMPORT_ROWS+1)throw Error('A planilha excede 2.000 linhas. Separe-a em arquivos menores.');}
  }
  return makeSheet(name,rows,date1904);
}
function parseXlsx(buffer){
  if(typeof DOMParser!=='function')throw Error('A leitura XLSX precisa ser feita no navegador.');
  let total=0,count=0;
  const files=unzipSync(new Uint8Array(buffer),{filter:f=>{
    count++;if(count>400||f.originalSize>9*1024*1024||(total+=f.originalSize)>22*1024*1024)throw Error('Excel muito grande ou com conteúdo excessivamente compactado.');
    if(/vbaProject\.bin|externalLinks/i.test(f.name))throw Error('Importe um arquivo .xlsx sem macros nem vínculos externos.');
    return /^(xl\/workbook\.xml|xl\/_rels\/workbook\.xml\.rels|xl\/sharedStrings\.xml|xl\/worksheets\/[\w.-]+\.xml)$/.test(f.name);
  }});
  const workbook=xmlDocument(files['xl/workbook.xml'],'workbook.xml');
  const date1904=['1','true'].includes(firstNode(workbook,'workbookPr')?.getAttribute('date1904')||'');
  const relationships=xmlDocument(files['xl/_rels/workbook.xml.rels'],'workbook.xml.rels');
  const rels=new Map(xmlNodes(relationships,'Relationship').filter(r=>r.getAttribute('TargetMode')!=='External').map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));
  const shared=files['xl/sharedStrings.xml']?xmlNodes(xmlDocument(files['xl/sharedStrings.xml'],'sharedStrings.xml'),'si').map(x=>xmlNodes(x,'t').map(t=>t.textContent).join('')):[];
  const sheets=[];
  for(const sheet of xmlNodes(workbook,'sheet').slice(0,MAX_SHEETS)){
    const relId=sheet.getAttribute('r:id')||sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
    const target=rels.get(relId)||'';
    const plain=target.replace(/^\/?xl\//,'').replace(/^\//,'');
    if(plain.includes('..')||!/^worksheets\/[\w.-]+\.xml$/.test(plain))continue;
    const path='xl/'+plain;
    if(files[path])sheets.push(readWorksheet(files[path],shared,sheet.getAttribute('name')||`Aba ${sheets.length+1}`,date1904));
  }
  if(!sheets.length)throw Error('Não encontrei uma aba de dados importável neste Excel.');
  return {sheets};
}

export async function readSpreadsheet(file){
  if(!file||!file.name)throw Error('Selecione um arquivo .xlsx, .csv ou .tsv.');
  if(file.size>MAX_IMPORT_BYTES)throw Error('O arquivo excede o limite de 6 MB.');
  const extension=file.name.split('.').at(-1).toLowerCase();
  const bytes=await file.arrayBuffer();
  if(extension==='xlsx')return parseXlsx(bytes);
  if(!['csv','tsv'].includes(extension))throw Error('Formato não aceito. Salve a planilha como .xlsx ou CSV UTF-8.');
  let text;
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
  catch{text=new TextDecoder('windows-1252').decode(bytes);}
  return {sheets:[parseDelimited(text,file.name)]};
}

const names={
  cnj:['cnj','numerocnj','numeroprocesso','numerodoprocesso','nprocesso','processo','numprocesso','processonumero'],
  title:['titulo','assunto','nomeprocesso','descricao','caso','acao','acaotipo','nomedocaso'],
  client:['cliente','nomecliente','parte','partes','interessado','contratante'],
  plaintiff:['autor','autora','parteautora','demandante','requerente'],
  defendant:['reu','re','parte re','partere','demandado','requerido'],
  hearingDate:['audiencia','dataaudiencia','datadaaudiência','dadaaudiência','diaaudiencia'],
  hearingTime:['hora','horario','horaaudiencia','horarioaudiencia','horadaaudiência'],
  area:['area','areadodireito','areajuridica','materia'],
  stage:['etapa','status','situacao','statusinterno','andamento'],
  review:['revisao','datarevisao','proximaconferencia','conferirem','datapararevisar'],
  notes:['observacoes','observacao','notas','comentarios','anotacoes'],
  court:['tribunal','tribunalorigem','corte','orgaojudicial'],
  courtLevel:['grau','instancia','graudejurisdicao','grauinstancia','niveljudicial'],
  processSystem:['sistema','sistemajudicial','sistemaprocessual','sistemadetransitacao','sistemadetramitacao'],
  docketNumber:['registroadicional','numeroregistro','numerostj','numerostf','registrorecurso'],
  originReference:['processodeorigem','numeroprocessodeorigem','cnjorigem','processoorigem','referenciaorigem'],
  archived:['situacaocadastro','arquivado','arquivamentocadastro']
};
export function suggestMapping(headers){
  const result={};const taken=new Set();
  for(const [field,aliases] of Object.entries(names)){
    let index=headers.findIndex((h,i)=>!taken.has(i)&&aliases.includes(normalized(h)));
    if(index===-1&&field==='cnj')index=headers.findIndex((h,i)=>!taken.has(i)&&/cnj|numerodoprocesso|numeroprocesso/.test(normalized(h)));
    result[field]=index;
    if(index>=0)taken.add(index);
  }
  return result;
}

function importDate(raw){
  const value=String(raw||'').trim();
  if(!value)return '';
  const br=value.match(/^(\d\d?)\/(\d\d?)\/(\d{4})$/);
  const iso=br?`${br[3]}-${br[2].padStart(2,'0')}-${br[1].padStart(2,'0')}`:value;
  if(!validDay(iso))throw Error('Data para revisar inválida ou numérica; use DD/MM/AAAA.');
  return iso;
}

function hearingDateFromCell(value,date1904=false){
  if(!value?.text?.trim())return '';
  if(value.kind==='formula')return '';
  const text=value.text.trim();
  // XLSX exportado com formato Data frequentemente usa números seriais.
  // Limites conservadores impedem confundir um horário, CNJ ou índice com data.
  if(value.kind==='number'){
    const serial=Number(text),days=Math.floor(serial);
    if(!Number.isFinite(serial)||!Number.isInteger(serial)||days<(date1904?1:61)||days>73050)return '';
    const date=new Date(Date.UTC(date1904?1904:1899,date1904?0:11,date1904?1:30)+days*86400000);
    const iso=date.toISOString().slice(0,10);
    return validDay(iso)?iso:'';
  }
  const br=/^(\d\d?)\/(\d\d?)\/(\d{4})$/.exec(text);
  const iso=br?`${br[3]}-${br[2].padStart(2,'0')}-${br[1].padStart(2,'0')}`:text;
  return validDay(iso)?iso:'';
}
function hearingTimeFromCell(value){
  if(!value?.text?.trim()||value.kind==='formula')return '';
  const text=value.text.trim();
  if(value.kind==='number'){
    const fraction=Number(text);
    if(!Number.isFinite(fraction)||fraction<0||fraction>=1)return '';
    const minutes=Math.round(fraction*1440);
    if(minutes>=1440||Math.abs(fraction*1440-minutes)>0.1)return '';
    return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
  }
  const match=/^(\d{1,2})(?::([0-5]\d)|h(?:([0-5]\d))?)$/i.exec(text);
  if(!match)return '';
  const hour=Number(match[1]),minute=match[2]||match[3]||'00';
  return hour<=23?`${String(hour).padStart(2,'0')}:${minute}`:'';
}
export function hearingFromCells(dateCell,timeCell,date1904=false){
  const rawDate=dateCell?.text?.trim()||'',rawTime=timeCell?.text?.trim()||'';
  if(!rawDate&&!rawTime)return {when:'',note:''};
  const day=hearingDateFromCell(dateCell,date1904),time=hearingTimeFromCell(timeCell);
  const when=day&&time?`${day}T${time}`:'';
  if(when&&validDateTime(when))return {when,note:''};
  const details=[rawDate&&`Data: ${rawDate}`,rawTime&&`Hora: ${rawTime}`].filter(Boolean);
  return {when:'',note:`Audiência informada na planilha (sem agendamento automático): ${details.join(' · ')}`};
}
function importStage(raw){
  const name=normalized(raw);
  if(!name)return 'todo';
  const stages={todo:'todo',afazer:'todo',pendente:'todo',doing:'doing',fazendo:'doing',emandamento:'doing',emcurso:'doing',ready:'ready',pronto:'ready',prontoparaprotocolo:'ready',done:'done',concluido:'done',finalizado:'done'};
  if(!stages[name])throw Error('Etapa desconhecida. Mantenha a etapa original nas observações e revise a planilha.');
  return stages[name];
}
function mappedClassification(raw,field,options,court=''){
  const value=String(raw||'').trim();if(!value)return '';
  const key=normalized(value);
  if(field==='courtLevel'&&key==='turmarecursal'&&court==='trf2')return 'federal_panel';
  if(field==='courtLevel'&&key==='turmarecursal'&&['tjrj','tjsp'].includes(court))return 'state_panel';
  if(field==='courtLevel'&&key==='juizado'&&['tjrj','tjsp'].includes(court))return 'jec';
  if(field==='courtLevel'&&key==='juizado'&&court==='trf2')return 'jef';
  const aliases={
    court:{rj:'tjrj',riodejaneiro:'tjrj',tjrj:'tjrj',trf2:'trf2',trfda2regiao:'trf2',tjsp:'tjsp',sp:'tjsp',saopaulo:'tjsp',stj:'stj',stf:'stf',outro:'other',outros:'other'},
    courtLevel:{primeirograu:'first','1grau':'first',primeirainstancia:'first',segundograu:'second','2grau':'second',segundainstancia:'second',jec:'jec',juizadoespecial:'jec',juizadoespecialestadual:'jec',turmarecursalestadual:'state_panel',turmarecursal:'',jef:'jef',juizadoespecialfederal:'jef',turmarecursalfederal:'federal_panel',tribunalsuperior:'superior',superior:'superior',outro:'other'},
    processSystem:{eproc:'eproc',pje:'pje',projudi:'projudi',esaj:'esaj',portal:'portal',outro:'other'}
  };
  const selected=aliases[field]?.[key]??Object.keys(options).find(k=>normalized(k)===key||normalized(options[k])===key);
  if(!selected||!Object.hasOwn(options,selected))throw Error('Valor de '+field+' não reconhecido: '+value+'. Revise a coluna ou deixe sem mapear.');
  return selected;
}
const safeName=value=>fold(value).replace(/\s+/g,' ').trim();
export function planSpreadsheetImport(state,sheet,mapping){
  if(!sheet||!Array.isArray(sheet.headers)||!Array.isArray(sheet.rows))throw Error('Planilha inválida.');
  if(!Number.isInteger(mapping?.cnj)||mapping.cnj< -1||mapping.cnj>=sheet.headers.length)throw Error('Selecione uma coluna de CNJ ou indique tribunal superior e registro adicional.');
  const mapped=Object.values(mapping).filter(i=>Number.isInteger(i)&&i>=0);
  if(new Set(mapped).size!==mapped.length||mapped.some(i=>i>=sheet.headers.length))throw Error('Cada coluna só pode ser mapeada para um campo.');
  const existing=new Set(state.cases.map(c=>c.cnj).filter(Boolean).map(cnj=>'cnj:'+cnj));
  for(const c of state.cases)if(['stj','stf'].includes(c.court)&&c.docketNumber)existing.add('registro:'+c.court+':'+normalizeDocket(c.docketNumber));
  const found=new Set();
  const clients=new Map();
  for(const c of state.clients){const name=safeName(c.name);clients.set(name,[...(clients.get(name)||[]),c]);}
  const ignored=sheet.headers.map((name,i)=>({name,i})).filter(x=>!mapped.includes(x.i));
  const rows=sheet.rows.map(entry=>{
    const raw=field=>mapping[field]>=0?entry.cells[mapping[field]]:null;
    const value=field=>raw(field)?.text?.trim()||'';
    const cnjRaw=raw('cnj'),cnj=digits(value('cnj'));
    const hearing=hearingFromCells(raw('hearingDate'),raw('hearingTime'),!!sheet.date1904);
    const record={cnj,title:value('title'),client:value('client'),plaintiff:value('plaintiff'),defendant:value('defendant'),
      hearingWhen:hearing.when,area:value('area'),stage:'todo',review:'',notes:value('notes'),court:'',courtLevel:'',processSystem:'',docketNumber:value('docketNumber'),originReference:value('originReference'),archived:false};
    let reason='',status='ready';
    if(cnjRaw?.kind==='formula'||cnjRaw?.kind==='number')reason='CNJ salvo como fórmula/número pelo Excel. Formate a coluna como texto no arquivo original.';
    if(!reason){
      try{
        if(raw('review')?.kind==='number'||raw('review')?.kind==='formula')throw Error('Data do Excel precisa ser texto DD/MM/AAAA.');
        record.review=importDate(value('review'));record.stage=importStage(value('stage'));
        const archived=normalized(value('archived'));
        if(!['','ativo','arquivado'].includes(archived))throw Error('Situação do cadastro desconhecida; use Ativo ou Arquivado.');
        record.archived=archived==='arquivado';
        record.court=mappedClassification(value('court'),'court',COURTS);
        record.courtLevel=mappedClassification(value('courtLevel'),'courtLevel',COURT_LEVELS,record.court);
        record.processSystem=mappedClassification(value('processSystem'),'processSystem',PROCESS_SYSTEMS);
        if(record.docketNumber.length>100||record.originReference.length>120)throw Error('Número adicional ou referência de origem acima do limite.');
        if(!cnj&&(!['stj','stf'].includes(record.court)||!record.docketNumber))throw Error('Número CNJ ausente. Sem CNJ, informe tribunal STJ/STF e registro adicional.');
        if(cnj&&!validCnj(cnj))throw Error('Número CNJ inválido.');
        record.title=record.title||(cnj?'Processo '+formatCnj(cnj):'Recurso '+record.docketNumber);
        if(record.title.length>240||record.area.length>80||record.client.length>180||record.plaintiff.length>400||record.defendant.length>400||record.notes.length>4000)throw Error('Título, área, cliente, partes ou observações acima do limite.');
        const key=cnj?'cnj:'+cnj:'registro:'+record.court+':'+normalizeDocket(record.docketNumber);
        const docketKey=record.docketNumber&&['stj','stf'].includes(record.court)?'registro:'+record.court+':'+normalizeDocket(record.docketNumber):'';
        if(existing.has(key)||found.has(key)||(docketKey&&(existing.has(docketKey)||found.has(docketKey)))){status='duplicate';throw Error('CNJ ou registro superior já cadastrado ou repetido no arquivo.');}
        if(record.court&&record.courtLevel){
          const admissible={tjrj:['first','second','jec','state_panel','other'],tjsp:['first','second','jec','state_panel','other'],trf2:['first','second','jef','federal_panel','other'],stj:['superior','other'],stf:['superior','other']};
          if(admissible[record.court]&&!admissible[record.court].includes(record.courtLevel))throw Error('Grau incompatível com o tribunal; confira a linha.');
        }
      }catch(error){reason=error.message;}
    }
    if(!reason&&record.client&&clients.get(safeName(record.client))?.length>1)reason='Mais de um cliente existente com esse nome; revise a associação.';
    if(!reason){
      const extras=ignored.map(({name,i})=>[name,entry.cells[i]?.text?.trim()||'']).filter(([,v])=>v);
      record.notes=[record.notes,hearing.note,
        extras.length?'Dados não mapeados da planilha:':'',
        ...extras.map(([key,v])=>`${key}: ${v}`)].filter(Boolean).join('\n');
      if(record.notes.length>4000)reason='Dados adicionais excedem o limite de observações; reduza as colunas ou divida a importação.';
    }
    if(reason){status=status==='duplicate'?'duplicate':'invalid';}else{
      found.add(cnj?'cnj:'+cnj:'registro:'+record.court+':'+normalizeDocket(record.docketNumber));
      if(record.docketNumber&&['stj','stf'].includes(record.court))found.add('registro:'+record.court+':'+normalizeDocket(record.docketNumber));
    }
    // Persist exact matched IDs in the preview so a namesake client added in
    // another tab cannot silently change which person receives the new case.
    const clientMatches=record.client?(clients.get(safeName(record.client))||[]).map(c=>c.id):[];
    return {line:entry.line,status,reason,record,clientMatches,rawCnj:value('cnj'),hearingNote:hearing.note};
  });
  const ready=rows.filter(r=>r.status==='ready'),duplicates=rows.filter(r=>r.status==='duplicate'),invalid=rows.filter(r=>r.status==='invalid');
  return {rows,ready,duplicates,invalid,unmapped:ignored.map(x=>x.name),total:rows.length,revision:state.revision||0};
}

export function commitSpreadsheetImport(state,sheet,mapping,expected,options={}){
  const plan=planSpreadsheetImport(state,sheet,mapping);
  if(!plan.ready.length)throw Error('Nenhum processo novo válido para importar.');
  // Compare the actual import rows, not global revision: source jobs and
  // background checks can change an unrelated setting while a dialog is open.
  if(JSON.stringify(plan.rows)!==JSON.stringify(expected?.rows))throw Error('O banco ou a planilha foi alterado desde a prévia. Refaça a conferência antes de importar.');
  const countByName=new Map();
  for(const {record} of plan.ready)if(record.client){const key=safeName(record.client);countByName.set(key,(countByName.get(key)||0)+1);}
  const hasNameMatches=plan.ready.some(r=>r.clientMatches.length||r.record.client&&countByName.get(safeName(r.record.client))>1);
  if(hasNameMatches&&options.linkExistingClients!==true)throw Error('Confirme explicitamente a associação de clientes com nomes iguais antes de importar.');
  if(plan.ready.length>MAX_IMPORT_ROWS)throw Error('Limite de importação atingido.');
  try{validateBackup(backup(state));}
  catch{throw Error('Há inconsistências nos dados locais. Execute Verificar dados e anexos antes de importar para não agravar o problema.');}
  // Stage the complete import in memory. A late validation failure must not
  // leave a partial set of clients/cases in callers outside IndexedDB.
  const draft=structuredClone(state);
  const lookup=new Map(draft.clients.map(c=>[safeName(c.name),c]));
  let clientsAdded=0,appointmentsAdded=0;
  for(const {record} of plan.ready){
    let clientId='';
    if(record.client){const key=safeName(record.client);if(!lookup.has(key)){const created=saveEntity(draft,'clients',{name:record.client});lookup.set(key,created);clientsAdded++;}clientId=lookup.get(key).id;}
    const created=saveEntity(draft,'cases',{title:record.title,cnj:record.cnj,clientId,
      plaintiff:record.plaintiff,defendant:record.defendant,area:record.area,stage:record.stage,
      review:record.review,notes:record.notes,court:record.court,courtLevel:record.courtLevel,
      processSystem:record.processSystem,docketNumber:record.docketNumber,originReference:record.originReference,archived:record.archived});
    if(record.hearingWhen){
      saveEntity(draft,'appointments',{caseId:created.id,title:`Audiência · ${record.title}`,
        when:record.hearingWhen,kind:'Audiência',notes:'Importada da planilha; confirmar a pauta e o horário na fonte oficial.'});
      appointmentsAdded++;
    }
  }
  state.clients=draft.clients;
  state.cases=draft.cases;
  state.events=draft.events;
  state.appointments=draft.appointments;
  return {imported:plan.ready.length,clientsAdded,ignored:plan.invalid.length+plan.duplicates.length,
    ...(appointmentsAdded?{appointmentsAdded}:{})};
}
