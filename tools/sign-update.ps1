param([switch]$Initialize,[string]$Manifest,[string]$Signature,[string]$TrustPath=(Join-Path $PSScriptRoot '..\update-trust.json'))
$ErrorActionPreference='Stop'
$editor=Join-Path $env:LOCALAPPDATA 'PainelHB-Editor'
$keyFile=Join-Path $editor 'release-key.dpapi.xml'
$rsa=New-Object System.Security.Cryptography.RSACryptoServiceProvider -ArgumentList 3072
$rsa.PersistKeyInCsp=$false
try {
  if($Initialize){
    if(Test-Path -LiteralPath $keyFile){throw 'A chave do editor ja existe; nao foi substituida.'}
    if(Test-Path -LiteralPath $TrustPath){throw 'A confianca ja foi configurada; nao foi substituida.'}
    [void][IO.Directory]::CreateDirectory($editor)
    $protected=ConvertTo-SecureString -String $rsa.ToXmlString($true) -AsPlainText -Force
    $protected | Export-Clixml -LiteralPath $keyFile
    $public=$rsa.ToXmlString($false)
    $sha=[Security.Cryptography.SHA256]::Create()
    try {$keyId=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($public)))).Replace('-','').ToLowerInvariant()} finally {$sha.Dispose()}
    $keys=@{};$keys[$keyId]=$public
    @{algorithm='RSA-SHA256';keys=$keys} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $TrustPath -Encoding UTF8
    Write-Output 'Chave privada protegida pelo Windows no perfil do editor; somente a chave publica foi incluida no painel.'
    exit 0
  }
  if(-not $Manifest -or -not $Signature){throw 'Informe manifesto e destino da assinatura.'}
  if($env:HB_UPDATE_RSA_XML){$private=$env:HB_UPDATE_RSA_XML}
  else {
    $secure=Import-Clixml -LiteralPath $keyFile
    $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {$private=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
  }
  $rsa.FromXmlString($private);$private=$null
  if($rsa.KeySize -lt 3072){throw 'Chave insuficiente.'}
  $public=$rsa.ToXmlString($false)
  $sha=[Security.Cryptography.SHA256]::Create()
  try {$keyId=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($public)))).Replace('-','').ToLowerInvariant()} finally {$sha.Dispose()}
  $trust=Get-Content -LiteralPath $TrustPath -Raw -Encoding UTF8 | ConvertFrom-Json
  if($trust.keys.PSObject.Properties.Name -notcontains $keyId){throw 'Chave de assinatura nao corresponde ao editor do aplicativo.'}
  $bytes=$rsa.SignData([IO.File]::ReadAllBytes($Manifest),'SHA256')
  @{algorithm='RSA-SHA256';key_id=$keyId;signature=[Convert]::ToBase64String($bytes)} | ConvertTo-Json | Set-Content -LiteralPath $Signature -Encoding UTF8
  Write-Output 'Manifesto assinado; nenhum segredo incluido nos artefatos.'
} finally {$rsa.Dispose()}
