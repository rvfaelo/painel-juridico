// Monta o HTML de conteúdo da rota atual.
export function contentHTML(app, route) {
  return ({
    home: app.home,
    notifications: () => '<div id="notification-center"></div>',
    agendados: app.agendadosPanel,
    cases: app.casesPanel,
    clients: app.clients,
    tasks: app.tasks,
    agenda: app.agenda,
    finance: app.finance,
    publications: app.publications,
    sources: app.sourcePage
  })[route]();
}
