param([Parameter(Mandatory=$true)][string]$Manifest,[Parameter(Mandatory=$true)][string]$Signature,[Parameter(Mandatory=$true)][string]$Trust)
$ErrorActionPreference='Stop'
try {
  $sig=Get-Content -LiteralPath $Signature -Raw -Encoding UTF8 | ConvertFrom-Json
  $keys=Get-Content -LiteralPath $Trust -Raw -Encoding UTF8 | ConvertFrom-Json
  if($sig.algorithm -ne 'RSA-SHA256'){throw 'Algoritmo invalido.'}
  $key=$keys.keys.PSObject.Properties | Where-Object Name -eq $sig.key_id | Select-Object -First 1
  if(-not $key){throw 'Editor nao reconhecido.'}
  $rsa=New-Object System.Security.Cryptography.RSACryptoServiceProvider
  $rsa.PersistKeyInCsp=$false
  try {
    $rsa.FromXmlString([string]$key.Value)
    if($rsa.KeySize -lt 3072){throw 'Chave insuficiente.'}
    $valid=$rsa.VerifyData([IO.File]::ReadAllBytes($Manifest),'SHA256',[Convert]::FromBase64String($sig.signature))
    if(-not $valid){throw 'Assinatura invalida.'}
  } finally {$rsa.Dispose()}
  Write-Output 'VERIFIED'
  exit 0
} catch {Write-Output 'SIGNATURE_REJECTED';exit 1}
