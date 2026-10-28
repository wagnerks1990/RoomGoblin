#!/usr/bin/env python3
"""Test actual bootstrap/updater process and stop-confirmation owners in isolation."""
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
    program = (root / 'test/fixtures/native-lifecycle-process.cs').read_text(encoding='utf-8')
    for kind in ('Bootstrap', 'Updater'):
        source = (root / f'windows-agent/RoomGoblin.Agent.{kind}/Program.cs').read_text(encoding='utf-8')
        prefix = 'static ' if kind == 'Updater' else ''
        start = source.index(prefix + 'void WaitForServiceStopped(')
        process = source.index(prefix + 'ProcessResult RunProcess(', start)
        end = source.index('bool IsAdministrator()' if kind == 'Bootstrap' else 'static Dictionary<string, string> ParseArgs', process)
        for suffix, text in (('WAIT', source[start:process]), ('PROCESS', source[process:end])):
            marker = f'/* {kind.upper()}_{suffix} */'
            assert program.count(marker) == 1
            program = program.replace(marker, text)
    bootstrap = (root / 'windows-agent/RoomGoblin.Agent.Bootstrap/Program.cs').read_text(encoding='utf-8')
    start = bootstrap.index('int Install()')
    end = bootstrap.index('int Uninstall()', start)
    assert program.count('/* BOOTSTRAP_INSTALL */') == 1
    program = program.replace('/* BOOTSTRAP_INSTALL */', bootstrap[start:end])
    with tempfile.TemporaryDirectory(prefix='roomgoblin-native-lifecycle-') as directory:
        work = Path(directory).resolve()
        assert work.parent == Path(tempfile.gettempdir()).resolve()
        (work / 'LifecycleTests.csproj').write_text(
            '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup>'
            f'<OutputType>Exe</OutputType><TargetFramework>{args.framework}</TargetFramework>'
            '<ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable>'
            '<NuGetAudit>true</NuGetAudit></PropertyGroup></Project>', encoding='utf-8')
        (work / 'Program.cs').write_text(program, encoding='utf-8')
        env = {**os.environ, 'DOTNET_NOLOGO': '1', 'DOTNET_CLI_TELEMETRY_OPTOUT': '1'}
        subprocess.run(['dotnet', 'build', 'LifecycleTests.csproj', '--nologo', '--verbosity', 'quiet'],
                       cwd=work, env=env, check=True, timeout=120)
        executable = work / 'bin/Debug' / args.framework / ('LifecycleTests.exe' if os.name == 'nt' else 'LifecycleTests')
        subprocess.run([str(executable)], cwd=work, env=env, check=True, timeout=150)


if __name__ == '__main__':
    main()
