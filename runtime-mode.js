// Apenas o servico local em loopback pode ativar o modo integrado.
export function isIntegratedRuntime(){
  const loc=globalThis.location;
  return !!loc && loc.protocol==='http:' && loc.hostname==='127.0.0.1';
}
