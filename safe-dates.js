// Texto de data: entrada nunca e devolvida como markup ou fallback bruto.
export function safeDateLabel(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value))return 'Sem data';
 const day=value.slice(0,10),d=new Date(day+'T12:00:00Z');
 if(!Number.isFinite(d.valueOf())||d.toISOString().slice(0,10)!==day)return 'Sem data';
 return day.slice(8)+'/'+day.slice(5,7)+'/'+day.slice(0,4);
}
export function validStoredDate(value){
 return typeof value==='string'&&value.length<=40&&/^\d{4}-\d{2}-\d{2}(?:$|T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})?$)/.test(value)&&safeDateLabel(value)!=='Sem data'&&Number.isFinite(Date.parse(value));
}
