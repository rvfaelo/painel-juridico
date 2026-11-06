# Central de comandos do Painel H.B. Windows PowerShell 5.1, sem dependencias externas.
# Nao instala nada automaticamente: as acoes sempre partem de um clique do operador.
param(
  [switch]$SelfTest,
  [string]$Screenshot,
  [ValidateRange(0,2)][int]$ScreenshotTab = 0,
  [switch]$TestInteractions
)

$ErrorActionPreference = 'Stop'
$script:Root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$script:Actions = [ordered]@{
  simple = 'ABRIR-PAINEL.cmd'
  integrated = 'ABRIR-PAINEL-INTEGRADO.cmd'
  status = 'STATUS-SERVICO.cmd'
  stop = 'PARAR-SERVICO.cmd'
  offline = 'dependencias-offline\INSTALAR-DEPENDENCIAS-OFFLINE.cmd'
  esajOffline = 'dependencias-offline\INSTALAR-ESAJ-OFFLINE.cmd'
  online = 'PREPARAR-SERVICO.cmd'
  esajOnline = 'INSTALAR-ESAJ-OPCIONAL.cmd'
  autoStart = 'INSTALAR-INICIALIZACAO.cmd'
  removeAutoStart = 'REMOVER-INICIALIZACAO.cmd'
  update = 'ATUALIZAR-LOCAL.cmd'
}
$script:InteractionMode = [bool]$TestInteractions
$script:InteractionLog = New-Object 'System.Collections.Generic.List[string]'
$script:Buttons = @{}

function Get-ActionPath([string]$Name) {
  if (-not $script:Actions.Contains($Name)) { throw 'Acao desconhecida.' }
  $full = [System.IO.Path]::GetFullPath((Join-Path $script:Root $script:Actions[$Name]))
  $prefix = $script:Root.TrimEnd('\') + '\'
  if (-not $full.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Acao fora da pasta do Painel H.B.'
  }
  return $full
}

function Get-Health {
  # Somente loopback. Nao consulta DataJud, DJEN ou outro tribunal.
  $url = 'http://127.0.0.1:8766/api/v1/health'
  $request = [System.Net.HttpWebRequest]::Create($url)
  $request.Method = 'GET'
  $request.Timeout = 1300
  $request.ReadWriteTimeout = 1300
  $request.Proxy = $null
  try {
    $response = $request.GetResponse()
    try {
      $stream = New-Object System.IO.StreamReader($response.GetResponseStream())
      try { $result = $stream.ReadToEnd() | ConvertFrom-Json }
      finally { $stream.Dispose() }
      if ($result.product -eq 'pauta-local-service' -and $result.status -eq 'ok') {
        return @{ Online = $true; Version = [string]$result.appVersion }
      }
    } finally { $response.Dispose() }
  } catch [System.Net.WebException] { }
  catch [System.InvalidOperationException] { }
  catch { }
  return @{ Online = $false; Version = '' }
}

function Test-LocalEnvironment {
  $py = Join-Path $script:Root '.venv\Scripts\python.exe'
  return (Test-Path -LiteralPath $py -PathType Leaf)
}

if ($SelfTest) {
  $required = @('simple','integrated','status','stop','online','esajOnline','autoStart','removeAutoStart','update')
  foreach ($name in $required) {
    if (-not (Test-Path -LiteralPath (Get-ActionPath $name) -PathType Leaf)) {
      throw ('Arquivo obrigatorio ausente: ' + $script:Actions[$name])
    }
  }
  foreach ($name in $script:Actions.Keys) { $null = Get-ActionPath $name }
  $result = [ordered]@{
    ok = $true
    central = 'Painel H.B'
    actions = $script:Actions.Count
    offlineExtracted = (Test-Path -LiteralPath (Get-ActionPath 'offline') -PathType Leaf)
    localVenv = (Test-LocalEnvironment)
    noInternetCalls = $true
  }
  $result | ConvertTo-Json -Compress
  exit 0
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$script:Colors = @{
  Page = [System.Drawing.Color]::FromArgb(246,249,245)
  White = [System.Drawing.Color]::White
  Dark = [System.Drawing.Color]::FromArgb(33,62,46)
  Text = [System.Drawing.Color]::FromArgb(38,53,43)
  Muted = [System.Drawing.Color]::FromArgb(95,112,100)
  Border = [System.Drawing.Color]::FromArgb(219,229,218)
  Accent = [System.Drawing.Color]::FromArgb(34,102,68)
  Light = [System.Drawing.Color]::FromArgb(230,241,231)
  Warning = [System.Drawing.Color]::FromArgb(151,92,22)
}
$script:FontBody = New-Object System.Drawing.Font('Segoe UI',9.25)
$script:FontBold = New-Object System.Drawing.Font('Segoe UI',10,[System.Drawing.FontStyle]::Bold)
$script:FontSmall = New-Object System.Drawing.Font('Segoe UI',8.5)

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Painel H.B | Central de controle'
$form.StartPosition = 'CenterScreen'
$form.Size = New-Object System.Drawing.Size(900,680)
$form.MinimumSize = New-Object System.Drawing.Size(800,610)
$form.BackColor = $script:Colors.Page
$form.Font = $script:FontBody
$form.AutoScaleMode = [System.Windows.Forms.AutoScaleMode]::Font
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::Sizable

$hero = New-Object System.Windows.Forms.Panel
$hero.Dock = 'Top'
$hero.Height = 103
$hero.BackColor = $script:Colors.Dark
$form.Controls.Add($hero)

$title = New-Object System.Windows.Forms.Label
$title.Text = 'H.B  |  Central de controle'
$title.Font = New-Object System.Drawing.Font('Segoe UI',20,[System.Drawing.FontStyle]::Bold)
$title.ForeColor = $script:Colors.White
$title.AutoSize = $true
$title.Location = New-Object System.Drawing.Point(22,19)
$hero.Controls.Add($title)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = 'Acesse, instale e gerencie seu painel jurídico em um único lugar.'
$subtitle.Font = $script:FontBody
$subtitle.ForeColor = [System.Drawing.Color]::FromArgb(216,232,216)
$subtitle.AutoSize = $true
$subtitle.Location = New-Object System.Drawing.Point(26,63)
$hero.Controls.Add($subtitle)

$statusPanel = New-Object System.Windows.Forms.Panel
$statusPanel.Dock = 'Top'
$statusPanel.Height = 65
$statusPanel.BackColor = $script:Colors.White
$form.Controls.Add($statusPanel)

$envLabel = New-Object System.Windows.Forms.Label
$envLabel.Font = $script:FontBold
$envLabel.Location = New-Object System.Drawing.Point(24,20)
$envLabel.Size = New-Object System.Drawing.Size(296,27)
$statusPanel.Controls.Add($envLabel)

$serviceLabel = New-Object System.Windows.Forms.Label
$serviceLabel.Font = $script:FontBold
$serviceLabel.Location = New-Object System.Drawing.Point(330,20)
$serviceLabel.Size = New-Object System.Drawing.Size(310,27)
$statusPanel.Controls.Add($serviceLabel)

$statusButton = New-Object System.Windows.Forms.Button
$statusButton.Text = 'Atualizar estado'
$statusButton.Size = New-Object System.Drawing.Size(155,35)
$statusButton.Anchor = 'Top,Right'
$statusButton.Location = New-Object System.Drawing.Point(710,15)
$statusButton.Font = $script:FontBody
$statusButton.FlatStyle = 'Flat'
$statusButton.FlatAppearance.BorderColor = $script:Colors.Border
$statusButton.BackColor = $script:Colors.Page
$statusButton.ForeColor = $script:Colors.Dark
$statusPanel.Controls.Add($statusButton)
$statusPanel.Add_Resize({ $statusButton.Left = $statusPanel.ClientSize.Width - $statusButton.Width - 19 })

$tabs = New-Object System.Windows.Forms.TabControl
$tabs.Dock = 'Fill'
$tabs.Font = $script:FontBody
$tabs.Padding = New-Object System.Drawing.Point(16,9)
$form.Controls.Add($tabs)
$tabs.BringToFront()

function New-Page([string]$Caption) {
  $page = New-Object System.Windows.Forms.TabPage
  $page.Text = $Caption
  $page.BackColor = $script:Colors.Page
  $page.AutoScroll = $true
  $tabs.TabPages.Add($page)
  return $page
}

function Add-Label($Parent,[string]$Text,[int]$X,[int]$Y,[int]$Width,[int]$Height,[bool]$Emphasis=$false) {
  $label = New-Object System.Windows.Forms.Label
  $label.Text = $Text
  $label.Location = New-Object System.Drawing.Point($X,$Y)
  $label.Size = New-Object System.Drawing.Size($Width,$Height)
  $label.Font = if ($Emphasis) { $script:FontBold } else { $script:FontBody }
  $label.ForeColor = if ($Emphasis) { $script:Colors.Dark } else { $script:Colors.Muted }
  $Parent.Controls.Add($label)
  return $label
}

function Confirm([string]$Message,[string]$Caption='Confirmar acao') {
  $answer = [System.Windows.Forms.MessageBox]::Show($form,$Message,$Caption,'YesNo','Question')
  return ($answer -eq [System.Windows.Forms.DialogResult]::Yes)
}

function Show-Info([string]$Message,[string]$Caption='Painel H.B') {
  [void][System.Windows.Forms.MessageBox]::Show($form,$Message,$Caption,'OK','Information')
}

function Refresh-Status {
  $ready = Test-LocalEnvironment
  $envLabel.Text = if ($ready) { 'Ambiente Python: disponível' } else { 'Ambiente Python: não instalado' }
  $envLabel.ForeColor = if ($ready) { $script:Colors.Accent } else { $script:Colors.Warning }
  $health = Get-Health
  $serviceLabel.Text = if ($health.Online) { 'Serviço local: ativo  v' + $health.Version } else { 'Serviço local: parado' }
  $serviceLabel.ForeColor = if ($health.Online) { $script:Colors.Accent } else { $script:Colors.Muted }
}

function Open-Command([string]$Action) {
  if ($script:InteractionMode) {
    [void]$script:InteractionLog.Add($Action)
    return
  }
  try {
    if ($Action -eq 'offline' -or $Action -eq 'esajOffline') {
      if (-not (Test-Path -LiteralPath (Get-ActionPath $Action) -PathType Leaf)) {
        Show-Info 'O pacote de dependencias offline ainda nao foi extraido. Extraia Painel-HB-Dependencias-Offline-Win64-Python312.zip dentro da pasta Painel-HB e tente novamente.' 'Dependencias offline ausentes'
        return
      }
    }
    if ($Action -eq 'integrated' -and -not (Test-LocalEnvironment)) {
      Show-Info 'Instale as dependencias antes de abrir o modo integrado. Use a aba Instalacao e escolha Instalar offline (recomendado) ou Preparar com internet.' 'Instalacao necessaria'
      $tabs.SelectedIndex = 1
      return
    }
    if ($Action -eq 'stop' -and -not (Confirm 'Deseja realmente parar o servico local? Consultas em execucao podem ser interrompidas.')) { return }
    if ($Action -eq 'autoStart' -and -not (Confirm 'Ativar o inicio automatico ao entrar no Windows? O monitoramento podera executar enquanto o computador estiver ligado.')) { return }
    if ($Action -eq 'removeAutoStart' -and -not (Confirm 'Remover a inicializacao automatica do Painel H.B no Windows?')) { return }
    if ($Action -eq 'update' -and -not (Confirm 'A verificacao local exige Node.js e dependencias de desenvolvimento. Ela NAO busca atualizacoes na internet nem substitui dados. Fazer backup e parar o servico antes de continuar. Abrir verificacao?')) { return }
    if ($Action -eq 'online' -and -not (Confirm 'A preparacao online instalara bibliotecas pelo Python/pip e pode acessar a internet. Deseja continuar?')) { return }
    if ($Action -eq 'esajOnline' -and -not (Confirm 'Instalar o conector TJSP e-SAJ pela internet? O servico deve ser reiniciado depois.')) { return }
    $file = Get-ActionPath $Action
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Script nao encontrado: $file" }
    # O script de instalacao sempre aparece em um terminal independente para
    # o usuario conferir erros; a interface nao anuncia sucesso antecipado.
    $arguments = '/c ""' + $file + '""'
    Start-Process -FilePath $env:ComSpec -ArgumentList $arguments -WorkingDirectory $script:Root | Out-Null
    $message = if ($Action -in @('offline','esajOffline','online','esajOnline')) {
      'Instalacao aberta em janela propria. Confira o resultado nela antes de iniciar consultas.'
    } else { 'Comando aberto em janela propria. Confira o resultado, se solicitado.' }
    $script:FooterLabel.Text = $message
    Refresh-Status
  } catch {
    [void][System.Windows.Forms.MessageBox]::Show($form,$_.Exception.Message,'Acao nao iniciada','OK','Error')
  }
}

function Add-Action($Page,[int]$X,[int]$Y,[string]$Name,[string]$Description,[string]$Key,[bool]$Primary=$false) {
  $button = New-Object System.Windows.Forms.Button
  $button.Text = '  ' + $Name
  $button.Font = $script:FontBold
  $button.Size = New-Object System.Drawing.Size(382,49)
  $button.Location = New-Object System.Drawing.Point($X,$Y)
  $button.TextAlign = 'MiddleLeft'
  $button.FlatStyle = 'Flat'
  $button.FlatAppearance.BorderSize = 1
  $button.FlatAppearance.BorderColor = if ($Primary) { $script:Colors.Accent } else { $script:Colors.Border }
  $button.BackColor = if ($Primary) { $script:Colors.Accent } else { $script:Colors.White }
  $button.ForeColor = if ($Primary) { $script:Colors.White } else { $script:Colors.Dark }
  $button.Cursor = [System.Windows.Forms.Cursors]::Hand
  $Page.Controls.Add($button)
  $script:Buttons[$Key] = $button
  [void](Add-Label $Page $Description ($X+4) ($Y+52) 380 32)
  $act = $Key
  $button.Add_Click({ Open-Command $act }.GetNewClosure())
  return $button
}

$homePage = New-Page 'Início'
[void](Add-Label $homePage 'Abra seu painel' 25 24 560 27 $true)
[void](Add-Label $homePage 'O modo simples funciona offline. O modo integrado precisa do serviço Python.' 25 53 790 24)
[void](Add-Action $homePage 26 95 'Abrir painel simples' 'Carteira, tarefas e agenda no Chrome ou Edge.' 'simple' $true)
[void](Add-Action $homePage 436 95 'Abrir painel integrado' 'Inicia o serviço local e abre o painel completo.' 'integrated' $true)
[void](Add-Label $homePage 'Controle do serviço' 25 200 560 27 $true)
[void](Add-Action $homePage 26 242 'Verificar situação' 'Confere o serviço e seu estado atual.' 'status')
[void](Add-Action $homePage 436 242 'Parar serviço' 'Encerra a instância local com confirmação.' 'stop')
[void](Add-Label $homePage 'O serviço integrado escuta apenas em 127.0.0.1:8766. A central não executa consultas judiciais automaticamente.' 25 330 795 46)

$setup = New-Page 'Instalação'
[void](Add-Label $setup 'Instalação e conectores' 25 24 560 27 $true)
[void](Add-Label $setup 'A instalação offline é recomendada para transferir o painel a outro computador.' 25 53 785 24)
[void](Add-Action $setup 26 97 'Instalar dependências offline' 'Python 3.12 + bibliotecas; sem Git, Node.js ou rede.' 'offline' $true)
[void](Add-Action $setup 436 97 'Instalar e-SAJ offline' 'Ativa conector opcional do TJSP usando o ZIP offline.' 'esajOffline')
[void](Add-Action $setup 26 206 'Preparar com internet' 'Alternativa online, com Python instalado previamente.' 'online')
[void](Add-Action $setup 436 206 'Instalar e-SAJ online' 'Alternativa com acesso ao repositório de pacotes.' 'esajOnline')
[void](Add-Label $setup 'Para usar offline: extraia o ZIP de dependências dentro da pasta Painel-HB. A subpasta dependencias-offline ficará ao lado de dashboard.html.' 25 323 795 65)

$maint = New-Page 'Manutenção'
[void](Add-Label $maint 'Manutenção do Windows' 25 24 560 27 $true)
[void](Add-Action $maint 26 75 'Ativar início automático' 'Cria tarefa no Windows após confirmação.' 'autoStart')
[void](Add-Action $maint 436 75 'Desativar início automático' 'Remove a tarefa de inicialização do painel.' 'removeAutoStart')
[void](Add-Action $maint 26 174 'Verificar código local' 'Testes e compilação; exige Node.js no computador.' 'update')

$folderButton = New-Object System.Windows.Forms.Button
$folderButton.Text = '  Abrir pasta do painel'
$folderButton.Font = $script:FontBold
$folderButton.Location = New-Object System.Drawing.Point(436,174)
$folderButton.Size = New-Object System.Drawing.Size(382,49)
$folderButton.BackColor = $script:Colors.White
$folderButton.ForeColor = $script:Colors.Dark
$folderButton.FlatStyle = 'Flat'
$folderButton.FlatAppearance.BorderColor = $script:Colors.Border
$folderButton.TextAlign = 'MiddleLeft'
$folderButton.Cursor = [System.Windows.Forms.Cursors]::Hand
$folderButton.Add_Click({ Start-Process -FilePath 'explorer.exe' -ArgumentList ('"' + $script:Root + '"') })
$maint.Controls.Add($folderButton)
[void](Add-Label $maint 'Acesse os arquivos e os manuais locais.' 440 226 380 32)
[void](Add-Label $maint 'Backup: use Exportar backup protegido dentro do painel. A central não copia, altera ou restaura processos e dados por conta própria.' 25 310 795 70)

$footer = New-Object System.Windows.Forms.Panel
$footer.Dock = 'Bottom'
$footer.Height = 41
$footer.BackColor = $script:Colors.White
$form.Controls.Add($footer)
$script:FooterLabel = New-Object System.Windows.Forms.Label
$script:FooterLabel.Text = 'Pronto para usar. Todos os comandos exigem ação manual.'
$script:FooterLabel.Location = New-Object System.Drawing.Point(21,10)
$script:FooterLabel.AutoSize = $true
$script:FooterLabel.ForeColor = $script:Colors.Muted
$script:FooterLabel.Font = $script:FontSmall
$footer.Controls.Add($script:FooterLabel)

# Layout deterministico: evita que um painel Dock.Fill cubra o cabecalho no
# Windows Forms ou altere a ordem das faixas em diferentes escalas de tela.
$form.Controls.Clear()
$layout = New-Object System.Windows.Forms.TableLayoutPanel
$layout.Dock = 'Fill'
$layout.Margin = New-Object System.Windows.Forms.Padding(0)
$layout.Padding = New-Object System.Windows.Forms.Padding(0)
$layout.ColumnCount = 1
$layout.RowCount = 4
[void]$layout.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Percent,100)))
[void]$layout.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::Absolute,103)))
[void]$layout.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::Absolute,65)))
[void]$layout.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::Percent,100)))
[void]$layout.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::Absolute,41)))
foreach ($control in @($hero,$statusPanel,$tabs,$footer)) {
  $control.Dock = 'Fill'
  $control.Margin = New-Object System.Windows.Forms.Padding(0)
}
$layout.Controls.Add($hero,0,0)
$layout.Controls.Add($statusPanel,0,1)
$layout.Controls.Add($tabs,0,2)
$layout.Controls.Add($footer,0,3)
$form.Controls.Add($layout)

$statusButton.Add_Click({ Refresh-Status })
$form.Add_Shown({ Refresh-Status })
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 15000
$timer.Add_Tick({ Refresh-Status })
$timer.Start()
$form.Add_FormClosed({ $timer.Stop(); $timer.Dispose() })

if ($TestInteractions) {
  $form.Show()
  [System.Windows.Forms.Application]::DoEvents()
  try {
    foreach ($key in $script:Actions.Keys) {
      $button = $script:Buttons[$key]
      if ($null -eq $button) { throw ('Botao nao encontrado: ' + $key) }
      $tabs.SelectedTab = $button.Parent
      [System.Windows.Forms.Application]::DoEvents()
      $button.PerformClick()
    }
    if ($script:InteractionLog.Count -ne $script:Actions.Count) {
      throw ('Eventos nao executados: ' + ($script:Actions.Count - $script:InteractionLog.Count))
    }
    foreach ($key in $script:Actions.Keys) {
      if ($script:InteractionLog -notcontains $key) { throw ('Evento ausente: ' + $key) }
    }
    @{ ok = $true; dryRun = $true; actionsTested = $script:InteractionLog.Count } | ConvertTo-Json -Compress
  } finally {
    $form.Close()
    $form.Dispose()
  }
} elseif ($Screenshot) {
  $tabs.SelectedIndex = $ScreenshotTab
  $form.Show()
  [System.Windows.Forms.Application]::DoEvents()
  $bitmap = New-Object System.Drawing.Bitmap($form.Width,$form.Height)
  try {
    $form.DrawToBitmap($bitmap,(New-Object System.Drawing.Rectangle(0,0,$form.Width,$form.Height)))
    $bitmap.Save($Screenshot,[System.Drawing.Imaging.ImageFormat]::Png)
  } finally { $bitmap.Dispose(); $form.Close(); $form.Dispose() }
} else {
  [void]$form.ShowDialog()
  $form.Dispose()
}
