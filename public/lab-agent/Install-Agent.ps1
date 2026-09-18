[CmdletBinding()]
param(
  [Parameter(Mandatory)][uri]$HubUrl,
  [uri]$FallbackHubUrl,
  [Parameter(Mandatory)][ValidatePattern('^[a-zA-Z0-9._-]{1,120}$')][string]$AgentId,
  [Parameter(Mandatory)][string]$EnrollmentToken,
  [string]$TrustedPublisherThumbprint='',
  [switch]$AllowHttp,
  [switch]$AllowHttpFallback
)
$ErrorActionPreference='Stop'
function Test-TrustedPublisher($Signature,[string]$Expected){
  if(!$Expected){return $true}
  $expectedHex=($Expected -replace '[^0-9A-Fa-f]','').ToUpperInvariant()
  if($Signature.Status -ne 'Valid' -or !$Signature.SignerCertificate -or $expectedHex.Length -notin @(40,64)){return $false}
  if($expectedHex.Length -eq 64){$sha=[Security.Cryptography.SHA256]::Create();try{$actual=([BitConverter]::ToString($sha.ComputeHash($Signature.SignerCertificate.RawData))).Replace('-','')}finally{$sha.Dispose()}}
  else{$actual=($Signature.SignerCertificate.Thumbprint -replace '[^0-9A-Fa-f]','').ToUpperInvariant()}
  return $actual -eq $expectedHex
}
if(!$HubUrl.IsAbsoluteUri -or !$HubUrl.Host -or $HubUrl.UserInfo -or $HubUrl.Scheme -notin @('http','https')){throw 'HubUrl must be an absolute http:// or https:// URL without embedded credentials.'}
if($HubUrl.Scheme -eq 'http' -and !$AllowHttp){throw 'HTTP enrollment requires explicit -AllowHttp acknowledgement and must be limited to an isolated trusted classroom network.'}
if($FallbackHubUrl){
  if(!$FallbackHubUrl.IsAbsoluteUri -or !$FallbackHubUrl.Host -or $FallbackHubUrl.UserInfo -or $FallbackHubUrl.Scheme -notin @('http','https')){throw 'FallbackHubUrl must be an absolute http:// or https:// URL without embedded credentials.'}
  if($FallbackHubUrl.Scheme -eq 'http' -and !$AllowHttpFallback){throw 'HTTP fallback requires explicit -AllowHttpFallback acknowledgement and must be limited to an isolated trusted classroom network.'}
}
if(!([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Run this installer in an elevated PowerShell window.'}
$root=Join-Path $env:ProgramData 'ClassroomControlHub';New-Item $root -ItemType Directory -Force|Out-Null
& icacls.exe $root /inheritance:r /grant:r 'SYSTEM:(OI)(CI)(F)' 'Administrators:(OI)(CI)(F)' | Out-Null
if($LASTEXITCODE -ne 0){throw 'Could not secure the RoomGoblin agent directory.'}
$agent=Join-Path $root 'ClassroomHubAgent.ps1';$config=Join-Path $root 'lab-agent.json'
$origin=$HubUrl.GetLeftPart([UriPartial]::Authority)
$fallbackOrigin=if($FallbackHubUrl){$FallbackHubUrl.GetLeftPart([UriPartial]::Authority)}else{''}
try{$manifest=Invoke-RestMethod ($origin+'/api/v1/lab-agent/manifest') -TimeoutSec 20}
catch{
  $detail=$_.Exception.Message
  if($HubUrl.Scheme -eq 'https'){$detail+=' Verify that the Hub certificate is trusted by this computer.'}
  throw "RoomGoblin package preflight failed: $detail"
}
if(!$manifest.sha256 -or $manifest.sha256 -notmatch '^[a-fA-F0-9]{64}$'){throw 'Hub returned an invalid lab-agent manifest'}
$stage=Join-Path $root ('ClassroomHubAgent.'+[Guid]::NewGuid().ToString('N')+'.download.ps1')
$agentUri=$origin+'/lab-agent/ClassroomHubAgent.ps1'
try{Invoke-WebRequest $agentUri -OutFile $stage -TimeoutSec 30}catch{Remove-Item $stage -Force -ErrorAction SilentlyContinue;throw "Agent download failed: $($_.Exception.Message)"}
& icacls.exe $stage /inheritance:r /grant:r 'SYSTEM:(F)' 'Administrators:(F)' | Out-Null
if($LASTEXITCODE -ne 0){Remove-Item $stage -Force -ErrorAction SilentlyContinue;throw 'Could not secure the staged agent package.'}
$actualHash=(Get-FileHash -LiteralPath $stage -Algorithm SHA256).Hash
if($actualHash -ne ([string]$manifest.sha256).ToUpperInvariant()){Remove-Item $stage -Force -ErrorAction SilentlyContinue;throw 'Downloaded agent failed SHA-256 verification'}
$signature=Get-AuthenticodeSignature $stage
if(!(Test-TrustedPublisher $signature $TrustedPublisherThumbprint)){Remove-Item $stage -Force -ErrorAction SilentlyContinue;throw 'Downloaded agent does not have the required valid publisher signature'}
[void][Reflection.Assembly]::LoadWithPartialName('System.Security')
$tokenBytes=[Text.Encoding]::UTF8.GetBytes($EnrollmentToken)
$protectedToken=[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($tokenBytes,$null,[Security.Cryptography.DataProtectionScope]::LocalMachine))
$configTemp=Join-Path $root ('lab-agent.'+[Guid]::NewGuid().ToString('N')+'.tmp')
try{
  $json=@{hubUrl=$origin;fallbackHubUrl=$fallbackOrigin;agentId=$AgentId;enrollmentToken='';enrollmentTokenProtected=$protectedToken;credentialProtected='';trustedPublisherThumbprint=$TrustedPublisherThumbprint}|ConvertTo-Json
  [IO.File]::WriteAllText($configTemp,$json,[Text.UTF8Encoding]::new($false))
  & icacls.exe $configTemp /inheritance:r /grant:r 'SYSTEM:(F)' 'Administrators:(F)' | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Could not secure the staged agent configuration.'}
  if(Test-Path $config){Remove-Item ($config+'.bak') -Force -ErrorAction SilentlyContinue;[IO.File]::Replace($configTemp,$config,$config+'.bak',$true)}else{[IO.File]::Move($configTemp,$config)}
  $configBackup=$config+'.bak';if(Test-Path -LiteralPath $configBackup){Remove-Item -LiteralPath $configBackup -Force -ErrorAction Stop}
  if(Test-Path $agent){Remove-Item ($agent+'.previous') -Force -ErrorAction SilentlyContinue;[IO.File]::Replace($stage,$agent,$agent+'.previous',$true)}else{[IO.File]::Move($stage,$agent)}
}finally{Remove-Item $configTemp,$stage -Force -ErrorAction SilentlyContinue}
foreach($installedFile in @($agent,$config)){
  & icacls.exe $installedFile /inheritance:r /grant:r 'SYSTEM:(F)' 'Administrators:(F)' | Out-Null
  if($LASTEXITCODE -ne 0){throw "Could not secure installed agent file: $installedFile"}
}
$action="-NoProfile -ExecutionPolicy AllSigned -File `"$agent`" -ConfigPath `"$config`""
if(!$TrustedPublisherThumbprint){$action=$action -replace 'AllSigned','RemoteSigned'}
$taskAction=New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument $action
$taskPrincipal=New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$taskTrigger=New-ScheduledTaskTrigger -AtStartup
$taskSettings=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'RoomGoblin Agent' -Action $taskAction -Principal $taskPrincipal -Trigger $taskTrigger -Settings $taskSettings -Force|Out-Null
if(!(Get-EventLog -LogName Application -Source 'ClassroomHubAgent' -Newest 1 -ErrorAction SilentlyContinue)){New-EventLog -LogName Application -Source 'ClassroomHubAgent' -ErrorAction SilentlyContinue}
& schtasks.exe /Run /TN 'RoomGoblin Agent' | Out-Null
if($LASTEXITCODE -ne 0){throw "Agent task was installed but could not be started (schtasks exit code $LASTEXITCODE)."}
Write-Host "RoomGoblin agent installed for $AgentId. Enrollment completes when it connects."
