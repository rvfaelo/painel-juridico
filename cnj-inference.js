import {digits,validCnj,tribunalAlias} from './core.js';
import {TJRJ_ORIGIN_UNITS} from './cnj-origin-units.js';

const SEGMENTS={
  '1':'Supremo Tribunal Federal',
  '2':'Conselho Nacional de Justiça',
  '3':'Superior Tribunal de Justiça',
  '4':'Justiça Federal',
  '5':'Justiça do Trabalho',
  '6':'Justiça Eleitoral',
  '7':'Justiça Militar da União',
  '8':'Justiça Estadual e do Distrito Federal e Territórios',
  '9':'Justiça Militar Estadual'
};
const COURT_FIELD_BY_ALIAS={tjrj:'tjrj',trf2:'trf2',tjsp:'tjsp',stj:'stj'};
const autoFilledCourt=new WeakMap();

function tribunalName(alias,j,tr){
  if(j==='1'&&tr==='00')return 'STF';
  if(j==='2'&&tr==='00')return 'CNJ';
  if(j==='3'&&tr==='00')return 'STJ';
  if(j==='5'&&tr==='00')return 'TST';
  if(j==='6'&&tr==='00')return 'TSE';
  if(j==='7'&&tr==='00')return 'STM';
  if(!alias)return `Tribunal não identificado localmente (código ${j}.${tr})`;
  if(/^trf\d+$/.test(alias))return alias.toUpperCase();
  if(/^trt\d+$/.test(alias))return `TRT da ${Number(alias.slice(3))}ª Região`;
  if(alias.startsWith('tre-'))return alias.toUpperCase();
  if(alias.startsWith('tjm'))return `TJM-${alias.slice(3).toUpperCase()}`;
  return alias.toUpperCase();
}

export function inferCnjJurisdiction(value){
  const cnj=digits(value);
  if(!validCnj(cnj))return null;
  const year=cnj.slice(9,13),j=cnj[13],tr=cnj.slice(14,16),originCode=cnj.slice(16,20);
  const alias=tribunalAlias(cnj)||(j==='1'&&tr==='00'?'stf':null);
  const segment=SEGMENTS[j]||`Segmento ${j}`;
  const originUnitNames=alias==='tjrj'?(TJRJ_ORIGIN_UNITS[originCode]||[]):[];
  const originUnit=originUnitNames.length===1?originUnitNames[0]:originUnitNames.length>1?`Código ambíguo: ${originUnitNames.join(' / ')}`:'';
  return {year,j,tr,originCode,originUnit,originUnitNames,segment,alias,tribunal:tribunalName(alias,j,tr),court:alias==='stf'?'stf':COURT_FIELD_BY_ALIAS[alias]||''};
}

function render(form,result,field){
  const summary=form.querySelector('#cnj-inference');
  if(!summary)return;
  if(!result){
    summary.textContent='Informe um CNJ válido para identificar segmento, tribunal e código da unidade de origem. O número não informa o grau nem se o sistema é PJe, eproc ou outro.';
    summary.dataset.level='';
    const unitField=form.elements.namedItem('originUnit');if(unitField)unitField.value='';
    return;
  }
  const changed=!!field?.value&&!!result.court&&field.value!==result.court;
  const courtStatus=result.court
    ? changed?'Tribunal selecionado preservado para conferência.':field?.value===result.court?'Tribunal preenchido pelo CNJ; confira antes de salvar.':'Tribunal identificado; selecione-o na lista para preencher.'
    : 'O tribunal foi identificado pelo CNJ, mas não há opção correspondente nesta lista; escolha “Outro tribunal” ou deixe sem classificação.';
  summary.dataset.level=changed?'warning':'';
  const unitField=form.elements.namedItem('originUnit');
  const unitMessage=result.originUnitNames.length===1?`Código ${result.originCode}: ${result.originUnitNames[0]}.`:result.originUnitNames.length>1?`Código ${result.originCode} consta com mais de uma designação na tabela (${result.originUnitNames.join(' / ')}); confira no tribunal.`:result.alias==='tjrj'?`Código ${result.originCode} sem correspondência única na tabela local do TJRJ.`:`A tabela local de unidade não cobre ${result.tribunal}; o código ${result.originCode} permanece sem nome resolvido.`;
  if(unitField)unitField.value=result.originUnitNames.length===1?result.originUnitNames[0]:result.originUnit;
  summary.textContent=`Pelo CNJ: ${result.segment} · ${result.tribunal} · ano ${result.year}. ${unitMessage} ${courtStatus} O número não informa grau nem sistema eletrônico (PJe/eproc/Projudi).`;
}

export function updateCnjInference(form){
  const cnjField=form.elements.namedItem('cnj'),courtField=form.elements.namedItem('court');
  if(!cnjField)return null;
  const previous=autoFilledCourt.get(form);
  if(previous&&courtField?.value===previous.value&&digits(cnjField.value)!==previous.cnj)courtField.value='';
  const result=inferCnjJurisdiction(cnjField.value);
  if(result?.court&&courtField&&!courtField.value){
    courtField.value=result.court;
    autoFilledCourt.set(form,{cnj:digits(cnjField.value),value:result.court});
  }else if(previous&&courtField?.value!==previous.value){
    autoFilledCourt.delete(form);
  }
  render(form,result,courtField);
  return result;
}
