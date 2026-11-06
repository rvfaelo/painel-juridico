# Extensao da Central existente. Trabalho em processo oculto; UI permanece responsiva.
# Este script e carregado apenas pela central-painel-hb.ps1.
$updatePage = New-Page 'Atualizações'
$script:UpdateProcess=$null
$script:UpdateJob=$null
$script:LastUpdateResult=$null
$script:UpdateAction=''

$installedLabel=Add-Label $updatePage ('Versão instalada: '+(Get-Content -LiteralPath (Join-Path $script:Root 'package.json') -Raw | ConvertFrom-Json).version) 25 16 750 25 $true
[void](Add-Label $updatePage 'Repositório oficial do GitHub (dono/projeto)' 25 48 750 22)
$repoBox=New-Object System.Windows.Forms.TextBox
$repoBox.Location=New-Object System.Drawing.Point(25,72)
$repoBox.Size=New-Object System.Drawing.Size(610,26)
$repoBox.Text=(Get-Content -LiteralPath (Join-Path $script:Root 'update-config.json') -Raw | ConvertFrom-Json).repository
$repoBox.Anchor='Top,Left,Right'
$updatePage.Controls.Add($repoBox)
$latestLabel=Add-Label $updatePage 'Versão publicada: ainda não consultada' 25 109 750 25 $true
$connectionLabel=Add-Label $updatePage 'Sem consulta ao GitHub nesta sessão. O painel pode ser usado offline.' 25 139 750 24
$dependencyLabel=Add-Label $updatePage 'Dependências: aguardando manifesto assinado.' 25 168 750 24

$releaseNotes=New-Object System.Windows.Forms.TextBox
$releaseNotes.Location=New-Object System.Drawing.Point(25,202)
$releaseNotes.Size=New-Object System.Drawing.Size(790,95)
$releaseNotes.Multiline=$true;$releaseNotes.ReadOnly=$true;$releaseNotes.ScrollBars='Vertical'
$releaseNotes.BackColor=$script:Colors.White
$releaseNotes.Anchor='Top,Left,Right'
$releaseNotes.Text='As novidades e o histórico de versões aparecerão aqui.'
$updatePage.Controls.Add($releaseNotes)

$updateProgress=New-Object System.Windows.Forms.ProgressBar
$updateProgress.Location=New-Object System.Drawing.Point(25,308)
$updateProgress.Size=New-Object System.Drawing.Size(790,13)
$updateProgress.Anchor='Top,Left,Right'
$updatePage.Controls.Add($updateProgress)
$updateState=Add-Label $updatePage 'Nenhuma instalação em andamento.' 25 328 790 28

function New-UpdateButton([string]$Label,[string]$Action,[int]$X,[int]$Width){
  $b=New-Object System.Windows.Forms.Button
  $b.Text=$Label;$b.Location=New-Object System.Drawing.Point($X,366)
  $b.Size=New-Object System.Drawing.Size($Width,36)
  $b.FlatStyle='Flat';$b.FlatAppearance.BorderColor=$script:Colors.Border
  $b.BackColor=$script:Colors.White;$b.ForeColor=$script:Colors.Dark
  $b.Font=$script:FontSmall;$b.Tag=$Action
  $b.Add_Click({Start-UpdateOperation ([string]$this.Tag)})
  $updatePage.Controls.Add($b)
  return $b
}
$checkUpdates=New-UpdateButton 'Verificar atualizações' 'check' 25 164
$installUpdate=New-UpdateButton 'Atualizar painel' 'install' 197 138
$releaseHistory=New-UpdateButton 'Histórico de versões' 'history' 343 151
$restoreUpdate=New-UpdateButton 'Restaurar versão anterior' 'restore' 502 181
$cancelUpdate=New-UpdateButton 'Cancelar' 'cancel' 691 100
$installUpdate.Enabled=$false;$cancelUpdate.Enabled=$false
$installUpdate.BackColor=$script:Colors.Accent;$installUpdate.ForeColor=$script:Colors.White
$updateControls=@($checkUpdates,$installUpdate,$releaseHistory,$restoreUpdate)

function Get-UpdateStateDirectory {
  $sha=[Security.Cryptography.SHA256]::Create()
  try {
    $normalized=$script:Root.ToLowerInvariant()
    $identity=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($normalized)))).Replace('-','').ToLowerInvariant().Substring(0,20)
  } finally {$sha.Dispose()}
  return Join-Path $env:LOCALAPPDATA ('PainelHB\updates\'+$identity)
}
$script:UpdateStateDirectory=Get-UpdateStateDirectory
$savedRepo=Join-Path $script:UpdateStateDirectory 'repository.json'
if(Test-Path -LiteralPath $savedRepo){try{$repoBox.Text=(Get-Content -LiteralPath $savedRepo -Raw | ConvertFrom-Json).repository}catch{}}
$repoBox.Add_TextChanged({$script:LastUpdateResult=$null;$installUpdate.Enabled=$false})
function Test-UpdateRecovery {
  $journal=Join-Path $script:UpdateStateDirectory 'transaction.json'
  if(-not(Test-Path -LiteralPath $journal)){return $false}
  try{$record=Get-Content -LiteralPath $journal -Raw | ConvertFrom-Json;return $record.status -notin @('restored','rolled_back')}
  catch{return $false}
}
$restoreUpdate.Enabled=Test-UpdateRecovery

function Get-UpdatePython {
  $localPython=Join-Path $script:Root '.venv\Scripts\python.exe'
  if(-not(Test-Path -LiteralPath $localPython -PathType Leaf)){throw 'Prepare o ambiente Python pela aba Instalação antes de usar o atualizador.'}
  $base= & $localPython -c 'import sys;print(sys._base_executable)'
  if($LASTEXITCODE -ne 0 -or -not(Test-Path -LiteralPath ([string]$base) -PathType Leaf)){throw 'Python-base indisponível. Repare o ambiente pela aba Instalação.'}
  return [string]$base
}

function Set-UpdateBusy([bool]$Busy){
  foreach($b in $updateControls){$b.Enabled=-not $Busy}
  $repoBox.ReadOnly=$Busy;$cancelUpdate.Enabled=$Busy
  # Impede que a propria Central inicie outra instancia durante a substituicao.
  foreach($b in $script:Buttons.Values){$b.Enabled=(-not $Busy -or $script:UpdateAction -in @('check','history'))}
  if(-not $Busy){$installUpdate.Enabled=($script:LastUpdateResult -and $script:LastUpdateResult.available)}
}

function Start-UpdateOperation([string]$Action){
  if($script:InteractionMode){[void]$script:InteractionLog.Add('release-'+$Action);return}
  if($Action -eq 'cancel'){
    if($script:UpdateJob){[IO.File]::WriteAllText((Join-Path $script:UpdateJob 'cancel'),'cancel')}
    $updateState.Text='Cancelamento solicitado; aguarde um ponto seguro.'
    return
  }
  if($script:UpdateProcess -and -not $script:UpdateProcess.HasExited){return}
  try {
    if($Action -in @('install','restore')){
      if($Action -eq 'install' -and (-not $script:LastUpdateResult -or -not $script:LastUpdateResult.available)){throw 'Verifique e confira a versão disponível antes de instalar.'}
      $operation=if($Action -eq 'install'){'instalar a versão '+$script:LastUpdateResult.latest}else{'restaurar o código anterior'}
      if(-not(Confirm ('Para '+$operation+', o serviço será interrompido temporariamente. Feche as abas do painel para evitar edições durante a troca. Continuar?') 'Atualização do Painel H.B')){return}
      if(-not(Confirm 'Você exportou um backup protegido dos dados deste navegador em Fontes e ajustes? O atualizador não copia o IndexedDB. Se usa somente o serviço integrado, confirme que não existem dados exclusivos no modo simples. Não informe a senha aqui.' 'Proteção dos dados do navegador')){return}
    }
    $python=Get-UpdatePython
    if($repoBox.Text -notmatch '^(https://github\.com/)?[A-Za-z0-9-]+/[A-Za-z0-9_.-]+/?$'){throw 'Informe o repositório como dono/projeto.'}
    $job=Join-Path $script:UpdateStateDirectory ('jobs\'+[guid]::NewGuid().ToString('N'))
    [void][IO.Directory]::CreateDirectory($job)
    $updater=Join-Path $script:Root 'updates\updater.py'
    # Todos os argumentos sao locais e validados; nenhuma expressao remota e executada.
    $arguments='"'+$updater+'" '+$Action+' --root "'+$script:Root+'" --state "'+$script:UpdateStateDirectory+'" --job "'+$job+'" --repository "'+$repoBox.Text+'"'
    if($Action -in @('install','restore')){$arguments+=' --confirmed --indexeddb-confirmed'}
    if($Action -eq 'install'){
      $target=[string]$script:LastUpdateResult.latest
      if($target -notmatch '^v?\d+\.\d+\.\d+(\+[A-Za-z0-9.-]+)?$'){throw 'Versão selecionada inválida.'}
      $arguments+=' --target-version "'+$target+'"'
    }
    if($Action -in @('check','history') -and $script:ManualUpdateCheck){$arguments+=' --manual'}
    $script:UpdateJob=$job;$script:UpdateAction=$Action
    $script:UpdateProcess=Start-Process -FilePath $python -ArgumentList $arguments -WorkingDirectory $script:Root -WindowStyle Hidden -PassThru
    Set-UpdateBusy $true
    $updateState.Text='Operação iniciada. Aguarde a confirmação do resultado.'
    $updateProgress.Value=0
  } catch {$updateState.Text=$_.Exception.Message}
}

$script:ManualUpdateCheck=$true
$updateTimer=New-Object System.Windows.Forms.Timer
$updateTimer.Interval=400
$updateTimer.Add_Tick({
  if(-not $script:UpdateProcess){return}
  $progressFile=Join-Path $script:UpdateJob 'progress.json'
  try {
    if(Test-Path -LiteralPath $progressFile){
      $p=Get-Content -LiteralPath $progressFile -Raw -Encoding UTF8 | ConvertFrom-Json
      $updateProgress.Value=[Math]::Max(0,[Math]::Min(100,[int]$p.percent))
      $updateState.Text=[string]$p.stage
      $cancelUpdate.Enabled=($p.cancellable -ne $false -and -not $p.finished)
      if($p.finished){
        if($p.ok){
          if($script:UpdateAction -in @('check','history')){
            $script:LastUpdateResult=$p.result
            $connectionLabel.Text=if($p.result.cached){'GitHub: última consulta válida reutilizada para respeitar o intervalo.'}else{'GitHub: conectado. Consulta concluída.'}
            $latestLabel.Text=if($p.result.latest){'Publicada: '+$p.result.latest+' · '+$p.result.published_at}else{'Nenhuma versão estável publicada neste repositório.'}
            $dependencyLabel.Text=if($p.result.dependency_changes.Count){'Dependências: '+($p.result.dependency_changes -join ', ')}else{'Dependências: nenhuma alteração identificada para a versão disponível.'}
            if($script:UpdateAction -eq 'history'){$releaseNotes.Text=($p.result.history | ForEach-Object {$_.version+' · '+$_.date+"`r`n"+$_.changelog+"`r`n"}) -join "`r`n"}
            else{$releaseNotes.Text=if($p.result.changelog){$p.result.changelog}else{'As novidades aparecerão após a publicação de uma Release.'}}
            if($p.result.available){$script:FooterLabel.Text='Atualização disponível: '+$p.result.latest+'. Abra a aba Atualizações para conferir.'}
          }else{
            $updateState.Text=$p.result.message
            $installedLabel.Text='Versão instalada: '+$p.result.version
            $script:LastUpdateResult=$null
            $script:FooterLabel.Text='Operação validada. Backup: '+$p.result.backup
            $releaseNotes.Text=$p.result.message+"`r`nBackup: "+$p.result.backup+"`r`nFeche e reabra a Central para carregar os controles da versão instalada."
          }
        }else{$updateState.Text=$p.message;$connectionLabel.Text='Operação não concluída; o painel local não depende do GitHub.'}
        $script:UpdateProcess.Dispose();$script:UpdateProcess=$null
        Set-UpdateBusy $false
        $restoreUpdate.Enabled=Test-UpdateRecovery
      }
    }elseif($script:UpdateProcess.HasExited){
      $updateState.Text='O atualizador terminou sem confirmar o resultado. Confira a recuperação antes de tentar novamente.'
      $script:UpdateProcess.Dispose();$script:UpdateProcess=$null;Set-UpdateBusy $false
    }
  }catch{$updateState.Text='Aguardando o atualizador concluir a gravação do estado…'}
})
$updateTimer.Start()
$form.Add_FormClosing({
  param($sender,$eventArgs)
  if($script:UpdateProcess -and -not $script:UpdateProcess.HasExited){
    $eventArgs.Cancel=$true
    $tabs.SelectedTab=$updatePage
    $updateState.Text='Aguarde a operação terminar. Use Cancelar antes da instalação, quando disponível.'
  }
})
$form.Add_FormClosed({$updateTimer.Stop();$updateTimer.Dispose()})
$form.Add_Shown({
  if(-not $script:InteractionMode -and -not $Screenshot){
    $script:ManualUpdateCheck=$false
    Start-UpdateOperation 'check'
    $script:ManualUpdateCheck=$true
  }
})
