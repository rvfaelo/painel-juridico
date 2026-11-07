// Máquinas de estado explícitas do Painel H.B.
// Sem DOM, rede ou persistência: vocabulário, transições e invariantes
// compartilhados pelo núcleo, executor, views e testes de contrato.

export const STAGES = Object.freeze({todo:'A fazer',doing:'Fazendo',ready:'Pronto para protocolar',done:'Concluído'});
export const WORK_STATUSES = Object.freeze({todo:'A fazer',doing:'Fazendo',ready:'Pronto para protocolar',done:'Feito'});
export const WORK_OWNERS = Object.freeze({me:'Comigo',court:'Com o juízo',other:'Parte contrária',client:'Com o cliente'});
export const CASE_STAGES = STAGES;
export const TASK_STAGES = STAGES;

export function assertCaseStage(stage) {
  if (!Object.hasOwn(STAGES, stage)) throw Error('Etapa inválida.');
  return stage;
}
export function assertTaskStage(stage) {
  if (!Object.hasOwn(STAGES, stage)) throw Error('Informe tarefa e etapa válidas.');
  return stage;
}
export function assertCaseNotArchived(c) {
  if (c?.archived) throw Error('Desarquive o processo para editar o acompanhamento.');
  return c;
}
export function setCaseStage(c, stage) {
  assertCaseStage(stage);
  c.stage = stage;
  return c;
}
export function setCaseArchived(c, archived) {
  c.archived = !!archived;
  return c;
}
export function workOwnerOf(c) {
  return Object.hasOwn(WORK_OWNERS, c?.workOwner) ? c.workOwner : 'me';
}
export function workStatusOf(c) {
  return Object.hasOwn(WORK_STATUSES, c?.workStatus) ? c.workStatus : 'todo';
}

// Tarefas: concluir guarda a etapa anterior; reabrir restaura em vez de voltar
// sempre para "A fazer".
export function previousTaskStage(task) {
  if (task?.stage !== 'done') return Object.hasOwn(STAGES, task?.stage) ? task.stage : 'todo';
  return Object.hasOwn(STAGES, task.previousStage) && task.previousStage !== 'done' ? task.previousStage : 'todo';
}
export function setTaskStage(task, stage, {previousStage} = {}) {
  assertTaskStage(stage);
  if (stage === 'done') {
    const before = previousStage !== undefined ? previousStage : task?.stage;
    task.previousStage = Object.hasOwn(STAGES, before) && before !== 'done' ? before : 'todo';
  } else {
    delete task.previousStage;
  }
  task.stage = stage;
  return task;
}
export function toggleTaskDone(task) {
  if (!task) return task;
  if (task.stage === 'done') {
    task.stage = previousTaskStage(task);
    delete task.previousStage;
  } else {
    setTaskStage(task, 'done');
  }
  return task;
}

// Pendências: done e completedAt formam um único invariante.
export function createPendingItem({id, title, createdAt}) {
  return {id, title, done: false, createdAt, completedAt: ''};
}
export function setPendingDone(item, done, timestamp = '') {
  if (!item) throw Error('Pendência não encontrada neste processo.');
  if (done && !timestamp) throw Error('Pendência concluída exige data de conclusão.');
  item.done = !!done;
  item.completedAt = done ? timestamp : '';
  return item;
}
export function pendingIsConsistent(item) {
  return !!item && typeof item.done === 'boolean' && item.done === !!item.completedAt;
}

// Eventos: a linha de base remota não conta como novidade nem pede conferência.
export function isBaselineEvent(event) {
  return !!(event?.remote && !event.is_new && !event.seen && !event.localIds?.length);
}
export function notificationState(event) {
  if (event?.publicationStatus === 'Cancelada') return 'cancelled';
  if (isBaselineEvent(event)) return 'baseline';
  return event?.seen ? 'seen' : 'new';
}

// Fila de consultas no navegador. Os estados do serviço Python são aceitos na
// restauração de backup, mas não são dirigidos pelo executor local.
export const JOB_STATES = Object.freeze(['queued','running','success','not_found','error','action','cancelled','interrupted']);
export const SERVICE_JOB_STATES = Object.freeze(['partial','auth_required','access_denied','unavailable','unsupported','incompatible']);
export const ALL_JOB_STATES = Object.freeze([...JOB_STATES, ...SERVICE_JOB_STATES]);
export const JOB_ACTIVE_STATES = Object.freeze(['queued','running']);
export const JOB_RESULT_STATES = Object.freeze(['success','not_found','action','error','interrupted']);
export const JOB_FAILURE_STATES = Object.freeze(['action','error','interrupted']);
export const JOB_TRANSITIONS = Object.freeze({
  queued: Object.freeze(['running','cancelled','interrupted']),
  running: Object.freeze(['queued','success','not_found','error','action','cancelled','interrupted']),
  success: Object.freeze([]),
  not_found: Object.freeze([]),
  error: Object.freeze([]),
  action: Object.freeze([]),
  cancelled: Object.freeze([]),
  interrupted: Object.freeze(['queued'])
});
export const JOB_STATUS_LABELS = Object.freeze({
  queued:'Na fila',running:'Consultando',success:'Concluído',not_found:'Não localizado',
  error:'Falhou',action:'Requer ação',cancelled:'Cancelado',interrupted:'Interrompido',
  partial:'Resultado parcial',auth_required:'Autenticação necessária',access_denied:'Acesso negado',
  unavailable:'Fonte indisponível',unsupported:'Não disponível',incompatible:'Resposta incompatível'
});
export function canTransitionJob(from, to) {
  return ALL_JOB_STATES.includes(from) && ALL_JOB_STATES.includes(to) &&
    (from === to || (JOB_TRANSITIONS[from] || []).includes(to));
}
export function transitionJob(job, status, patch = {}) {
  if (!job || typeof job !== 'object') throw Error('Consulta inválida.');
  if (!ALL_JOB_STATES.includes(status)) throw Error('Estado de consulta inválido.');
  const from = job.status ?? 'queued';
  if (!ALL_JOB_STATES.includes(from)) throw Error('Estado atual da consulta inválido.');
  if (!canTransitionJob(from, status)) throw Error(`Transição de consulta inválida: ${from} → ${status}.`);
  Object.assign(job, patch, {status});
  return job;
}
