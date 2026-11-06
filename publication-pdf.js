// Geração local de PDF pesquisável (A4, fontes padrão do PDF). Nenhum dado é
// enviado a terceiros. Trata-se de cópia do texto recebido, não de peça oficial.
const ZONE='America/Sao_Paulo';
const validDay=value=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+'T12:00:00Z');
  return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===value;
};
export function publicationDateBR(value){
  const input=String(value??'').trim(),day=input.slice(0,10);
  if(!validDay(day))return 'Sem data';
  if(/^\d{4}-\d\d-\d\d$/.test(input)||!/(Z|[+-]\d\d:\d\d)$/i.test(input))return day.slice(8)+'/'+day.slice(5,7)+'/'+day.slice(0,4);
  const d=new Date(input);
  return Number.isNaN(d.valueOf())?'Sem data':new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:ZONE}).format(d);
}
export function safePublicationUrl(value){
  if(typeof value!=='string'||value.length>2048||/[\x00-\x20]/.test(value))return '';
  try{const url=new URL(value);return url.protocol==='https:'&&url.hostname&&!url.username&&!url.password?url.href:'';}catch{return '';}
}
export function djenCertificateUrl(value){
  if(typeof value!=='string'||! /^[A-Za-z0-9_-]{16,128}$/.test(value))return '';
  return 'https://comunicaapi.pje.jus.br/api/v1/comunicacao/'+value+'/certidao';
}
export function officialCertificateFilename(item){
  return publicationPdfFilename(item).replace(/^Painel-HB-publicacao-/, 'CNJ-certidao-publicacao-');
}
export function downloadPdfBlob(blob,filename){
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=filename;
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}
export async function fetchOfficialCertificate(item,{integrated=false,fetcher=fetch}={}){
  const hash=item?.certificateHash??item?.certificate_hash;
  const official=djenCertificateUrl(hash);
  if(!official)throw Error('A publicação não possui código de certidão. Atualize a consulta DJEN.');
  const localId=String(item.id??'');
  if(integrated&&!/^djen:[A-Za-z0-9:_.-]{1,120}$/.test(localId))throw Error('Identificador da publicação inválido.');
  const target=integrated?'/api/v1/publications/'+encodeURIComponent(localId)+'/certidao':official;
  let response;
  try{response=await fetcher(target,{cache:'no-store',signal:AbortSignal.timeout(18000),...(integrated?{credentials:'same-origin'}:{})});}
  catch(error){throw Error(error?.name==='TimeoutError'?'Tempo esgotado ao baixar certidão no CNJ.':'Não foi possível baixar a certidão. No HTML direto, o navegador pode bloquear a leitura por CORS; use “Abrir certidão no CNJ”.');}
  if(!response.ok){
    let message='';
    if(integrated)try{message=(await response.json()).error||'';}catch{}
    throw Error(message||'Certidão indisponível no CNJ (HTTP '+response.status+').');
  }
  const limit=8_000_000;
  if(Number(response.headers?.get('content-length')||0)>limit)throw Error('A certidão excede o limite de 8 MB.');
  let data;
  if(response.body?.getReader){
    const reader=response.body.getReader(),chunks=[];let size=0;
    try{
      while(true){
        const {done,value}=await reader.read();if(done)break;
        size+=value.byteLength;
        if(size>limit)throw Error('A certidão excede o limite de 8 MB.');
        chunks.push(value);
      }
    }catch(error){await reader.cancel().catch(()=>{});throw error;}
    data=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}
  }else data=new Uint8Array(await response.arrayBuffer());
  if(data.length>limit||data.length<8||new TextDecoder('ascii').decode(data.slice(0,5))!=='%PDF-')throw Error('A fonte não retornou um PDF válido; nenhum arquivo foi salvo.');
  return new Blob([data],{type:'application/pdf'});
}
export async function downloadOfficialCertificate(item,options={}){
  const blob=await fetchOfficialCertificate(item,options);
  downloadPdfBlob(blob,officialCertificateFilename(item));
}
export function publicationPdfFilename(item){
  const date=String(item.date??item.occurred_at??'').slice(0,10);
  const cnj=String(item.cnj??'').replace(/\D/g,'').slice(0,20)||'sem-cnj';
  const suffix=String(item.id??'').replace(/[^a-zA-Z0-9_-]/g,'-').slice(-45)||'registro';
  return `Painel-HB-publicacao-${cnj}-${validDay(date)?date:'sem-data'}-${suffix}.pdf`;
}
// WinAnsi é suportado nativamente pelas fontes padrão do PDF: mantém acentos
// em português e permite seleção e busca pelo texto em leitores PDF comuns.
const remap={'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};
const cleanText=value=>String(value??'').replace(/\r\n?/g,'\n').replace(/[\t\f\v]/g,' ');
function winAnsi(value){
  let out='';
  for(const c of cleanText(value)){
    const n=c.codePointAt(0),v=remap[c]??(n>=32&&n<=126||n>=160&&n<=255?n:63);
    out+=String.fromCharCode(v);
  }
  return out;
}
const literal=value=>winAnsi(value).replace(/[\\()]/g,'\\$&');
function wrap(value,max=82){
  const lines=[];
  for(const paragraph of cleanText(value).split('\n')){
    if(!paragraph.trim()){lines.push('');continue;}
    let line='';
    for(const word of paragraph.trim().split(/\s+/)){
      if(line&&line.length+1+word.length>max){lines.push(line);line='';}
      if(word.length>max){if(line){lines.push(line);line='';}for(let i=0;i<word.length-max;i+=max)lines.push(word.slice(i,i+max));line=word.slice(Math.max(0,word.length-word.length%max));if(!line)line=word.slice(-max);}
      else line+=(line?' ':'')+word;
    }
    lines.push(line);
  }
  return lines;
}
function bytes(text){const output=new Uint8Array(text.length);for(let i=0;i<text.length;i++)output[i]=text.charCodeAt(i)&255;return output;}
export function publicationPdfBlob(item){
  if(!item||typeof item!=='object')throw Error('Publicação inválida para exportação.');
  const fields=[`Processo: ${item.cnj||'Não informado'}`,`Data: ${publicationDateBR(item.date??item.occurred_at)}`,`Fonte: ${item.tribunal||item.source||'Não informada'}`];
  const url=safePublicationUrl(item.url);
  if(url)fields.push('Link da fonte: '+url);
  const lines=[...fields.flatMap(x=>wrap(x)), '', ...wrap(item.text||'Conteúdo não informado.'), '',...wrap('Cópia local gerada pelo Painel H.B. Confira o texto e as informações no portal oficial; este PDF não substitui a publicação original.')];
  const perPage=42,pages=[];
  for(let i=0;i<lines.length;i+=perPage)pages.push(lines.slice(i,i+perPage));
  if(!pages.length)pages.push([]);
  const objects=[null],add=v=>(objects.push(v),objects.length-1);
  const fontRegular=add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
  const fontTitle=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pagesId=add('');
  const pageIds=[];
  pages.forEach((lines,index)=>{
    let stream='0.16 0.32 0.23 rg\nBT /F2 17 Tf 45 788 Td ('+literal('Publicação judicial · Painel H.B')+') Tj ET\n';
    stream+='0.75 0.82 0.72 RG 45 774 m 550 774 l S\n';
    lines.forEach((line,i)=>{
      stream+='0.16 0.20 0.17 rg\nBT /F1 10 Tf 45 '+(743-i*15)+' Td ('+literal(line)+') Tj ET\n';
    });
    stream+='0.48 0.52 0.47 rg\nBT /F1 9 Tf 45 39 Td ('+literal('Painel H.B · cópia não oficial · página '+(index+1)+' de '+pages.length)+') Tj ET\n';
    const contentId=add('<< /Length '+bytes(stream).length+' >>\nstream\n'+stream+'endstream');
    pageIds.push(add('<< /Type /Page /Parent '+pagesId+' 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 '+fontRegular+' 0 R /F2 '+fontTitle+' 0 R >> >> /Contents '+contentId+' 0 R >>'));
  });
  objects[pagesId]='<< /Type /Pages /Kids ['+pageIds.map(n=>n+' 0 R').join(' ')+'] /Count '+pageIds.length+' >>';
  const catalogId=add('<< /Type /Catalog /Pages '+pagesId+' 0 R >>');
  let output='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';const offsets=[0];
  for(let i=1;i<objects.length;i++){offsets[i]=bytes(output).length;output+=i+' 0 obj\n'+objects[i]+'\nendobj\n';}
  const xref=bytes(output).length;
  output+='xref\n0 '+objects.length+'\n0000000000 65535 f \n';
  for(let i=1;i<objects.length;i++)output+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  output+='trailer\n<< /Size '+objects.length+' /Root '+catalogId+' 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
  return new Blob([bytes(output)],{type:'application/pdf'});
}
export function downloadPublicationPdf(item){
  downloadPdfBlob(publicationPdfBlob(item),publicationPdfFilename(item));
}
