// Ponte estritamente same-origin para o servico Python local. Nenhuma consulta
// automatica acontece em file:// e nenhum HTML executa Python diretamente.
import {VERSION} from './core.js';
import {hasRemoteWorkspace} from './workspace-api.js';
import {isIntegratedRuntime} from './runtime-mode.js';
export const integrated = isIntegratedRuntime();
export const CONTRACT = 1;
let csrf = '', lastRevision = -1;
export let serviceOnline = false;
export let serviceDashboard = {jobs: [], counts: {}, unseen: 0, recentUnseen: []};
export let serviceSettings = null;
export let serviceConnectors = [];
export let serviceError = 'Inicie o serviço com ABRIR-PAINEL-INTEGRADO.cmd.';
export let serviceSyncWarning = '';

export async function apiGet(route) {
  if (!integrated) throw Error('Serviço não conectado. Abra o Painel H.B pelo iniciador integrado.');
  const response = await fetch('/api/v1/' + route, {cache: 'no-store', credentials: 'same-origin'});
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'Serviço indisponível.');
  if (data.contractVersion !== undefined && data.contractVersion !== CONTRACT)
    throw Error('Versões incompatíveis: atualize o HTML e o serviço juntos.');
  return data;
}

export async function apiPost(route, payload = {}) {
  if (!csrf) throw Error('Sessão local indisponível. Recarregue o painel integrado.');
  const response = await fetch('/api/v1/' + route, {
    method: 'POST', cache: 'no-store', credentials: 'same-origin',
    headers: {'Content-Type': 'application/json', 'X-Pauta-CSRF': csrf},
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'Operação não concluída.');
  return data;
}

export async function updateExtraConnectors(enabled) {
  const response = await apiPost('settings', {enabled});
  serviceSettings = response.settings;
  return response.settings;
}

const fields = s => ({
  enabled: {datajud: !!s.datajud, djen: !!s.djen},
  autoEnabled: !!s.autoUpdateEnabled,
  autoTimes: String(s.autoUpdateTimes || '08:00,18:00').split(',').map(x => x.trim()).filter(Boolean),
  djenDays: s.djenDays, datajudKey: s.datajudKey || '',
  oab: s.oab || '', ufOab: s.ufOab || ''
});

export async function syncBrowser(state, force = false, allowEmpty = false) {
  if (!integrated || !serviceOnline) return;
  if(hasRemoteWorkspace()){serviceSyncWarning='';return;}
  if (!force && lastRevision === state.revision) return;
  const cases = state.cases.map(({id, cnj, archived, court, courtLevel, processSystem}) =>
    ({id, cnj, archived, court, courtLevel, processSystem}));
  const synced = await apiPost('cases/sync', {cases, ...(allowEmpty ? {allowEmpty:true} : {})});
  if(synced.skipped){
    serviceSyncWarning = synced.warning || 'Restaure um backup antes de sincronizar a carteira.';
    lastRevision = state.revision;
    return;
  }
  serviceSyncWarning = '';
  const saved = await apiPost('settings', fields(state.settings));
  serviceSettings = saved.settings;
  lastRevision = state.revision;
}

export async function connect(state) {
  if (!integrated) return false;
  try {
    const session = await apiGet('session');
    if (session.contractVersion !== CONTRACT)
      throw Error('Contrato API incompatível. Atualize o HTML e o serviço juntos.');
    if (session.appVersion !== VERSION)
      throw Error(`Interface v${VERSION} e serviço v${session.appVersion}. Reabra ABRIR-PAINEL-INTEGRADO.cmd para atualizar o serviço e recarregue esta página com Ctrl+F5.`);
    csrf = session.csrf;
    serviceOnline = true;
    await syncBrowser(state, true);
    const [status, connectors, dashboard] = await Promise.all([
      apiGet('status'), apiGet('connectors'), apiGet('dashboard')
    ]);
    serviceSettings = status.settings;
    serviceConnectors = connectors.sources;
    serviceDashboard = dashboard;
    serviceError = '';
    return true;
  } catch (error) {
    serviceOnline = false;
    serviceError = error.message || 'Serviço indisponível.';
    return false;
  }
}

export async function pollService() {
  if (!serviceOnline) return;
  try {
    serviceDashboard = await apiGet('dashboard');
    serviceError = '';
  } catch (error) {
    serviceOnline = false;
    serviceError = error.message || 'Serviço indisponível.';
  }
}

export async function serverCommand(type, extra = {}, browserState) {
  if (!integrated || !serviceOnline) throw Error('Consultas indisponíveis: inicie o serviço Python pelo modo integrado.');
  await syncBrowser(browserState);
  if (type === 'ping') return apiGet('status');
  if (type === 'update') return apiPost('jobs', {ids: extra.ids || [], ...(extra.sources?{sources:extra.sources}:{})});
  if (type === 'oab') return apiPost('jobs', {oab: true});
  if (type === 'retry-source' || type === 'retry-oab')
    return apiPost('jobs/retry', {jobId: extra.jobId});
  if (type === 'cancel') return apiPost('jobs/cancel');
  if (type === 'resume') return {};
  throw Error('Comando não suportado pelo serviço.');
}

export async function exportMonitoring() {
  if (!serviceOnline) throw Error('Serviço desligado: não é possível fazer um backup completo do histórico integrado.');
  return apiGet('backup');
}

export async function restoreMonitoring(monitoring) {
  if (!monitoring) return;
  if (!serviceOnline) throw Error('Abra o modo integrado antes de restaurar dados de monitoramento.');
  await apiPost('restore', {monitoring});
  lastRevision = -1;
}
