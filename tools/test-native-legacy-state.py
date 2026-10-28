#!/usr/bin/env python3
"""Exercise actual bootstrap task-state reads and migration decisions without SCM changes."""
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
    source = (root / 'windows-agent/RoomGoblin.Agent.Bootstrap/Program.cs').read_text(encoding='utf-8')
    program = (root / 'test/fixtures/native-legacy-state.cs').read_text(encoding='utf-8')
    lifecycle = (root / 'test/fixtures/native-lifecycle-process.cs').read_text(encoding='utf-8')
    install = lifecycle[lifecycle.index('internal sealed class InstallFixture'):lifecycle.index('internal static class Program')]
    install = install.replace('/* BOOTSTRAP_INSTALL */', source[source.index('int Install()'):source.index('int Uninstall()')])
    replacements = {
        'INSTALL_FIXTURE': install,
        'STATE_QUERY': source[source.index('bool? ReadScheduledTaskEnabled('):source.index('bool? ReadScheduledTaskEnabledCore(')],
        'STATE_CORE': source[source.index('bool? ReadScheduledTaskEnabledCore('):source.index('bool WaitForFreshHealth(')],
        'NATIVE_PROBE': source[source.index('bool? ReadScheduledTaskEnabled('):source.index('bool WaitForFreshHealth(')],
    }
    for name, body in replacements.items():
        marker = f'/* {name} */'
        assert program.count(marker) == 1
        program = program.replace(marker, body)
    with tempfile.TemporaryDirectory(prefix='roomgoblin-native-legacy-state-') as directory:
        work = Path(directory).resolve()
        assert work.parent == Path(tempfile.gettempdir()).resolve()
        (work / 'LegacyStateTests.csproj').write_text(
            '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup>'
            f'<OutputType>Exe</OutputType><TargetFramework>{args.framework}</TargetFramework>'
            '<ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable>'
            '<NuGetAudit>true</NuGetAudit></PropertyGroup></Project>', encoding='utf-8')
        (work / 'Program.cs').write_text(program, encoding='utf-8')
        env = {**os.environ, 'DOTNET_NOLOGO': '1', 'DOTNET_CLI_TELEMETRY_OPTOUT': '1'}
        subprocess.run(['dotnet', 'build', '--nologo', '--verbosity', 'quiet'],
                       cwd=work, env=env, check=True, timeout=120)
        executable = work / 'bin/Debug' / args.framework / ('LegacyStateTests.exe' if os.name == 'nt' else 'LegacyStateTests')
        subprocess.run([str(executable)], cwd=work, env=env, check=True, timeout=60)


if __name__ == '__main__':
    main()
