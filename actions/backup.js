// Handlers de backup, restauração, importação, exportação e diagnósticos.
export function createBackupActions(app) {
  return {
    backup: async () => app.exportBackup(),
    'backup-readiness': async () => app.exportBackup(),
    restore: async () => app.chooseBackup(),
    'import-cnj': async () => app.importDialog(),
    'import-spreadsheet': async () => app.spreadsheetFileDialog(),
    'sheet-back': async () => {
      if (!app.pendingSheetPlan) return app.spreadsheetFileDialog();
      return app.spreadsheetMappingDialog(app.pendingWorkbook.sheets.indexOf(app.pendingSheetPlan.sheet));
    },
    'confirm-import': async () => {
      if (!app.pendingImport?.length) return;
      const numbers = app.pendingImport;
      await app.change(s => {
        for (const n of numbers) if (!s.cases.some(c => c.cnj === n)) app.saveEntity(s, 'cases', {cnj: n, title: 'Processo ' + app.formatCnj(n), stage: 'todo'});
      }, 'Importação concluída.');
      app.pendingImport = null;
      app.$('#editor').close();
      return;
    },
    'download-sheet-report': async () => {
      if (!app.pendingSheetPlan?.plan) throw Error('Prévia da importação não encontrada.');
      app.downloadCsv(app.exportImportReportCsv(app.pendingSheetPlan.plan), 'Painel-HB-relatorio-importacao-' + app.dateKey() + '.csv');
      return app.toast('Relatório completo baixado. Contém dados da planilha e não tem senha.');
    },
    'template-csv': async () => {
      app.downloadCsv(app.portfolioTemplateCsv(), 'Painel-HB-modelo-carteira.csv');
      return app.toast('Modelo vazio gerado. Edite as colunas e mantenha o CNJ como texto.');
    },
    'export-portfolio': async () => app.exportPortfolioDialog(),
    'confirm-export-portfolio': async () => {
      app.downloadCsv(app.exportPortfolioCsv(app.state), 'Painel-HB-carteira-' + app.dateKey() + '.csv');
      app.$('#editor').close();
      return app.toast('Carteira exportada. Este CSV não substitui o backup com senha.');
    },
    'audit-local': async () => app.showLocalAudit(),
    'audit-readiness': async () => app.showLocalAudit(),
    'source-diagnostics': async () => app.showSourceDiagnostics(),
    'source-readiness': async () => app.showSourceDiagnostics(),
    'coverage-new': async () => app.coverageDialog()
  };
}
