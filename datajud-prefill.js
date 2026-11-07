// Prévia avulsa DataJud. Só há persistência quando o usuário salva a ficha.
// Não consulta o navegador diretamente: recebe apiPost da ponte same-origin.
import {digits, validCnj} from './core.js';
import {escapeHTML} from './html-utils.js';

const drafts = new WeakMap();
const initialDrafts = new WeakMap();
const previews = new WeakMap();
const labels = {tribunal:'Tribunal', grau:'Grau', sistema:'Sistema', classe:'Classe',
  assuntos:'Assuntos', orgao:'Órgão julgador', dataAjuizamento:'Data de ajuizamento'};
const infoFields = ['tribunal','grau','sistema','classe','assuntos','orgao','dataAjuizamento'];

export function suggestions(record) {
  const court = String(record?.tribunal||'').toUpperCase().trim();
  const courts = {TJRJ:'tjrj',TRF2:'trf2',TJSP:'tjsp',STJ:'stj',STF:'stf'};
  const degree = String(record?.grau||'').toUpperCase().trim();
  const system = String(record?.sistema||'').toLowerCase().trim();
  return {
    court: courts[court] || (court && /^(TJ|TRF|TRT|TRE|TST|TSE|STM)/.test(court) ? 'other':'') || '',
    courtLevel: ['G1','1','PRIMEIRO GRAU','1º GRAU'].includes(degree) ? 'first' :
      ['G2','2','SEGUNDO GRAU','2º GRAU'].includes(degree) ? 'second' :
      ['SUP','SUPERIOR'].includes(degree) ? 'superior' : degree ? 'other' : '',
    processSystem: !system ? '' : /\beproc\b/.test(system) ? 'eproc' :
      /\bpje\b/.test(system) ? 'pje' : /\bprojudi\b/.test(system) ? 'projudi' :
      /\be.?saj\b/.test(system) ? 'esaj' : 'other'
  };
}

export function normalizedDetails(record, cnj) {
  return {cnj:digits(cnj),recordId:String(record.id||'').slice(0,150),
    tribunal:String(record.tribunal||'').slice(0,35),grau:String(record.grau||'').slice(0,35),
    sistema:String(record.sistema||'').slice(0,100),classe:String(record.classe||'').slice(0,180),
    assuntos:Array.isArray(record.assuntos)?record.assuntos.slice(0,20).map(x=>String(x).slice(0,180)):[],
    orgao:String(record.orgao||'').slice(0,180),
    dataAjuizamento:String(record.dataAjuizamento||'').slice(0,45),
    sourceUpdatedAt:String(record.sourceUpdatedAt||'').slice(0,45)};
}

export function mergeDetails(existing, incoming) {
  if(!existing || existing.cnj !== incoming.cnj)return incoming;
  const result={...existing};
  for(const key of Object.keys(incoming)) {
    if(key==='cnj')continue;
    if(key==='assuntos'){
      if(!Array.isArray(result.assuntos)||!result.assuntos.length)result.assuntos=incoming.assuntos;
    } else if(!String(result[key]||'').trim())result[key]=incoming[key];
  }
  return result;
}

export function applyEmptyFields(form, record, current, cnj) {
  const result={filled:[],preserved:[],missing:[]};
  const suggested=suggestions(record);
  const manualCourt=form.elements.namedItem('court')?.value||'';
  const sourceCourt=suggested.court;
  const differentCourt=!!manualCourt&&!!sourceCourt&&manualCourt!==sourceCourt&&manualCourt!=='other';
  const effectiveCourt=manualCourt||sourceCourt;
  if(differentCourt)result.missing.push('Conferência do tribunal (seleção diferente da fonte)');
  if(effectiveCourt==='stj'||effectiveCourt==='stf'){
    if(suggested.courtLevel&&!differentCourt)suggested.courtLevel='superior';
  }else if(['tjrj','trf2','tjsp'].includes(effectiveCourt)&&suggested.courtLevel==='superior'){
    suggested.courtLevel='';
  }
  for(const [name,label] of [['court','Tribunal'],['courtLevel','Grau'],['processSystem','Sistema']]) {
    const field=form.elements.namedItem(name);
    if(!field)continue;
    if(String(field.value||'').trim()){result.preserved.push(label);continue;}
    if(differentCourt&&name!=='court'){result.missing.push(label+' (requer conferência)');continue;}
    if(!suggested[name]){result.missing.push(label);continue;}
    // Só usar opções reais do formulário, sem criar novos valores inválidos.
    if(![...field.options].some(option=>option.value===suggested[name])){
      result.missing.push(label);continue;
    }
    field.value=suggested[name];result.filled.push(label);
  }
  const incoming=normalizedDetails(record,cnj);
  const details=mergeDetails(current,incoming);
  for(const key of ['classe','assuntos','orgao','dataAjuizamento']){
    const value=details[key];
    if(!value||(Array.isArray(value)&&!value.length))result.missing.push(labels[key]);
  }
  const metadataLabels={...labels,recordId:'Identificação do registro',sourceUpdatedAt:'Atualização na fonte'};
  const hasValue=value=>Array.isArray(value)?value.length>0:!!String(value||'').trim();
  const metadataFilled=Object.keys(metadataLabels).filter(key=>
    hasValue(details[key])&&(!current||current.cnj!==cnj||!hasValue(current[key]))).map(key=>metadataLabels[key]);
  return {...result,metadataFilled,details};
}

function detailsHTML(details) {
  if(!details)return '<p class="muted compact">Nenhum dado público aplicado. As observações pessoais ficam separadas.</p>';
  const entries=[['Tribunal',details.tribunal],['Grau',details.grau],
    ['Sistema informado pela fonte',details.sistema],['Classe',details.classe],
    ['Assuntos',(details.assuntos||[]).join('; ')],['Órgão julgador',details.orgao],
    ['Data de ajuizamento',details.dataAjuizamento],['Atualização na fonte',details.sourceUpdatedAt]];
  return '<dl class="datajud-details">'+entries.map(([label,value])=>
    `<div><dt>${label}</dt><dd>${value?escapeHTML(value):'Não informado pelo DataJud'}</dd></div>`).join('')+
    '</dl><p class="muted compact">Fonte: DataJud/CNJ · registro '+escapeHTML(details.recordId||'não informado')+'. Dados públicos importados por confirmação; não alteram suas observações.</p>';
}

export function initDatajudForm(form, saved) {
  const original=saved && saved.cnj===digits(form.elements.cnj.value)?structuredClone(saved):null;
  initialDrafts.set(form,original);
  drafts.set(form,original?structuredClone(original):null);
  previews.delete(form);
  form.addEventListener('change',event=>{
    if(!['court','courtLevel','processSystem'].includes(event.target.name))return;
    const data=previews.get(form);if(!data?.application)return;
    delete data.application;updateApplyState(form);
  });
  renderDetails(form);
}

export function getDatajudDraft(form){return drafts.get(form)||null;}

function renderDetails(form) {
  const container=form.querySelector('#datajud-fields');
  if(container)container.innerHTML=detailsHTML(getDatajudDraft(form));
}

function renderPreview(form) {
  const holder=form.querySelector('#datajud-preview'),data=previews.get(form);
  if(!holder)return;
  if(!data){holder.hidden=true;holder.innerHTML='';return;}
  const records=data.records||[], index=Number(form.querySelector('#datajud-choice')?.value||0);
  const item=records[index]||records[0];
  holder.hidden=false;
  holder.innerHTML=`<h3>Prévia dos dados públicos</h3><p class="muted compact">${escapeHTML(data.message||'')} Nenhuma informação será salva antes de confirmar e salvar o processo.</p>`+
    (data.partial?'<p class="warning-note">Resultado parcial. Alguns registros podem não ter sido consultados.</p>':'')+
    (records.length>1?`<label class="field">Escolha o registro ou grau
      <select id="datajud-choice" aria-label="Selecionar registro DataJud">${records.map((row,i)=>
      `<option value="${i}" ${i===index?'selected':''}>${escapeHTML(row.tribunal||'Tribunal não informado')} · ${escapeHTML(row.grau||'Grau não informado')} · ${escapeHTML(row.orgao||row.id||'Registro '+(i+1))}</option>`).join('')}</select></label>`:'')+
    (item?'<dl class="datajud-details">'+infoFields.map(field=>{
      const value=field==='assuntos'?(item.assuntos||[]).join('; '):item[field];
      return `<div><dt>${labels[field]}</dt><dd>${escapeHTML(value||'Não informado pela fonte')}</dd></div>`;
    }).join('')+'</dl><button type="button" class="button secondary small" data-action="datajud-apply">Aplicar apenas aos campos vazios</button><p id="datajud-apply-status" class="datajud-apply-status" role="status" aria-live="polite" aria-atomic="true" hidden></p>':
    '<p class="warning-note">Nenhum registro localizado nesta consulta. Isso não prova inexistência do processo. Confira o portal oficial.</p>');
  updateApplyState(form);
}

function updateApplyState(form){
  const data=previews.get(form),button=form.querySelector('[data-action="datajud-apply"]'),status=form.querySelector('#datajud-apply-status');
  if(!button||!status)return;
  const result=data?.application?.selected===(data?.selected||0)?data.application.result:null;
  button.disabled=!!result;status.hidden=!result;
  if(!result){button.textContent='Aplicar apenas aos campos vazios';status.textContent='';delete status.dataset.outcome;return;}
  const changed=result.filled.length>0||result.metadataFilled.length>0;
  button.textContent=changed?'✓ Dados aplicados':'Nenhum dado novo para aplicar';
  status.dataset.outcome=changed?'applied':'unchanged';
  status.textContent=(changed?'Dados aplicados ao formulário. Ainda não foram salvos. ':'Nenhum campo foi alterado nesta aplicação. ')+
    `Campos preenchidos: ${result.filled.join(', ')||'nenhum'}. `+
    `Dados públicos adicionados: ${result.metadataFilled.join(', ')||'nenhum'}. `+
    `Mantidos como estavam: ${result.preserved.join(', ')||'nenhum'}. `+
    `Não disponíveis: ${result.missing.join(', ')||'nenhum'}. `+
    'Para gravar a ficha, clique em Salvar caso.';
}

export function chooseDatajudRecord(form) {
  if(!previews.get(form))return;
  const chosen=Number(form.querySelector('#datajud-choice')?.value||0);
  // A renderização reconstrói o select; guardar a escolha no estado da prévia.
  const previous=previews.get(form);previous.selected=Number.isInteger(chosen)?chosen:0;
  delete previous.application;
  const status=form.querySelector('#datajud-status');if(status){status.textContent='';status.dataset.level='';}
  renderPreviewSelection(form);
}

function renderPreviewSelection(form){
  const data=previews.get(form);
  if(!data)return;
  const original=form.querySelector('#datajud-choice');
  // Permite à mesma prévia alternar entre graus sem perder os dados.
  if(original)original.value=String(data.selected||0);
  const holder=form.querySelector('#datajud-preview');
  if(!holder)return;
  const selected=data.records[data.selected||0];
  const dl=holder.querySelector('.datajud-details');
  if(dl&&selected)dl.innerHTML=infoFields.map(field=>{
    const value=field==='assuntos'?(selected.assuntos||[]).join('; '):selected[field];
    return `<div><dt>${labels[field]}</dt><dd>${escapeHTML(value||'Não informado pela fonte')}</dd></div>`;
  }).join('');
  updateApplyState(form);
}

export function invalidateDatajudIfCnjChanged(form) {
  const cnj=digits(form.elements.cnj?.value||'');
  const previous=previews.get(form);
  if(previous && previous.cnj!==cnj){previews.delete(form);renderPreview(form);}
  const current=getDatajudDraft(form);
  if(current&&current.cnj!==cnj){drafts.set(form,null);renderDetails(form);}
  const original=initialDrafts.get(form);
  if(!getDatajudDraft(form)&&original&&original.cnj===cnj){
    drafts.set(form,structuredClone(original));renderDetails(form);
  }
  const message=form.querySelector('#datajud-status');
  if(message&&(!previous||previous.cnj!==cnj)){message.textContent='';message.dataset.level='';}
}

export async function searchDatajud(form, apiPost, online) {
  const status=form.querySelector('#datajud-status'),button=form.querySelector('[data-action="datajud-search"]');
  if(!online){status.dataset.level='error';status.textContent='Abra o Painel H.B pelo iniciador integrado e mantenha o serviço Python ligado.';return;}
  const cnj=digits(form.elements.cnj.value);
  if(!validCnj(cnj)){status.dataset.level='error';status.textContent='Confira os 20 dígitos e os verificadores do número CNJ.';return;}
  previews.delete(form);renderPreview(form);
  button.disabled=true;status.dataset.level='';status.textContent='Consultando DataJud pelo serviço Python...';
  try{
    const data=await apiPost('datajud/preview',{cnj});
    if(!form.isConnected||digits(form.elements.cnj.value)!==cnj)return;
    if(data.cnj!==cnj||!Array.isArray(data.records))throw Error('Resposta DataJud incompatível com o CNJ informado.');
    previews.set(form,{...data,selected:0});renderPreview(form);
    status.dataset.level=data.records.length?'':'error';
    status.textContent=data.records.length?`${data.records.length} registro(s) recebido(s). Confira a prévia antes de aplicar.`:data.message;
  }catch(error){
    if(form.isConnected&&digits(form.elements.cnj.value)===cnj){
      status.dataset.level='error';
      status.textContent='Consulta não concluída: '+error.message+'. Nenhum campo foi alterado.';
    }
  }finally{if(button.isConnected)button.disabled=false;}
}

export function applyDatajudSelection(form) {
  const data=previews.get(form),cnj=digits(form.elements.cnj.value);
  if(!data||data.cnj!==cnj||!validCnj(cnj))throw Error('Número CNJ alterado; consulte novamente antes de aplicar.');
  const record=data.records[data.selected||0];
  if(!record)throw Error('Selecione um registro para aplicar.');
  if(data.application?.selected===(data.selected||0))return data.application.result;
  const result=applyEmptyFields(form,record,getDatajudDraft(form),cnj);
  drafts.set(form,result.details);renderDetails(form);
  const status=form.querySelector('#datajud-status');
  status.dataset.level='';status.textContent='';
  data.application={selected:data.selected||0,result};
  updateApplyState(form);
  return result;
}
