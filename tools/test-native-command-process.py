#!/usr/bin/env python3
"""Compile the real native process helper against isolated child-process fixtures."""
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
    source = (root / 'windows-agent/RoomGoblin.Agent.Service/AgentWorker.Transport.cs').read_text(encoding='utf-8')
    start = source.index('    private static async Task RunProcessBoundedAsync(')
    end = source.index('    private async Task SendJsonAsync', start)
    fixture = (root / 'test/fixtures/native-command-process.cs').read_text(encoding='utf-8')
    assert fixture.count('/* ACTUAL_PROCESS_HELPER */') == 1
    program = fixture.replace('/* ACTUAL_PROCESS_HELPER */', source[start:end])
    with tempfile.TemporaryDirectory(prefix='roomgoblin-native-command-') as directory:
        work = Path(directory).resolve()
        assert work.parent == Path(tempfile.gettempdir()).resolve()
        (work / 'ProcessTests.csproj').write_text(
            '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup>'
            f'<OutputType>Exe</OutputType><TargetFramework>{args.framework}</TargetFramework>'
            '<ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable>'
            '<NuGetAudit>true</NuGetAudit>'
            '</PropertyGroup></Project>', encoding='utf-8')
        (work / 'Program.cs').write_text(program, encoding='utf-8')
        env = {**os.environ, 'DOTNET_NOLOGO': '1', 'DOTNET_CLI_TELEMETRY_OPTOUT': '1'}
        subprocess.run(['dotnet', 'build', 'ProcessTests.csproj', '--nologo', '--verbosity', 'quiet'],
                       cwd=work, env=env, check=True, timeout=120)
        executable = work / 'bin/Debug' / args.framework / ('ProcessTests.exe' if os.name == 'nt' else 'ProcessTests')
        subprocess.run([str(executable)], cwd=work, env=env, check=True, timeout=60)


if __name__ == '__main__':
    main()
