param([string]$Configuration = 'Release')
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$project = Join-Path $repo 'windows-agent\daily-signin'
$out = Join-Path $repo 'windows-agent\artifacts\daily-signin'
$build = Join-Path $repo 'windows-agent\artifacts\daily-signin-cpp'
$version = (Get-Content (Join-Path $repo 'VERSION') -Raw).Trim()
New-Item -ItemType Directory -Force -Path $out | Out-Null
& dotnet restore "$project\RoomGoblin.SignIn.csproj" --locked-mode
if ($LASTEXITCODE) { throw 'Sign-in restore failed' }
& dotnet publish "$project\RoomGoblin.SignIn.csproj" -c $Configuration --no-restore -r win-x64 --self-contained true "-p:Version=$version" "-p:InformationalVersion=$version" -o $out
if ($LASTEXITCODE) { throw 'Sign-in publish failed' }
& cmake -S $project -B $build -A x64
if ($LASTEXITCODE) { throw 'Credential provider configure failed' }
& cmake --build $build --config $Configuration
if ($LASTEXITCODE) { throw 'Credential provider build failed' }
Copy-Item -LiteralPath "$build\$Configuration\RoomGoblinCredentialProvider.dll" -Destination $out
& "$build\$Configuration\RoomGoblinProviderTest.exe" "$out\RoomGoblinCredentialProvider.dll"
if ($LASTEXITCODE) { throw 'Credential provider COM smoke failed' }
$files = @('RoomGoblinSignIn.exe','RoomGoblinCredentialProvider.dll') | ForEach-Object {
    $file = Get-Item -LiteralPath (Join-Path $out $_)
    @{file=$_.ToString();size=$file.Length;sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
}
@{version=$version;files=@($files)} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath "$out\manifest.json" -Encoding utf8NoBOM
Compress-Archive -LiteralPath "$out\RoomGoblinSignIn.exe","$out\RoomGoblinCredentialProvider.dll","$out\manifest.json" -DestinationPath "$out\RoomGoblinDailySignIn.zip" -Force
Write-Host "Daily sign-in pilot package built: $out"
