import {digits,validCnj,tribunalAlias,dateKey} from './core.js';
import {rawDjenDetails} from './publication-details.js';
export class SourceError extends Error {
  constructor(message,{action=false,retryable=false,retryAfter=0}={}){super(message);Object.assign(this,{action,retryable,retryAfter});}
}
export async function requestJSON(url,options={},fetcher=fetch) {
  const isDatajud=String(url).startsWith('https://api-publica.datajud.cnj.jus.br/');
  if(isDatajud)throw new SourceError('DataJud usa o cliente MCP no painel integrado. Abra ABRIR-PAINEL-INTEGRADO.cmd.',{action:true});
  const timeoutMs=isDatajud?45000:18000;
  let response;
  try{response=await fetcher(url,{...options,signal:AbortSignal.timeout(timeoutMs)});}
  catch(error){
    const timeout=error?.name==='TimeoutError'||error?.name==='AbortError';
    throw new SourceError(timeout
      ?`Tempo de espera esgotado (${timeoutMs/1000} s). A fonte pode estar lenta ou bloqueando a conexão.`
      :'Falha de conexão. Se o painel foi aberto por arquivo local, o navegador pode ter bloqueado a consulta por CORS (a resposta existe, mas não pode ser lida). Verifique a internet; no DataJud, esse bloqueio é esperado sem um intermediário local.',{retryable:!isDatajud});
  }
  if(!response.ok) {
    const seconds=Number(response.headers.get('retry-after'));
    const delay=Number.isFinite(seconds)&&seconds>0?seconds*1000:Math.max(0,Date.parse(response.headers.get('retry-after'))-Date.now())||0;
    const message=response.status===401?'Autenticação recusada. Confira a chave pública.'
      :response.status===403?'A fonte recusou o acesso (HTTP 403). Pode ser bloqueio de CORS, restrição da API ou necessidade de configuração adicional.'
      :response.status===429?'A fonte limitou as consultas (HTTP 429). Aguarde alguns minutos ou reduza a frequência antes de tentar novamente.'
      :response.status>=500?`A fonte está temporariamente indisponível (HTTP ${response.status}). Tente novamente mais tarde.`
      :`Fonte respondeu HTTP ${response.status}.`;
    throw new SourceError(message,{action:[401,403].includes(response.status),retryable:response.status===429||(response.status>=500&&!(isDatajud&&response.status===504)),retryAfter:delay});
  }
  let data;try{data=await response.json();}catch{throw new SourceError('A fonte não retornou JSON válido. A resposta pode ser uma página de bloqueio ou uma restrição de CORS.');}
  if(!data||typeof data!=='object')throw new SourceError('Formato de resposta desconhecido.');
  return data;
}
export function plain(value) {
  return String(value??'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
}
export function parseDatajud(data,cnj,page=0) {
  if(data.timed_out||data._shards?.failed>0)throw new SourceError('DataJud retornou busca incompleta (timeout interno ou falha de shards).',{retryable:true,retryAfter:10000});
  const hits=data.hits?.hits,rawTotal=data.hits?.total;
  if(!Array.isArray(hits)||rawTotal===undefined)throw new SourceError('Estrutura DataJud desconhecida; consulta não validada.');
  const total=typeof rawTotal==='number'?rawTotal:rawTotal.value;
  if(!Number.isInteger(total)||total<0||rawTotal?.relation==='gte')throw new SourceError('Total DataJud incompleto; consulta precisa de revisão.');
  if(total>10000)throw new SourceError('Resultado excedeu o limite de paginação implementado.');
  if(hits.length>100||hits.length===0&&total>page*100||hits.length>0&&hits.length<100&&page*100+hits.length<total)throw new SourceError('A fonte retornou uma página incompleta.');
  const events=[],snapshots=[];
  for(const hit of hits) {
    const s=hit._source;
    if(!s||digits(s.numeroProcesso)!==digits(cnj)||!hit._id||!Array.isArray(s.movimentos))throw new SourceError('Resposta DataJud sem identificadores ou movimentos válidos.');
    snapshots.push({id:hit._id,tribunal:s.tribunal||'',grade:s.grau||'',class:s.classe?.nome||'',body:s.orgaoJulgador?.nome||'',sourceUpdatedAt:s.dataHoraUltimaAtualizacao||s['@timestamp']||''});
    for(const m of s.movimentos) {
      if(!m.dataHora||(!m.nome&&!m.codigo))throw new SourceError('Movimento sem data ou identificação.');
      const complement=(m.complementosTabelados||[]).map(x=>[x.nome,x.descricao,x.valor].filter(Boolean).join(': ')).join(' · ');
      const text=[m.nome||`Movimento ${m.codigo}`,complement].filter(Boolean).join(' — ');
      const key=JSON.stringify([m.dataHora,m.codigo||'',text]);
      events.push({id:`datajud:${hit._id}:${key}`,source:'datajud',kind:'movement',cnj:digits(cnj),date:m.dataHora,text,tribunal:s.tribunal||'',grade:s.grau||'',sourceUpdatedAt:s.dataHoraUltimaAtualizacao||'',url:''});
    }
  }
  const hasNext=(page*100+hits.length)<total;
  return {events,snapshots,count:hits.length,nextCursor:hasNext?page+1:null,notFound:total===0,sourceUpdatedAt:snapshots.map(x=>x.sourceUpdatedAt).filter(Boolean).sort().at(-1)||''};
}
export function parseDjen(data,page=1) {
  if(!Array.isArray(data.items)||!Number.isInteger(data.count)||data.count<0)throw new SourceError('Estrutura DJEN desconhecida; consulta não validada.');
  if(data.count>=10000)throw new SourceError('A busca atingiu 10.000 resultados. Reduza o período para evitar um histórico incompleto.',{action:true});
  if(data.items.length>100||data.items.length===0&&data.count>(page-1)*100||data.items.length>0&&data.items.length<100&&(page-1)*100+data.items.length<data.count)throw new SourceError('Página DJEN incompleta.');
  const events=data.items.map(item=>{
    if(!item.id||!item.numero_processo||!item.data_disponibilizacao||typeof item.texto!=='string')throw new SourceError('Publicação sem identificador, processo, data ou texto.');
    return {publicationDetails:rawDjenDetails(item),id:'djen:'+item.id,source:'djen',kind:'publication',cnj:digits(item.numero_processo),date:item.data_disponibilizacao,text:plain(item.texto),tribunal:item.siglaTribunal||'',body:item.nomeOrgao||'',url:item.link&&/^https:\/\//i.test(item.link)?item.link:'',certificateHash:typeof item.hash==='string'&&/^[A-Za-z0-9_-]{16,128}$/.test(item.hash)?item.hash:'',publicationStatus:item.ativo===false?'Cancelada':item.status||'',sourceUpdatedAt:''};
  });
  return {events,count:data.items.length,nextCursor:((page-1)*100+data.items.length)<data.count?page+1:null,notFound:data.count===0};
}
export async function datajud(job,settings,fetcher=fetch) {
  if(!validCnj(job.cnj))throw new SourceError('CNJ inválido.',{action:true});
  const alias=tribunalAlias(job.cnj);
  if(!alias)throw new SourceError('Tribunal fora do catálogo DataJud desta versão.',{action:true});
  const key=String(settings.datajudKey||'').replace(/^APIKey\s+/i,'').trim();
  if(!key)throw new SourceError('Configure a chave pública DataJud em Fontes e ajustes.',{action:true});
  throw new SourceError('DataJud usa o cliente MCP no painel integrado. Abra ABRIR-PAINEL-INTEGRADO.cmd.',{action:true});
}
export async function djen(job,settings,fetcher=fetch) {
  const page=job.cursor??1;
  const end=job.periodEnd||dateKey(),start=job.periodStart||dateKey(new Date(Date.now()-(Math.min(365,Math.max(1,Number(settings.djenDays)||30))-1)*86400000));
  const params=new URLSearchParams({pagina:String(page),itensPorPagina:'100',dataDisponibilizacaoInicio:start,dataDisponibilizacaoFim:end});
  if(job.cnj)params.set('numeroProcesso',digits(job.cnj));
  else if(job.oab&&job.ufOab){params.set('numeroOab',job.oab);params.set('ufOab',job.ufOab);}
  else throw new SourceError('Informe processo ou OAB/UF.',{action:true});
  const response=await requestJSON('https://comunicaapi.pje.jus.br/api/v1/comunicacao?'+params,{},fetcher);
  const parsed=parseDjen(response,page);
  if(job.cnj&&parsed.events.some(x=>x.cnj!==digits(job.cnj)))throw new SourceError('A fonte retornou publicações de outro processo.');
  return {...parsed,periodStart:start,periodEnd:end};
}
