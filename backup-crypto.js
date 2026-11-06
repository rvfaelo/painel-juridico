const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const ITERATIONS=310000;
const additionalData=encoder.encode('Pauta encrypted backup v1');
export function toBase64(bytes){let out='';for(let i=0;i<bytes.length;i+=24576)out+=String.fromCharCode(...bytes.subarray(i,i+24576));return btoa(out);}
export function fromBase64(value,max=64*1024*1024){if(typeof value!=='string'||value.length>Math.ceil(max/3)*4||value.length%4||/[^A-Za-z0-9+/=]/.test(value)||/=.+[^=]/.test(value))throw Error('Dados codificados inválidos.');let raw;try{raw=atob(value);}catch{throw Error('Dados codificados inválidos.');}if(raw.length>max)throw Error('Backup excede o limite.');return Uint8Array.from(raw,c=>c.charCodeAt(0));}
async function keyFor(password,salt,iterations=ITERATIONS){const base=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
export async function encryptBackup(payload,password){
  if(typeof password!=='string'||password.length<10||password.length>1024)throw Error('Use uma senha de 10 a 1024 caracteres.');
  const bytes=encoder.encode(JSON.stringify(payload));if(bytes.length>48*1024*1024)throw Error('Conteúdo excede 48 MB. Exporte menos anexos.');
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await keyFor(password,salt);
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData,tagLength:128},key,bytes);
  return {format:'pauta-encrypted-backup',version:1,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,cipher:'AES-256-GCM',salt:toBase64(salt),iv:toBase64(iv),data:toBase64(new Uint8Array(encrypted))};
}
export async function decryptBackup(payload,password){
  if(payload?.format!=='pauta-encrypted-backup'||payload.version!==1||payload.kdf!=='PBKDF2-SHA256'||!Number.isInteger(payload.iterations)||payload.iterations<100000||payload.iterations>1000000||payload.cipher!=='AES-256-GCM')throw Error('Formato criptografado não suportado.');
  if(typeof password!=='string'||password.length>1024)throw Error('Senha inválida.');
  const salt=fromBase64(payload.salt,16),iv=fromBase64(payload.iv,12),data=fromBase64(payload.data,48*1024*1024+16);
  if(salt.length!==16||iv.length!==12||data.length<16)throw Error('Backup criptografado inválido.');
  try{const key=await keyFor(password,salt,payload.iterations),plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData,tagLength:128},key,data);return JSON.parse(decoder.decode(plain));}
  catch{throw Error('Senha incorreta ou arquivo alterado/corrompido.');}
}
