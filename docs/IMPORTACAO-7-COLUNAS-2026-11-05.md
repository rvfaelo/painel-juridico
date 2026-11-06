# Painel H.B — planilha do escritório (sete colunas)

Atualização de 05/11/2026, versão 0.4.0. O mapeamento é automático
ao carregar Excel (.xlsx), CSV ou TSV com cabeçalho:

| Coluna | Planilha | Destino |
| --- | --- | --- |
| A | Tribunal | Tribunal validado |
| B | Processo | Número CNJ |
| C | Autor | Campo próprio Autor / parte autora |
| D | Reu / Réu | Campo próprio Réu / parte ré |
| E | Ação | Título do processo |
| F | Audiência | Data da audiência |
| G | Hora | Horário da audiência |

**Autor e Réu não são automaticamente clientes.** Cliente permanece sem
vínculo, a menos que a planilha tenha uma coluna Cliente mapeada
explicitamente. As partes aparecem na ficha e no editor do processo.

## Audiências

- Data e hora válidas criam compromisso do tipo **Audiência** na Agenda,
  vinculado ao processo importado. Exemplos aceitos: 18/11/2026 com 14:30,
  2026-11-18 com 14h30, ou 18/11/2026 com 9h.
- Números seriais de data/hora de Excel são interpretados somente
  quando a célula é do tipo numérico; sistemas 1900 e 1904 suportados.
- Data/hora em branco, inválida ou descritiva (como Aguardando designação)
  não gera compromisso: o conteúdo original fica nas Observações.
- Prévia indica quantidade de audiências agendáveis e avisos de dados
  incompletos. Não há cálculo de prazo ou ciência oficial de intimação.
  Confira sempre o agendamento no tribunal.

## Segurança e limites

O arquivo é lido localmente. A importação exige prévia e não altera
processos existentes, sem mesclar CNJs iguais. Nomes de partes não
acionam associação automática de clientes. Backups antigos permanecem
compatíveis. Os novos campos de partes estão nos backups e na exportação
CSV de carteira. **Compromissos não vão no CSV da carteira**; para migrar
a Agenda, utilize o backup completo protegido por senha.

O importador mantém limite de 2.000 linhas, 60 colunas, 6 MB, e recusa
CNJ numérico que o Excel pode ter arredondado.
