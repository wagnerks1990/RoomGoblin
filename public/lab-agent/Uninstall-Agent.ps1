[CmdletBinding()]
param([switch]$KeepConfiguration)
$ErrorActionPreference='Stop'
if(!([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Run this uninstaller in an elevated PowerShell window.'}
$task=Get-ScheduledTask -TaskName 'RoomGoblin Agent' -ErrorAction SilentlyContinue
if($task){
  & schtasks.exe /End /TN 'RoomGoblin Agent' 2>$null
  if($LASTEXITCODE -notin @(0,1)){throw "Could not stop the agent task (schtasks exit code $LASTEXITCODE)."}
  & schtasks.exe /Delete /TN 'RoomGoblin Agent' /F 2>$null
  if($LASTEXITCODE -ne 0){throw "Could not delete the agent task (schtasks exit code $LASTEXITCODE)."}
}
Get-ScheduledTask -TaskName 'RoomGoblin Interactive *' -ErrorAction SilentlyContinue|Unregister-ScheduledTask -Confirm:$false -ErrorAction SilentlyContinue
$root=Join-Path $env:ProgramData 'ClassroomControlHub'
if(Test-Path -LiteralPath $root){
  $nativeService=Get-Service -Name 'RoomGoblinAgent' -ErrorAction SilentlyContinue
  # ProgramData\ClassroomControlHub is shared with the native service. Remove
  # only files owned by this scheduled-task agent and never recursively erase
  # native update/health state or its active configuration.
  foreach($name in @('ClassroomHubAgent.ps1','ClassroomHubAgent.ps1.previous','agent-health.json','interactive','history-temp','updates')){
    $owned=Join-Path $root $name;if(Test-Path -LiteralPath $owned){Remove-Item -LiteralPath $owned -Recurse -Force -ErrorAction Stop}
  }
  $config=Join-Path $root 'lab-agent.json'
  if(!$KeepConfiguration -and !$nativeService -and (Test-Path -LiteralPath $config)){Remove-Item -LiteralPath $config -Force -ErrorAction Stop}
  if(($KeepConfiguration -or $nativeService) -and (Test-Path -LiteralPath $config)){& icacls.exe $config /inheritance:r /grant:r 'SYSTEM:(F)' 'Administrators:(F)'|Out-Null;if($LASTEXITCODE -ne 0){throw 'Configuration was retained but its private ACL could not be verified.'}}
  if(!(Get-ChildItem -LiteralPath $root -Force -ErrorAction SilentlyContinue)){Remove-Item -LiteralPath $root -Force -ErrorAction Stop}
}
Write-Host 'RoomGoblin agent removed. Revoke its credential in the web controller.'
