// Transporte direto das fontes públicas no próprio navegador.
// Não há helper nativo nem servidor: a consulta depende do CORS de cada API.
export function transport(url, options = {}) {
  return fetch(url, {
    ...options,
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store'
  });
}
