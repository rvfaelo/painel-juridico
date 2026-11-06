// Reutiliza as mesmas regras do painel. Entrada/saída JSON via pipes, sem rede.
import {saveEntity,deleteCases,validateBackup,now} from '../core.js';
let input='';for await(const chunk of process.stdin)input+=chunk;
try{
  const {state,command}=JSON.parse(input);
  let result=null;
  if(command){
    const {action,id,fields={}}=command;
    if(action==='create'||action==='edit'){
      if(!fields||typeof fields!=='object'||Array.isArray(fields))throw Error('Campos inválidos.');
      const old=action==='edit'?state.cases.find(c=>c.id===id):null;
      if(action==='edit'&&!old)throw Error('Processo não encontrado.');
      result=saveEntity(state,'cases',{...old,...fields,id:old?.id});
    }else if(action==='delete'){
      deleteCases(state,[id]);result={id};
    }else if(action==='archive'||action==='unarchive'){
      result=state.cases.find(c=>c.id===id);if(!result)throw Error('Processo não encontrado.');
      result.archived=action==='archive';result.updatedAt=now();
    }else throw Error('Operação desconhecida.');
  }
  validateBackup({format:'pauta-backup',version:2,state});
  const settings=state.settings;
  if(typeof settings.autoUpdateEnabled!=='boolean'||typeof settings.autoUpdateTimes!=='string'||
      !/^(?:[01]\d|2[0-3]):[0-5]\d(?:,(?:[01]\d|2[0-3]):[0-5]\d){0,5}$/.test(settings.autoUpdateTimes))throw Error('Agendamento inválido.');
  if(typeof settings.datajudKey!=='string'||settings.datajudKey.length>256)throw Error('Chave pública inválida.');
  if(typeof settings.oab!=='string'||settings.oab&&!/^\d{1,8}[A-Za-z]?$/.test(settings.oab)||
     typeof settings.ufOab!=='string'||settings.ufOab&&!/^[A-Z]{2}$/.test(settings.ufOab))throw Error('OAB/UF inválida.');
  process.stdout.write(JSON.stringify({state,result}));
}catch(error){process.stdout.write(JSON.stringify({error:error.message}));process.exitCode=1;}
