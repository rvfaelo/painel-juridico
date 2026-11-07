// Normaliza texto para busca: remove acentos e converte para minúsculas.
export const fold = value => String(value ?? '').normalize('NFD')
  .replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR');
