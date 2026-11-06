# Atualizações do Painel H.B — GitHub Releases

## Uso pelo advogado

Abra a Central de Controle e a aba **Atualizações**. O repositório inicial é `rvfaelo/painel-juridico`.

- **Verificar atualizações** consulta versões estáveis e mostra versão, publicação, novidades e mudanças de dependências.
- **Atualizar painel** exige duas confirmações: interrupção temporária do serviço e proteção dos dados do navegador. Nunca pede a senha do backup.
- **Histórico de versões** mostra até 30 releases recentes. A seleção considera as versões estáveis presentes nas 100 releases mais recentes da API.
- **Restaurar versão anterior** recupera arquivos e ambiente anteriores quando os esquemas continuam compatíveis. Não desfaz cadastros nem restaura silenciosamente um banco antigo.
- **Cancelar** interrompe download e preparação em um ponto seguro. Durante substituição e recuperação, é necessário aguardar o término.

Ao abrir a Central, a consulta é automática, mas a instalação nunca é. A verificação respeita 15 minutos entre tentativas automáticas; o botão manual respeita 30 segundos, inclusive após falhas. A instalação fica vinculada à versão exibida e confirmada; uma publicação posterior não é instalada no lugar dela. Falhas de internet não bloqueiam os botões de abrir o painel.

O endereço permanece `http://127.0.0.1:8766`. O modo simples continua no mesmo arquivo e caminho. A atualização não muda navegador, perfil, origem ou porta.

## Dados e recuperação

O serviço usa `%LOCALAPPDATA%\PautaJuridico\pauta-monitoramento.sqlite3`, ou a pasta explicitamente configurada em `PAUTA_DATA_DIR`. A carteira integrada e os anexos são armazenados no mesmo SQLite, além do monitoramento. O atualizador consulta o diretório efetivo da instância identificada antes de pará-la.

O modo simples também pode ter carteira e anexos no **IndexedDB de cada perfil/origem**. O atualizador não possui acesso a esses bancos e não presume que o SQLite os protege. Antes de instalar, a Central exige confirmação de exportação protegida pelo próprio painel, ou de que não existem dados exclusivos no modo simples. Nenhuma senha é recebida ou registrada pelo atualizador.

Estado, tarefas, logs de etapas e backups de atualização ficam fora da instalação: `%LOCALAPPDATA%\PainelHB\updates\<identificador-da-instalacao>`. A cópia de SQLite usa a API de backup consistente, seguida de `quick_check`. Ela contém dados privados e deve permanecer somente no computador do advogado.

O backup inclui os arquivos substituídos e um lançador independente `RESTAURAR.cmd`. Se a Central deixar de abrir após uma interrupção, execute esse lançador na pasta do backup. Ele pede confirmação e recupera somente código/ambiente. Não copia bancos antigos sobre dados atuais.

Os contratos desta versão são: protocolo de atualização 1, esquema de monitoramento 3 e esquema da carteira 2. Atualizações com outro esquema ou origem são recusadas antes da substituição. Migrações de esquema exigem implementação e validação específicas em uma próxima versão; não há execução de scripts de migração indicados arbitrariamente pelo manifesto remoto.

O atualizador identifica a instalação pelo hash do caminho no endpoint de saúde. Não mata processos Python por nome e não encerra outra instalação que ocupe a porta. A validação pós-instalação usa um modo de manutenção sem workers de tribunais, confirma a versão e só então retoma o serviço normal, se ele estava ativo.

## Pacotes e confiança

A Release deve conter estes três arquivos com nomes exatos:

1. `Painel-HB-v<VERSAO>-Windows.zip`
2. `update-manifest.json`
3. `update-manifest.sig`

O manifesto contém repositório, versão, plataforma, contratos, dependências, tamanho e SHA-256 do ZIP e de todos os arquivos. Sua assinatura RSA-SHA256 é verificada pela API criptográfica do Windows usando a chave pública incorporada em `update-trust.json`. Um checksum publicado junto do ZIP não substitui a assinatura do editor.

Downloads usam HTTPS e hosts GitHub/CDN permitidos; tokens não seguem redirecionamentos para outro host. O ZIP não pode conter caminhos absolutos, `..`, ADS do Windows, nomes reservados, links, junctions, colisões de maiúsculas, arquivos extras, bancos ou pastas de dados. O inventário assinado deve coincidir com `release-files.json` do pacote. O gerador de ZIP usa ordem, datas e permissões fixas para reprodução com os mesmos bytes de entrada.

`update-config.json` define o repositório distribuído. Uma alteração feita pelo operador na Central fica no perfil local, fora do código substituído. Trocar de repositório não troca a chave confiável: os pacotes ainda precisam da assinatura reconhecida. Para futuro repositório privado, o trabalhador aceita `HB_GITHUB_TOKEN` no ambiente, enviado apenas à API GitHub. Não há token embutido ou salvo em configurações/ZIPs. O repositório atual é público e dispensa token.

## Dependências

`update-dependencies.json` fixa os pacotes diretos, limites Python x64, Node.js e contratos de dados. Se as versões instaladas correspondem, o `.venv` é reutilizado. O e-SAJ é preservado como opcional quando já instalado.

Se houver mudança, um novo ambiente é preparado em `.venv-update-<tarefa>`, sem modificar o ativo. Somente após validação ocorre a troca; o ambiente anterior fica no backup. Uma falha no pip não deixa o `.venv` ativo parcialmente atualizado. O Python-base executa o atualizador fora do ambiente que será trocado.

Pode ser publicado junto um pacote offline correspondente. O campo assinado `offline_dependencies` vincula nome, tamanho e hash do ZIP; o atualizador extrai somente wheels. Também pode reutilizar a wheelhouse previamente instalada em `dependencias-offline/wheels`. Sem wheelhouse, a preparação tenta wheels do PyPI, sem Git e sem URLs de instalação fornecidas pelo manifesto.

Mudança para uma faixa de Python não instalada é bloqueada antes de trocar arquivos. A instalação inicial continua pela aba Instalação e pelo pacote offline existente. O aplicativo atual também usa Node.js para validar gravações da carteira integrada: esse requisito já existe em `service/workspace.py`. O atualizador o identifica, mas não instala Node.js nem uma nova versão-base de Python automaticamente. Não confundir o teste isolado de venv/offline com uma instalação completa de Windows recém-formatado.

## Publicar uma versão — editor

A versão inicial com a aba Atualizações é a **0.6.0**. Instalações anteriores precisam receber essa distribuição uma primeira vez; depois podem atualizar pela Central.

1. Atualize versão em `core.js`, `service/main.py`, `package.json`, `package-lock.json` e o changelog/teste.
2. Atualize dependências e inventário quando necessário. Não inclua dados, credenciais, `.venv`, testes ou arquivos privados no inventário de distribuição.
3. Execute os testes JavaScript e Python, gere o bundle e o pacote.

```powershell
npm ci
npm run build
npm test
python -m unittest discover -s tests -p "test_*.py"
python tools/package.py
python tools/smoke-release.py
python tools/build-update.py
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/sign-update.ps1 -Manifest update-manifest.json -Signature update-manifest.sig
powershell.exe -NoProfile -ExecutionPolicy Bypass -File updates/verify-signature.ps1 -Manifest update-manifest.json -Signature update-manifest.sig -Trust update-trust.json
```

Para vincular o pacote offline existente, substitua a etapa do manifesto por:

```powershell
python tools/build-update.py --offline Painel-HB-Dependencias-Offline-Win64-Python312.zip
```

Publique o ZIP offline da mesma forma e com o mesmo nome do campo assinado. Qualquer alteração dos ZIPs exige gerar e assinar novamente o manifesto.

**Chave do editor:** a chave privada desta instalação foi gerada localmente e protegida com DPAPI em `%LOCALAPPDATA%\PainelHB-Editor\release-key.dpapi.xml`. Ela não foi incluída no repositório ou pacote. Mantenha uma estratégia própria de recuperação dessa chave: o arquivo protegido depende do usuário e do computador Windows que o criou. Não execute `-Initialize` novamente para substituir uma identidade em uso.

O workflow `.github/workflows/release.yml` é manual, recebe uma tag já existente, valida a versão, testa, empacota e assina. Requer o segredo GitHub Actions **HB_UPDATE_RSA_XML**, correspondente à chave pública distribuída. Configure-o pelo mecanismo seguro de secrets do GitHub, nunca por chat ou arquivo versionado. O workflow falha se não houver chave correspondente. Não usa a credencial pessoal do editor no pacote.

O workflow produz um artefato para revisão e **não publica Releases automaticamente**. Após aprovação, o editor cria uma Release estável para a tag correspondente e anexa os três arquivos; o ZIP de código-fonte automático do GitHub não é pacote de atualização. Use o processo habitual de revisão do repositório para enviar o código e o workflow.

Nenhuma publicação remota é feita pelo gerador, assinador, Central ou testes locais.

Fontes primárias: [API de Releases](https://docs.github.com/en/rest/releases/releases) e [download de assets](https://docs.github.com/en/rest/releases/assets).
