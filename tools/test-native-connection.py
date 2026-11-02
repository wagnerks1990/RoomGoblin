#!/usr/bin/env python3
"""Exercise actual native WebSocket connection selection with loopback peers."""
import argparse
import os
from pathlib import Path
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--framework', choices=('net8.0', 'net10.0'), default='net8.0')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    source = (root / 'windows-agent/RoomGoblin.Agent.Service/AgentWorker.Connection.cs').read_text(encoding='utf-8')
    start = source.index('    private async Task<(ClientWebSocket Socket, Uri Uri)> ConnectToHubAsync(')
    end = source.index('    private static void ValidateConfig(', start)
    fixture = (root / 'test/fixtures/native-connection.cs').read_text(encoding='utf-8')
    assert fixture.count('/* ACTUAL_CONNECTION */') == 1
    with tempfile.TemporaryDirectory(prefix='roomgoblin-native-connection-') as directory:
        work = Path(directory).resolve()
        assert work.parent == Path(tempfile.gettempdir()).resolve()
        (work / 'ConnectionTests.csproj').write_text(
            '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup>'
            f'<OutputType>Exe</OutputType><TargetFramework>{args.framework}</TargetFramework>'
            '<ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable>'
            '<NuGetAudit>true</NuGetAudit></PropertyGroup></Project>', encoding='utf-8')
        (work / 'Program.cs').write_text(fixture.replace('/* ACTUAL_CONNECTION */', source[start:end]), encoding='utf-8')
        env = {**os.environ, 'DOTNET_NOLOGO': '1', 'DOTNET_CLI_TELEMETRY_OPTOUT': '1'}
        subprocess.run(['dotnet', 'build', 'ConnectionTests.csproj', '--nologo', '--verbosity', 'quiet'],
                       cwd=work, env=env, check=True, timeout=120)
        executable = work / 'bin/Debug' / args.framework / ('ConnectionTests.exe' if os.name == 'nt' else 'ConnectionTests')
        subprocess.run([str(executable)], cwd=work, env=env, check=True, timeout=60)


if __name__ == '__main__':
    main()
