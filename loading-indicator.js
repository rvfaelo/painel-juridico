// Indicador de atividade: nao representa percentual ou confirma progresso remoto.
export function isWaitingMessage(value){
  return /^(?:Consultando|Buscando|Lendo|Carregando|Verificando|Preparando|Gerando|Salvando|Processando|Atualizando|Criptografando|Restaurando|Aguardando resposta)\b/iu.test(String(value||'').trim());
}

export function installLoadingIndicators(root=document.body){
  const selector='[role="status"],p,button';
  function update(node){
    if(!node?.matches?.(selector))return;
    const waiting=isWaitingMessage(node.textContent);
    if(waiting){node.setAttribute('data-loading','true');node.setAttribute('aria-busy','true');}
    else if(node.dataset.loading==='true'&&!node.hasAttribute('data-loading-fixed')){
      node.removeAttribute('data-loading');node.removeAttribute('aria-busy');
    }
  }
  function scan(node){if(node?.nodeType===1){update(node);node.querySelectorAll(selector).forEach(update);}}
  scan(root);
  const observer=new MutationObserver(records=>{
    for(const record of records){
      update(record.target.nodeType===1?record.target:record.target.parentElement);
      record.addedNodes.forEach(scan);
    }
  });
  observer.observe(root,{subtree:true,childList:true,characterData:true});
  return ()=>observer.disconnect();
}
