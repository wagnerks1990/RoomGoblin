param(
  [string]$Configuration = 'Release',
  [string]$Runtime = 'win-x64'
)

$ErrorActionPreference = 'Stop'
$serviceProject = Join-Path $PSScriptRoot '..\RoomGoblin.Agent.Service\RoomGoblin.Agent.Service.csproj'
$sessionProject = Join-Path $PSScriptRoot '..\RoomGoblin.Agent.Session\RoomGoblin.Agent.Session.csproj'
$bootstrapProject = Join-Path $PSScriptRoot '..\RoomGoblin.Agent.Bootstrap\RoomGoblin.Agent.Bootstrap.csproj'
$updaterProject = Join-Path $PSScriptRoot '..\RoomGoblin.Agent.Updater\RoomGoblin.Agent.Updater.csproj'
$out = Join-Path $PSScriptRoot '..\artifacts\native-agent'
$versionFile = Join-Path $PSScriptRoot '..\..\VERSION'
if (!(Test-Path $versionFile)) { throw "VERSION file not found: $versionFile" }
$roomGoblinVersion = (Get-Content $versionFile -Raw).Trim()
if (!$roomGoblinVersion) { throw 'VERSION file is empty' }

function Invoke-DotNet {
  param(
    [Parameter(Mandatory=$true)]
    [string[]]$DotNetArgs
  )

  & dotnet @DotNetArgs
  if ($LASTEXITCODE -ne 0) {
    throw "dotnet $($DotNetArgs -join ' ') failed with exit code $LASTEXITCODE"
  }
}

if (Test-Path $out) {
  Remove-Item $out -Recurse -Force
}
New-Item $out -ItemType Directory -Force | Out-Null

foreach ($project in @($serviceProject,$sessionProject,$bootstrapProject,$updaterProject)) {
  Invoke-DotNet -DotNetArgs @('restore',$project,'--locked-mode','-p:ContinuousIntegrationBuild=true')
  Invoke-DotNet -DotNetArgs @(
    'publish',
    $project,
    '-c', $Configuration,
    '-r', $Runtime,
    '--self-contained', 'true',
    '--no-restore',
    '-p:ContinuousIntegrationBuild=true',
    '-p:PublishSingleFile=true',
    "-p:Version=$roomGoblinVersion",
    "-p:InformationalVersion=$roomGoblinVersion",
    '-o', $out
  )
}

$serviceExe = Join-Path $out 'RoomGoblinAgent.exe'
$sessionExe = Join-Path $out 'RoomGoblinSessionAgent.exe'
$bootstrapExe = Join-Path $out 'RoomGoblinAgentBootstrap.exe'
$updaterExe = Join-Path $out 'RoomGoblinAgentUpdater.exe'

foreach ($required in @($serviceExe,$sessionExe,$bootstrapExe,$updaterExe)) {
  if (!(Test-Path $required)) {
    throw "Publish did not produce required executable: $required"
  }
}

Write-Host "Published RoomGoblin native agent $roomGoblinVersion binaries to $out"
Get-Item $serviceExe,$sessionExe,$bootstrapExe,$updaterExe | Select-Object Name,Length,LastWriteTime
