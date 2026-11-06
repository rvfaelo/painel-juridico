# Painel H.B — ficha processual compacta

Data: 05/11/2026. Complemento da auditoria de UI/UX da versão 0.4.0.

## Escopo

1. **Janela de detalhes do processo**: aparência mais leve, borda de 1 px, sombra
   suave e cantos uniformes. Cabeçalho com botão **Fechar** sempre visível,
   conteúdo em área com rolagem própria, largura máxima de 900 px e ajuste para
   telas estreitas. O foco visível permanece nos controles interativos; a borda
   nativa ao focar o elemento de diálogo deixou de produzir um contorno preto.
2. **Histórico local no navegador**: exibe 12 eventos de cada vez, em linhas
   compactas com data, origem, categoria e resumo. O clique em uma linha expande
   texto integral, informações de identificação, conferência, links seguros para
   a fonte, PDF da publicação e certidão, quando disponíveis.
3. **Histórico integrado**: pagina separadamente os eventos por fonte (DataJud,
   DJEN e outras) e situação (novidades por conferir e histórico). Cada página
   mostra até 12 registros. O resumo é curto, mas o texto completo, os
   destinatários e os documentos da publicação continuam disponíveis ao
   expandir a linha. Mantém identificação por fonte, grau e avisos de possível
   repetição entre graus distintos.
4. **Acessibilidade e densidade**: navegação com botões Anterior/Próxima,
   contagem real por grupo, estado da página, resumo nativo com teclado, foco
   visível, suporte a telas a partir de 375 px e a preferência de movimento reduzido.

## Limites preservados

- Nenhum andamento foi mesclado ou apagado em função de texto ou data iguais.
- A paginação não solicita novamente o backend; apenas altera o conjunto de
  linhas desenhado. Não há migração ou alteração de IndexedDB, SQLite, backup,
  relacionamento ou regra de deduplicação.
- A consulta integrada pode receber somente os **2.000 registros mais
  recentes**, se esse limite for atingido pelo serviço. O aviso preexistente
  permanece; a interface não afirma ter o histórico judicial completo.
- Datas de movimentos e horários técnicos de descoberta continuam claramente
  separados. Os dados de fontes oficiais continuam sujeitos à conferência.
- Campos de workflow, pendências, documentos e ações processuais continuam na
  ficha. O painel permanece somente no modo lista (sem Kanban).

## Verificação com dados fictícios

- Renderização de 157 movimentos em teste unitário, com navegação até a última
  página e verificação de preservação dos IDs individuais.
- Playwright integrado simula mais de 150 eventos no navegador usando uma
  interceptação local de resposta: não grava esses eventos no SQLite.
- Playwright local injeta 31 movimentos exclusivamente em uma IndexedDB
  descartável: verifica páginas de 12/12/7, expansão e tela estreita.
- Capturas de verificação: `docs/ui-test/case-history-compact-desktop.png`,
  `docs/ui-test/case-history-compact-mobile.png` e
  `docs/ui-test/case-history-local-mobile.png`.
- Comandos: `npm run build`, `npm test`, `npm run test:ui`,
  `npm run test:integrated` e
  `.venv\Scripts\python.exe -m unittest discover -s tests -p "test_service*.py" -q`.

## Operação

Os arquivos-fonte afetados são `app.js`, `integrated-case-view.js`,
`integrated-ui.js`, `styles.css` e `dashboard.html`. O arquivo
`app.bundle.js` é regenerado com `npm run build`. Após substituir
arquivos, reinicie o serviço local, se ativo, e recarregue o navegador
com `Ctrl+F5`.
