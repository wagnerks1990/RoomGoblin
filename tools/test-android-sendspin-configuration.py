#!/usr/bin/env python3
"""Compile the actual Sendspin manager with Android and transport substitutes using CI's Gradle Kotlin compiler."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--gradle-home', type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    gradle = args.gradle_home
    if gradle is None:
        executable = shutil.which('gradle')
        if not executable:
            parser.error('Install the CI-pinned Gradle distribution or provide --gradle-home')
        gradle = Path(executable).resolve().parents[1]
    library = gradle.resolve() / 'lib'
    standard = list(library.glob('kotlin-stdlib-*.jar'))
    assert len(standard) == 1 and len(list(library.glob('kotlin-compiler-embeddable-*.jar'))) == 1
    sources = sorted((root / 'test/fixtures/android-sendspin').glob('*.kt'))
    assert len(sources) == 10
    sources.append(root / 'agents/android-tv/app/src/main/java/org/roomgoblin/display/NativeSendspinManager.kt')
    with tempfile.TemporaryDirectory(prefix='roomgoblin-android-sendspin-') as directory:
        work = Path(directory).resolve()
        assert work.parent == Path(tempfile.gettempdir()).resolve()
        for source in sources:
            (work / source.name).write_text(source.read_text(encoding='utf-8'), encoding='utf-8')
        subprocess.run([
            'java', '-cp', str(library / '*'), 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler',
            '-no-stdlib', '-no-reflect', '-jvm-target', '17', '-classpath', str(standard[0]),
            '-d', str(work / 'classes'), *(source.name for source in sources),
        ], cwd=work, check=True, timeout=60)
        subprocess.run([
            'java', '-cp', str(work / 'classes') + os.pathsep + str(standard[0]), 'SendspinFixture',
        ], cwd=work, check=True, timeout=30)


if __name__ == '__main__':
    main()
