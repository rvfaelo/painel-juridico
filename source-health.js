import {dateKey,validCnj,now} from './core.js';
import {datajud,djen,SourceError} from './sources.js';

// Valid CNJ checksum, deliberately fictitious year 2099 and case number.
// The diagnostic never sends a client's CNJ, OAB, name or publication text.
const base='9999999'+'2099'+'8'+'19'+'9999';
export const DIAGNOSTIC_CNJ=base.slice(0,7)+String(98n-BigInt(base+'00')%97n).padStart(2,'0')+base.slice(7);

const MESSAGE={
  reachable:'A fonte respondeu com JSON no formato esperado para a consulta sintética.',
  limited:'A fonte aplicou um limite HTTP 429 nesta tentativa.',
  blocked:'O acesso foi recusado (HTTP 401/403). Verifique a fonte e a configuração.',
  unavailable:'Não foi possível validar uma resposta completa nesta tentativa. No modo arquivo local, o bloqueio de CORS (especialmente no DataJud) é uma causa provável.',
  configuration:'Não há chave pública DataJud configurada.'
};
export async function checkSourceConnectivity(settings,fetcher,clock=new Date()){
  if(!validCnj(DIAGNOSTIC_CNJ))throw Error('CNJ sintético de diagnóstico inválido.');
  if(typeof fetcher!=='function')throw Error('Transporte das fontes indisponível.');
  const day=dateKey(clock),job={cnj:DIAGNOSTIC_CNJ,periodStart:day,periodEnd:day,cursor:null};
  const check=async(source)=>{
    if(source==='datajud'&&!String(settings.datajudKey||'').trim())return {source,status:'configuration',message:MESSAGE.configuration};
    try{
      if(source==='djen')await djen(job,settings,fetcher);
      else await datajud(job,settings,fetcher);
      return {source,status:'reachable',message:MESSAGE.reachable};
    }catch(error){
      let status='unavailable';
      if(error instanceof SourceError){
        if(/cliente MCP/.test(error.message))return {source,status:'configuration',message:error.message};
        if(/\bHTTP 429\b/.test(error.message))status='limited';
        else if(/HTTP 403|Autenticação recusada|HTTP 401/.test(error.message))status='blocked';
      }
      return {source,status,message:MESSAGE[status]};
    }
  };
  const results=await Promise.all(['djen','datajud'].map(check));
  return {testedAt:now(),scope:'CNJ sintético; conectividade e formato apenas',results};
}
