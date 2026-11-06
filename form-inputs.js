// Normalizacao de apresentacao; regras financeiras continuam em core.js.
export function normalizeMoneyInput(value){
  let text=String(value??'').trim().replace(/^R\$\s*/, '');
  if(text.includes(',')){
    if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(text))throw Error('Informe o valor como 1.250,00 ou 1250,00, com até duas casas decimais.');
    text=text.replace(/\./g,'').replace(',','.');
  }
  if(!/^\d+(?:\.\d{1,2})?$/.test(text))throw Error('Informe um valor positivo, por exemplo 125,50.');
  return text;
}
