// Handlers de casos, tarefas, documentos, workflow e fila de consultas.
import {setCaseArchived,toggleTaskDone} from './state-machines.js';
export function createCaseActions(app) {
  return {
    'scheduled-owner': async ({id}) => {
      if (id === 'all' || Object.hasOwn(app.WORK_OWNERS, id)) {
        app.scheduledOwner = id;
        app.scheduledPage = 1;
        return app.render();
      }
      throw Error('Filtro de responsável inválido.');
    },
    'scheduled-prev': async ({name}) => {
      app.scheduledPage = Math.max(1, app.scheduledPage + (name === 'scheduled-next' ? 1 : -1));
      return app.render();
    },
    'scheduled-next': async ({name}) => {
      app.scheduledPage = Math.max(1, app.scheduledPage + (name === 'scheduled-next' ? 1 : -1));
      return app.render();
    },
    'workflow-viewed': async ({id}) => {
      await app.change(s => app.markCaseReviewed(s, id));
      if (app.$('#editor').open && app.$('#workflow-form')?.dataset.id === id) {
        const y = app.$('#editor').scrollTop;
        app.fullDetail(id);
        app.$('#editor').scrollTop = y;
      }
      return app.toast('Processo marcado como visto hoje (controle interno).');
    },
    'workflow-pending-remove': async ({id, caseId}) => {
      if (!caseId) throw Error('Processo da pendência não identificado.');
      await app.change(s => app.removeCasePending(s, caseId, id));
      if (app.$('#editor').open && app.state.cases.some(c => c.id === caseId)) {
        const y = app.$('#editor').scrollTop;
        app.fullDetail(caseId);
        app.$('#editor').scrollTop = y;
      }
      return app.toast('Pendência removida da ficha.');
    },
    'djen-process': async ({id}) => {
      await app.update([id], ['djen']);
      return app.fullDetail(id);
    },
    detail: async ({id}) => app.fullDetail(id),
    'copy-cnj': async ({id}) => {
      const c = app.state.cases.find(c => c.id === id), info = app.officialConsultation(c);
      if (!info?.number) throw Error('Número CNJ válido não disponível para copiar.');
      await navigator.clipboard.writeText(info.number);
      return app.toast('Número CNJ copiado.');
    },
    'copy-docket': async ({id}) => {
      const c = app.state.cases.find(c => c.id === id), info = app.officialConsultation(c);
      if (!info?.docket) throw Error('Registro adicional indisponível.');
      await navigator.clipboard.writeText(info.docket);
      return app.toast('Registro adicional copiado.');
    },
    'manual-check': async ({id}) => app.manualCheckDialog(id),
    payments: async ({id}) => app.paymentDialog(id),
    'reverse-payment': async ({id}) => {
      const p = app.state.payments.find(p => p.id === id);
      return app.dialog('Estornar recebimento', `<p>O lançamento original de ${app.money(p.amount)} continuará no histórico.</p><form id="reversal-form" data-id="${app.esc(id)}"><div class="form-grid">${app.field('Data do estorno', 'date', app.dateKey(), 'date', false, 'required')}${app.area('Motivo obrigatório', 'notes')}</div><p class="form-error" role="alert"></p><div class="form-actions"><button type="button" class="button ghost" data-action="close">Cancelar</button><button type="submit" class="button danger">Confirmar estorno</button></div></form>`);
    },
    attach: async ({id}) => app.attachDocument(id),
    'download-document': async ({id}) => {
      const d = app.state.documents.find(d => d.id === id), blob = await app.readDocument(id), url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url;
      a.download = d.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return;
    },
    'remove-document': async ({id}) => {
      const d = app.state.documents.find(d => d.id === id);
      return app.dialog('Remover anexo', `<p class="private">${app.esc(d.name)}</p><div class="notice">O arquivo será removido deste banco local. Cópias em backups já exportados permanecerão disponíveis.</div>${app.button('confirm-remove-document', 'Confirmar remoção', 'danger', id)}`);
    },
    'confirm-remove-document': async ({id}) => {
      const d = app.state.documents.find(d => d.id === id);
      if (!d) return;
      await app.removeDocument(id);
      await app.refresh(true);
      app.fullDetail(d.caseId);
      app.toast('Anexo removido.');
      return;
    },
    'new-task-for': async ({id}) => app.edit('tasks', '', {caseId: id}),
    'task-from-check': async ({id}) => {
      const c = app.state.cases.find(c => (c.manualChecks || []).some(x => x.id === id && app.sameManualIdentity(c, x)));
      const check = c?.manualChecks.find(x => x.id === id);
      if (!check || !['attention', 'change', 'unavailable'].includes(check.result)) throw Error('Conferência não encontrada ou sem pendência.');
      const linked = app.state.tasks.find(t => t.caseId === c.id && t.manualCheckId === check.id);
      if (linked) return app.edit('tasks', linked.id);
      return app.edit('tasks', '', {caseId: c.id, manualCheckId: check.id, title: 'Conferir resultado da consulta processual', notes: `Conferência manual em ${app.timestamp(check.checkedAt)} no ${app.PROCESS_SYSTEMS[check.source] || app.JUDICIAL_SYSTEMS[check.source] || 'portal oficial'}: ${app.MANUAL_CHECK_RESULTS[check.result]}. ${check.notes}`});
    },
    'retry-source': async ({id}) => {
      const response = await app.send('retry-source', {jobId: id});
      app.toast(response.count ? 'Nova consulta adicionada para esta fonte.' : 'Essa fonte já está em consulta.');
      return app.refresh(true);
    },
    'retry-oab': async ({id}) => {
      const response = await app.send('retry-oab', {jobId: id});
      app.toast(response.count ? 'Busca por OAB adicionada novamente à fila.' : 'Esta OAB já está em consulta.');
      return app.refresh(true);
    },
    'open-sources': async () => { location.hash = '#sources'; return; },
    'task-filter': async ({id}) => {
      if (!['open', 'done', 'all'].includes(id)) return;
      app.taskFilter = id;
      app.render();
      document.querySelector(`[data-action="task-filter"][data-id="${id}"]`)?.focus();
      return;
    },
    'filter-active': async ({name}) => {
      app.filter = name.slice(7);
      app.selected.clear();
      return app.render();
    },
    'filter-archived': async ({name}) => {
      app.filter = name.slice(7);
      app.selected.clear();
      return app.render();
    },
    'clear-case-filters': async () => {
      app.caseCourtFilter = '';
      app.caseLevelFilter = '';
      app.caseSystemFilter = '';
      app.selected.clear();
      return app.render();
    },
    'update-selected': async () => app.update([...app.selected]),
    'archive-selected': async ({name}) => {
      const ids = [...app.selected], archived = name === 'archive-selected';
      await app.change(s => { for (const c of s.cases) if (ids.includes(c.id)) c.archived = archived; }, archived ? 'Processos arquivados.' : 'Processos desarquivados.');
      app.selected.clear();
      return app.render();
    },
    'unarchive-selected': async ({name}) => {
      const ids = [...app.selected], archived = name === 'archive-selected';
      await app.change(s => { for (const c of s.cases) if (ids.includes(c.id)) c.archived = archived; }, archived ? 'Processos arquivados.' : 'Processos desarquivados.');
      app.selected.clear();
      return app.render();
    },
    'delete-selected': async () => {
      app.pendingDeletion = [...app.selected];
      const impact = app.caseDeletionImpact(app.state, app.pendingDeletion);
      const blocked = impact.attachments || impact.samples || impact.manualChecks;
      return app.dialog('Deletar ' + impact.cases.length + ' processo(s)', `<p class="subheading">${impact.cases.slice(0, 6).map(c => `<span class="private">${app.esc(c.title)}</span>`).join(' · ')}${impact.cases.length > 6 ? ' · outros ' + (impact.cases.length - 6) : ''}</p><p class="notice">Deletar remove os cadastros selecionados da carteira. Não remove publicações, consultas, tarefas, compromissos nem honorários: vínculos serão desvinculados. A exclusão não é desfeita por “Desarquivar”. Faça backup antes.</p><p class="muted compact">Vínculos preservados: ${impact.tasks} tarefa(s), ${impact.appointments} compromisso(s), ${impact.fees} honorário(s), ${impact.events} evento(s) e ${impact.jobs} consulta(s).</p>${blocked ? `<p class="warning-note" role="alert">Exclusão bloqueada para não perder ${impact.attachments} anexo(s), ${impact.samples} comparação(ões) ou ${impact.manualChecks} conferência(s) manual(is). Remova anexos individualmente; para processos com conferências ou comparações, utilize Arquivar.</p>` : '<p class="warning-note">O título, observações e demais dados exclusivos da ficha serão excluídos. O histórico do serviço integrado será mantido.</p>'}<div class="form-actions"><button type="button" class="button ghost" data-action="close">Cancelar</button>${blocked ? '' : app.button('confirm-delete-selected', 'Confirmar exclusão', 'danger')}</div>`);
    },
    'confirm-delete-selected': async () => {
      if (!app.pendingDeletion?.length) throw Error('Nenhum processo selecionado para exclusão.');
      const ids = app.pendingDeletion;
      await app.mutate(s => app.deleteCases(s, ids));
      app.pendingDeletion = null;
      app.selected.clear();
      app.$('#editor').close();
      await app.refresh(true);
      if (app.integrated && app.serviceOnline) await app.syncBrowser(app.state, true, app.state.cases.length === 0);
      return app.toast(ids.length + ' processo(s) removido(s) da carteira. Históricos vinculados preservados.');
    },
    'update-one': async ({id}) => {
      app.$('#editor').close();
      return app.update([id]);
    },
    archive: async ({id}) => {
      await app.change(s => { const c = s.cases.find(c => c.id === id); if (c) setCaseArchived(c, !c.archived); }, 'Arquivo atualizado.');
      app.selected.delete(id);
      if (app.$('#editor').open) app.$('#editor').close();
      return;
    },
    'complete-task': async ({id}) => app.change(s => { const t = s.tasks.find(t => t.id === id); if (t) toggleTaskDone(t); }, 'Tarefa atualizada.'),
    seen: async ({id}) => {
      await app.change(s => { const e = s.events.find(e => e.id === id); if (e) e.seen = !e.seen; });
      if (app.$('#editor').open && app.state.events.find(e => e.id === id)?.caseId) app.fullDetail(app.state.events.find(e => e.id === id).caseId);
      return;
    },
    'register-event': async ({id}) => {
      const e = app.state.events.find(e => e.id === id);
      if (!e || !app.validCnj(e.cnj)) throw Error('Publicação sem CNJ válido.');
      const existing = app.state.cases.find(c => c.cnj === e.cnj);
      return existing ? app.fullDetail(existing.id) : app.edit('cases', '', {cnj: e.cnj, title: 'Processo ' + app.formatCnj(e.cnj)});
    },
    'reconcile-events': async () => {
      let count = 0;
      await app.change(s => { count = app.reconcileEventLinks(s); });
      return app.toast(count ? `${count} publicação(ões) e movimentação(ões) vinculadas ou corrigidas pelo CNJ.` : 'Todos os vínculos por CNJ já estão atualizados.');
    },
    oab: async () => {
      const result = await app.send('oab');
      app.toast(result.count ? 'Busca de publicações adicionada à fila.' : 'Esta OAB já está na fila.');
      return app.refresh(true);
    },
    resume: async ({name}) => { await app.send(name); return app.refresh(true); },
    cancel: async ({name}) => { await app.send(name); return app.refresh(true); },
    'auto-now': async () => {
      if (!app.integrated || !app.serviceOnline) throw Error('Inicie o Painel H.B no modo integrado para consultar os tribunais.');
      const ids = app.state.cases.filter(c => !c.archived && c.cnj).map(c => c.id);
      const result = await app.send('update', {ids});
      app.toast(result?.count ? `${result.count} consulta(s) adicionada(s) à fila do serviço.` : 'Não há novas consultas para adicionar.');
      return app.refresh(true);
    }
  };
}
