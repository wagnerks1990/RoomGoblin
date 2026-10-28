#!/usr/bin/env python3
"""Test the actual native update client against isolated loopback HTTP fixtures."""
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
    with tempfile.TemporaryDirectory(prefix='roomgoblin-native-transfer-') as directory:
        work = Path(directory).resolve()
        assert work.parent == Path(tempfile.gettempdir()).resolve()
        (work / 'TransferTests.csproj').write_text(
            '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup>'
            f'<OutputType>Exe</OutputType><TargetFramework>{args.framework}</TargetFramework>'
            '<ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable>'
            '<NuGetAudit>true</NuGetAudit></PropertyGroup></Project>', encoding='utf-8')
        for target, source in (
            ('NativeUpdateClient.cs', 'windows-agent/RoomGoblin.Agent.Service/NativeUpdateClient.cs'),
            ('Program.cs', 'test/fixtures/native-update-transfer.cs'),
        ):
            (work / target).write_text((root / source).read_text(encoding='utf-8'), encoding='utf-8')
        env = {**os.environ, 'DOTNET_NOLOGO': '1', 'DOTNET_CLI_TELEMETRY_OPTOUT': '1'}
        subprocess.run(['dotnet', 'build', 'TransferTests.csproj', '--nologo', '--verbosity', 'quiet'],
                       cwd=work, env=env, check=True, timeout=120)
        executable = work / 'bin/Debug' / args.framework / ('TransferTests.exe' if os.name == 'nt' else 'TransferTests')
        subprocess.run([str(executable)], cwd=work, env=env, check=True, timeout=90)


if __name__ == '__main__':
    main()
