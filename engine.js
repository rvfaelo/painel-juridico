// Executor local da fila de consultas.
// Substitui o antigo background.js/service worker: tudo roda na própria página.
import {readState, mutate} from './db.js';
import {enqueue, enqueueOab, retrySourceJob, retryOabJob, now, VERSION} from './core.js';
import {transitionJob,JOB_ACTIVE_STATES} from './state-machines.js';
import {datajud, djen} from './sources.js';
import {step} from './runner.js';
import {transport} from './transport.js';

const adapters = {
  datajud: (job, settings) => datajud(job, settings, transport),
  djen: (job, settings) => djen(job, settings, transport)
};

const MAX_STEPS = 40;
const AUTO_DEFAULT_TIMES = '08:00,18:00';

let pumping = false;
let scheduled = null;

async function withQueueLock(fn) {
  if (navigator.locks?.request) {
    return navigator.locks.request('pauta-queue-executor', {ifAvailable: true}, lock => {
      if (!lock) {
        // Outra aba está executando a fila. Reavalia em seguida: a fila é
        // persistida, então nenhum trabalho é perdido.
        schedule(2_000);
        return undefined;
      }
      return fn();
    });
  }
  return fn();
}

function schedule(ms) {
  if (scheduled) return;
  scheduled = setTimeout(() => {
    scheduled = null;
    void pump();
  }, Math.max(250, ms));
}

async function drain() {
  if (pumping) return;
  pumping = true;
  try {
    // O runner limita uma página por passo. Este laço conclui a fila sem
    // depender dos antigos alarms de 1 minuto do service worker.
    for (let i = 0; i < MAX_STEPS; i++) {
      const worked = await step({read: readState, mutate, adapters});
      if (!worked) break;
    }
  } catch (error) {
    console.error('Pauta: falha no executor local.', error);
  } finally {
    pumping = false;
  }
  const state = await readState().catch(() => null);
  const pending = state?.jobs?.filter(job => JOB_ACTIVE_STATES.includes(job.status)) || [];
  if (pending.length) {
    // Consultas "running" podem ter ficado de uma aba fechada. O runner só as
    // retoma após o lease expirar, então o temporizador precisa acordar para
    // isso mesmo quando não há nenhuma consulta "queued".
    const target = Math.min(...pending.map(job => job.status === 'running'
      ? (Number(job.leaseUntil) || 0)
      : (Number(job.nextAt) || 0)));
    schedule(Math.max(300, Math.min(15_000, target - Date.now() + 200)));
  }
}

export async function pump() {
  return withQueueLock(drain);
}

// Espelha os comandos que antes eram enviados por chrome.runtime.sendMessage.
export async function handle(type, extra = {}) {
  if (type === 'ping') return {version: VERSION};
  if (type === 'update') {
    const count = await mutate(state => enqueue(state, extra.ids || []));
    void pump();
    return {count};
  }
  if (type === 'retry-source') {
    const count = await mutate(state => retrySourceJob(state, extra.jobId));
    if (count) void pump();
    return {count};
  }
  if (type === 'retry-oab') {
    const count = await mutate(state => retryOabJob(state, extra.jobId));
    if (count) void pump();
    return {count};
  }
  if (type === 'oab') {
    const count = await mutate(enqueueOab);
    void pump();
    return {count};
  }
  if (type === 'resume') {
    // Retoma execuções interrompidas ao fechar/recarregar a página, mas não
    // executa trabalho que exigia revisão manual após restauração de backup.
    await mutate(state => {
      for (const job of state.jobs) {
        if (job.status === 'interrupted' && !job.needsManualRetry) {
          transitionJob(job, 'queued', {nextAt: 0, updatedAt: now()});
        }
      }
    });
    void pump();
    return {};
  }
  if (type === 'cancel') {
    await mutate(state => {
      for (const job of state.jobs) {
        if (JOB_ACTIVE_STATES.includes(job.status)) {
          transitionJob(job, 'cancelled', {message: 'Cancelado pelo usuário', updatedAt: now()});
        }
      }
    });
    return {};
  }
  throw Error('Ação desconhecida.');
}

// ---------------------------------------------------------------------------
// Atualização automática (duas vezes ao dia por padrão)
// ---------------------------------------------------------------------------

function saoPauloNow(clock = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(clock).map(part => [part.type, part.value]));
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute)
  };
}

const minutesOf = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

function shiftDay(day, amount) {
  return new Date(new Date(day + 'T12:00:00Z').getTime() + amount * 86_400_000).toISOString().slice(0, 10);
}

export function parseAutoTimes(value) {
  const list = String(value || '').trim().split(/[;,\s]+/).filter(Boolean).map(item=>item.replace(/^(\d):/,'0$1:'));
  if (!list.length) throw Error('Informe ao menos um horário no formato HH:MM.');
  if (new Set(list).size > 6) throw Error('Informe no máximo 6 horários.');
  const clean = [];
  for (const item of list) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(item)) throw Error(`Horário inválido: ${item}. Use HH:MM.`);
    if (!clean.includes(item)) clean.push(item);
  }
  return clean.sort();
}

export function autoConfig(settings = {}) {
  let times;
  try {
    times = parseAutoTimes(settings.autoUpdateTimes || AUTO_DEFAULT_TIMES);
  } catch {
    times = parseAutoTimes(AUTO_DEFAULT_TIMES);
  }
  const last = String(settings.autoUpdateLast || '');
  return {
    enabled: settings.autoUpdateEnabled !== false,
    times,
    last: /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(last) ? last : ''
  };
}

function latestDue(times, clock = saoPauloNow()) {
  let best = '';
  for (const time of times) {
    if (minutesOf(time) <= clock.minutes) best = `${clock.day}T${time}`;
  }
  // Antes do primeiro horário do dia, a última janela ainda é a de ontem.
  // Isso permite recuperar uma execução perdida quando o painel é reaberto.
  if (!best) best = `${shiftDay(clock.day, -1)}T${times[times.length - 1]}`;
  return best;
}

function nextRun(times, clock = saoPauloNow()) {
  const upcoming = times.find(time => minutesOf(time) > clock.minutes);
  return upcoming ? `${clock.day}T${upcoming}` : `${shiftDay(clock.day, 1)}T${times[0]}`;
}

export function autoScheduleInfo(settings = {}, clock = new Date()) {
  const config = autoConfig(settings);
  const now = saoPauloNow(clock);
  const due = latestDue(config.times, now);
  return {
    ...config,
    due,
    dueReached: config.last < due,
    next: nextRun(config.times, now)
  };
}


