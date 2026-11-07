// Handlers de publicações, buscas DJEN/DataJud e conferência de eventos.
export function createPublicationActions(app) {
  const unified = async ({name, id}) => {
    const e = app.unifiedPublications(app.state, app.publicationEvents).find(e => e.key === id);
    if (!e) throw Error('Publicação não encontrada. Atualize a lista.');
    if (name === 'unified-publication-pdf') { app.downloadPublicationPdf(e); return; }
    if (name === 'unified-publication-official-pdf') return app.downloadOfficialCertificate(e, {integrated: e.remote, ...(e.remote ? {fetcher: app.apiFetch} : {})});
    if (name === 'unified-register-event') {
      if (!app.validCnj(e.cnj)) throw Error('CNJ inválido.');
      const existing = app.state.cases.find(c => c.cnj === e.cnj);
      return existing ? app.fullDetail(existing.id) : app.edit('cases', '', {cnj: e.cnj, title: 'Processo ' + app.formatCnj(e.cnj)});
    }
    const seen = !e.seen;
    app.publicationWriteEpoch++;
    if (e.remote) {
      if (seen && !e.is_new && !e.seen) {
        for (const ref of e.serviceRefs) await app.apiPost('events/seen', {caseId: ref.caseId, source: ref.source, eventId: ref.eventId});
      } else await app.apiPost('notifications/seen', {events: [{id: e.id, source: e.source, cnj: e.cnj}], seen});
    }
    app.publicationEvents = app.publicationEvents.map(x => app.notificationKey(x) === e.key ? {...x, seen: Number(seen), is_new: Number(!seen)} : x);
    if (e.localIds.length) await app.mutate(s => { for (const x of s.events) if (app.notificationKey(x) === e.key) x.seen = seen; });
    app.notificationCenter.lastFetch = 0;
    void app.notificationCenter.refresh(true);
    await app.refresh(true);
    app.toast(seen ? 'Publicação conferida.' : 'Conferência desmarcada.');
    return;
  };

  return {
    'djen-search': async () => app.searchDjen(app.$('#entity-form'), app.apiPost,
      app.integrated && app.serviceOnline, app.state.settings.djenDays),
    'datajud-search': async () => app.searchDatajud(app.$('#entity-form'), app.apiPost, app.integrated && app.serviceOnline),
    'datajud-apply': async () => app.applyDatajudSelection(app.$('#entity-form')),
    'refresh-publications': async () => app.refreshPublications(true),
    'publication-seen': async ctx => unified(ctx),
    'unified-publication-official-pdf': async ctx => unified(ctx),
    'unified-publication-pdf': async ctx => unified(ctx),
    'unified-register-event': async ctx => unified(ctx),
    'publication-filter': async ({id}) => {
      if (!Object.hasOwn(app.PUBLICATION_FILTERS, id)) throw Error('Filtro de publicações inválido.');
      app.publicationFilter = id;
      app.publicationLimit = app.PUBLICATION_BATCH_SIZE;
      app.render();
      document.querySelector(`[data-action="publication-filter"][data-id="${id}"]`)?.focus();
      return;
    },
    'publication-more': async () => {
      app.publicationLimit += app.PUBLICATION_BATCH_SIZE;
      return app.render();
    },
    'publication-pdf': async ({id}) => {
      const publication = app.state.events.find(e => e.id === id && e.kind === 'publication');
      if (!publication) throw Error('Publicação não encontrada para exportar.');
      app.downloadPublicationPdf(publication);
      return;
    },
    'publication-official-pdf': async ({id}) => {
      const publication = app.state.events.find(e => e.id === id && e.kind === 'publication');
      if (!publication) throw Error('Publicação não encontrada para baixar certidão.');
      return app.downloadOfficialCertificate(publication, {integrated: false});
    }
  };
}
