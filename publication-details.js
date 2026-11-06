const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function rawDjenDetails(item={}){
  const d={},text=x=>typeof x==='string'||typeof x==='number'?String(x).trim().slice(0,240):'';
  for(const [field,key] of Object.entries({tribunal:'siglaTribunal',orgao:'nomeOrgao',classe:'nomeClasse',tipoComunicacao:'tipoComunicacao',tipoDocumento:'tipoDocumento',meio:'meio',numeroComunicacao:'numeroComunicacao'}))if(key in item)d[field]=text(item[key]);
  if('ativo' in item)d.ativo=item.ativo!==false;
  if(Array.isArray(item.destinatarios))d.destinatarios=item.destinatarios.filter(x=>x&&typeof x==='object').map(x=>({nome:text(x.nome),polo:text(x.polo)}));
  if(Array.isArray(item.destinatarioadvogados))d.advogados=item.destinatarioadvogados.filter(x=>x&&typeof x==='object').map(x=>{
    const a=x.advogado&&typeof x.advogado==='object'?x.advogado:x;
    return {nome:text(a.nome),numeroOab:text(a.numero_oab),ufOab:text(a.uf_oab).slice(0,2)};
  });
  if(d.destinatarios)d.destinatarios.sort((a,b)=>(a.nome+'|'+a.polo).localeCompare(b.nome+'|'+b.polo));
  if(d.advogados)d.advogados.sort((a,b)=>(a.nome+'|'+a.numeroOab+'|'+a.ufOab).localeCompare(b.nome+'|'+b.numeroOab+'|'+b.ufOab));
  return d;
}

export function publicationDetails(event={}){
  let value=event.publicationDetails??event.publication_details??{};
  if(typeof value==='string'){try{value=JSON.parse(value);}catch{return {};}}
  return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
}

export function publicationDetailsHTML(event={}){
  const d=publicationDetails(event);
  const text=value=>typeof value==='string'||typeof value==='number'?String(value):'';
  const fields=[['Tribunal',d.tribunal],['Órgão da publicação',d.orgao],['Classe na publicação',d.classe],
    ['Comunicação',d.tipoComunicacao],['Documento publicado',d.tipoDocumento],['Número da comunicação',d.numeroComunicacao]];
  const rows=fields.filter(([,v])=>text(v)).map(([k,v])=>`<p class="compact"><strong>${k}:</strong> ${esc(text(v))}</p>`);
  if(d.ativo===false)rows.push('<p class="warning-note">Publicação cancelada na fonte.</p>');
  const recipients=Array.isArray(d.destinatarios)?d.destinatarios:[];
  const lawyers=Array.isArray(d.advogados)?d.advogados:[];
  const poles={A:'Polo ativo',P:'Polo passivo',T:'Terceiro'};
  if(recipients.length)rows.push('<div><strong>Destinatários da publicação</strong><ul>'+recipients.filter(x=>x&&text(x.nome)).map(x=>`<li>${esc(text(x.nome))}${text(x.polo)?' · '+esc(poles[x.polo]||text(x.polo)):''}</li>`).join('')+'</ul></div>');
  if(lawyers.length)rows.push('<div><strong>Advogados destinatários</strong><ul>'+lawyers.filter(x=>x&&(text(x.nome)||text(x.numeroOab))).map(x=>`<li>${esc(text(x.nome))}${text(x.numeroOab)?' · OAB '+esc(text(x.ufOab))+' '+esc(text(x.numeroOab)):''}</li>`).join('')+'</ul></div>');
  if(!rows.length)return '<p class="muted compact">Dados dos destinatários ainda não disponíveis neste registro. Consulte o DJEN para atualizar.</p>';
  return '<details class="publication-metadata"><summary>Dados e destinatários da publicação</summary><div class="private">'+rows.join('')+'</div></details>';
}
