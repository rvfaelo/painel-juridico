export const MAX_FILE=5*1024*1024;
export const MAX_TOTAL=25*1024*1024;
export async function sha256(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function validateDocument(bytes,mime){
  if(!(bytes instanceof Uint8Array)||bytes.length===0||bytes.length>MAX_FILE)throw Error('Cada anexo deve ter de 1 byte a 5 MB.');
  const start=[...bytes.subarray(0,12)];const begins=values=>values.every((v,i)=>start[i]===v);
  const valid=(mime==='application/pdf'&&begins([37,80,68,70,45]))||(mime==='image/png'&&begins([137,80,78,71,13,10,26,10]))||(mime==='image/jpeg'&&begins([255,216,255]))||(mime==='image/webp'&&begins([82,73,70,70])&&start.slice(8,12).join(',')==='87,69,66,80');
  if(mime==='text/plain'){try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw Error('Texto deve estar em UTF-8.');}if(bytes.includes(0))throw Error('Arquivo de texto contém conteúdo binário.');return true;}
  if(!valid)throw Error('Anexe PDF, PNG, JPEG, WebP ou texto UTF-8 com formato válido.');return true;
}
