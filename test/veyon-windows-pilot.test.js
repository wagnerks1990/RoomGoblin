const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const pack=fs.readFileSync('tools/package-veyon-pilot-windows.sh','utf8');
const deploy=fs.readFileSync('deploy/test-veyon-windows-pilot.ps1','utf8');
const docs=fs.readFileSync('docs/VEYON-WINDOWS-PILOT.md','utf8');

test('Windows Veyon package is a complete pinned installer, never a DLL overlay',()=>{
  assert.match(pack,/prepare-veyon-pilot\.py/);
  assert.match(pack,/--target windows-binaries/);
  assert.match(pack,/--target create-windows-installer/);
  assert.match(pack,/classroomchat internetguard remotefilebrowser webbridge/);
  assert.match(pack,/verify-veyon-windows-pe\.py/);
  assert.match(pack,/veyon-pilot-source\.tar\.gz/);
  assert.match(pack,/sha256sum \.\/\*\.exe \.\/\*\.tar\.gz/);
  assert.doesNotMatch(pack,/cp .*\.dll .*\/Program Files/i);
});

test('single-endpoint pilot deploy requires hashes, evidence, and verified rollback',()=>{
  for(const boundary of [
    'AcceptDisposablePilotRisk','PilotSha256','RollbackSha256','BackupDirectory',
    'Get-FileHash','icacls.exe','config\', \'export','config\', \'import','VeyonService',
    "RoomGoblinVeyonIG_*",'Invoke-Installer $rollback'
  ]) assert.ok(deploy.includes(boundary),`missing deployment boundary: ${boundary}`);
  assert.match(deploy,/if \(Test-Path -LiteralPath \$BackupDirectory\) \{ throw/);
  assert.match(deploy,/if \(-not \$pilotAccepted\)/);
  assert.doesNotMatch(deploy,/Invoke-Command|Enter-PSSession|WinRM|psexec/i);
});

test('Windows pilot documentation keeps runtime acceptance and toolchain gates explicit',()=>{
  assert.match(docs,/not runtime discovery/i);
  assert.match(docs,/one endpoint passes the complete acceptance checklist/i);
  assert.match(docs,/never supports copying individual DLLs/i);
  assert.match(docs,/not mirrored or publicly pinned/i);
  assert.match(docs,/working, failed or uncertain/i);
});
