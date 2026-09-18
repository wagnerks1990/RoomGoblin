#Requires -Version 5.1
<#
.SYNOPSIS
Installs the complete RoomGoblin Veyon Windows pilot on one disposable endpoint.

.DESCRIPTION
This is intentionally not a classroom-wide deployment tool. It requires a
verified pilot installer, a verified known-good rollback installer and an
explicit disposable-pilot acknowledgement. On failed acceptance it reinstalls
the rollback package and restores the exported Veyon configuration.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$PilotInstaller,
    [Parameter(Mandatory = $true)][ValidatePattern('^[A-Fa-f0-9]{64}$')][string]$PilotSha256,
    [Parameter(Mandatory = $true)][string]$RollbackInstaller,
    [Parameter(Mandatory = $true)][ValidatePattern('^[A-Fa-f0-9]{64}$')][string]$RollbackSha256,
    [Parameter(Mandatory = $true)][string]$BackupDirectory,
    [string]$InstalledVeyonDirectory = "$env:ProgramFiles\Veyon",
    [switch]$IncludeMaster,
    [Parameter(Mandatory = $true)][switch]$AcceptDisposablePilotRisk
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Run this pilot from an elevated PowerShell session.'
    }
}

function Resolve-CheckedFile([string]$Path, [string]$ExpectedHash, [string]$Label) {
    $resolved = (Resolve-Path -LiteralPath $Path).Path
    if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) {
        throw "$Label is not a regular file: $resolved"
    }
    $actual = (Get-FileHash -LiteralPath $resolved -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $ExpectedHash.ToLowerInvariant()) {
        throw "$Label SHA-256 mismatch. Expected $ExpectedHash; got $actual"
    }
    return $resolved
}

function Invoke-VeyonCli([string]$Cli, [string[]]$Arguments, [string]$OutputFile = '') {
    $output = & $Cli @Arguments 2>&1
    $code = $LASTEXITCODE
    if ($OutputFile) {
        $output | Out-File -LiteralPath $OutputFile -Encoding utf8
    }
    if ($code -ne 0) {
        throw "veyon-cli failed ($code): $($Arguments -join ' ')"
    }
    return @($output | ForEach-Object { "$_" })
}

function Invoke-Installer([string]$Installer, [bool]$InstallMaster) {
    $arguments = @('/S', '/NoStartMenuFolder')
    if (-not $InstallMaster) { $arguments += '/NoMaster' }
    $process = Start-Process -FilePath $Installer -ArgumentList $arguments -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        throw "Veyon installer failed with exit code $($process.ExitCode)."
    }
}

function Remove-PilotFirewallRules {
    Get-NetFirewallRule -DisplayName 'RoomGoblinVeyonIG_*' -ErrorAction SilentlyContinue |
        Remove-NetFirewallRule -ErrorAction Stop
}

function Test-Pilot([string]$Cli) {
    $version = Invoke-VeyonCli $Cli @('--version')
    if (($version -join "`n") -notmatch '4\.11\.2') {
        throw "Pilot installed an unexpected Veyon version: $($version -join ' ')"
    }
    $plugins = Invoke-VeyonCli $Cli @('plugin', 'list')
    foreach ($required in @('ClassroomChat', 'RemoteFileBrowser', 'RoomGoblinWebBridge', 'InternetGuard')) {
        if ($plugins -notcontains $required) { throw "Pilot plugin did not load: $required" }
    }
    $features = Invoke-VeyonCli $Cli @('feature', 'list')
    foreach ($required in @(
        'ClassroomChat', 'RemoteFileBrowser', 'RoomGoblinKeySequence',
        'RoomGoblinBrowserControl', 'RoomGoblinClipboardWrite',
        'RoomGoblinClipboardRead', 'RoomGoblinTerminal', 'InternetGuard',
        'InternetGuardBlock', 'InternetGuardAllow'
    )) {
        if ($features -notcontains $required) { throw "Pilot feature did not load: $required" }
    }
    Start-Service -Name VeyonService
    $service = Get-Service -Name VeyonService
    if ($service.Status -ne 'Running') { throw 'VeyonService did not reach Running state.' }
    return @{ version = $version; plugins = $plugins; features = $features }
}

if (-not $AcceptDisposablePilotRisk) {
    throw 'The disposable-pilot acknowledgement switch is required.'
}
Assert-Administrator
if (-not [Environment]::Is64BitOperatingSystem) { throw 'The win64 pilot requires 64-bit Windows.' }
if (Test-Path -LiteralPath $BackupDirectory) { throw 'BackupDirectory must not already exist.' }

$pilot = Resolve-CheckedFile $PilotInstaller $PilotSha256 'Pilot installer'
$rollback = Resolve-CheckedFile $RollbackInstaller $RollbackSha256 'Rollback installer'
$installRoot = [IO.Path]::GetFullPath($InstalledVeyonDirectory)
$oldCli = Join-Path $installRoot 'veyon-cli.exe'
if (-not (Test-Path -LiteralPath $oldCli -PathType Leaf)) {
    throw "Existing Veyon CLI was not found at $oldCli"
}
$installMaster = [bool]$IncludeMaster -or (Test-Path -LiteralPath (Join-Path $installRoot 'veyon-master.exe') -PathType Leaf)

$backup = New-Item -ItemType Directory -Path $BackupDirectory
$backup = $backup.FullName
& icacls.exe $backup /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict the pilot evidence directory ACL.' }
$configBackup = Join-Path $backup 'veyon-config.json'
$stateBackup = Join-Path $backup 'preflight'
New-Item -ItemType Directory -Path $stateBackup | Out-Null

Invoke-VeyonCli $oldCli @('config', 'export', $configBackup) | Out-Null
Invoke-VeyonCli $oldCli @('--version') (Join-Path $stateBackup 'version.txt') | Out-Null
Invoke-VeyonCli $oldCli @('plugin', 'list') (Join-Path $stateBackup 'plugins.txt') | Out-Null
Invoke-VeyonCli $oldCli @('feature', 'list') (Join-Path $stateBackup 'features.txt') | Out-Null
Copy-Item -LiteralPath $rollback -Destination (Join-Path $backup 'rollback-installer.exe')
Get-FileHash -LiteralPath $pilot,$rollback -Algorithm SHA256 |
    Format-List | Out-File -LiteralPath (Join-Path $backup 'installer-hashes.txt') -Encoding utf8
Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber,OSArchitecture |
    Format-List | Out-File -LiteralPath (Join-Path $backup 'windows.txt') -Encoding utf8

$pilotAccepted = $false
try {
    Stop-Service -Name VeyonService -Force -ErrorAction SilentlyContinue
    Invoke-Installer $pilot $installMaster
    $newCli = Join-Path $installRoot 'veyon-cli.exe'
    $result = Test-Pilot $newCli
    $result.version | Out-File -LiteralPath (Join-Path $backup 'pilot-version.txt') -Encoding utf8
    $result.plugins | Out-File -LiteralPath (Join-Path $backup 'pilot-plugins.txt') -Encoding utf8
    $result.features | Out-File -LiteralPath (Join-Path $backup 'pilot-features.txt') -Encoding utf8
    $pilotAccepted = $true
    Write-Host 'RoomGoblin Veyon Windows pilot installed and CLI discovery passed.'
    Write-Host 'Interactive terminal, firewall and classroom acceptance are still required.'
}
finally {
    if (-not $pilotAccepted) {
        Write-Warning 'Pilot acceptance failed; applying the verified rollback installer.'
        Remove-PilotFirewallRules
        Invoke-Installer $rollback $installMaster
        $restoredCli = Join-Path $installRoot 'veyon-cli.exe'
        Invoke-VeyonCli $restoredCli @('config', 'import', $configBackup) | Out-Null
        Start-Service -Name VeyonService
        if ((Get-Service -Name VeyonService).Status -ne 'Running') {
            throw 'Rollback installer completed but VeyonService is not running.'
        }
        Write-Warning "Rollback completed. Evidence is preserved at $backup"
    }
}
