// Handlers gerais de navegação e fechamento de diálogos.
export function createGeneralActions(app) {
  return {
    changelog: async () => app.showChangelog(),
    close: async () => {
      app.pendingRestore = null;
      app.pendingEncrypted = null;
      app.pendingWorkbook = null;
      app.pendingSheetPlan = null;
      app.pendingDeletion = null;
      return app.$('#editor').close();
    }
  };
}
