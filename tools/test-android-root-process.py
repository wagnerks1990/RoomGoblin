#!/usr/bin/env python3
"""Run RootTools process ownership against harmless, unprivileged JVM children."""
from pathlib import Path
import subprocess
import tempfile


def main():
    root = Path(__file__).resolve().parents[1]
    source = (root / 'agents/android-tv/app/src/main/java/org/roomgoblin/display/RootTools.java').read_text(encoding='utf-8')
    program = (root / 'test/fixtures/android-root-process.java').read_text(encoding='utf-8')
    pieces = {
        'ROOT_FIELDS': source[source.index('    private static final int MAX_OUTPUT_BYTES'):source.index('    private RootTools()')],
        'ROOT_RESULT': source[source.index('    private static final class Result'):source.index('    static boolean binaryDetected(')],
        'ROOT_EXECUTE': source[source.index('    private static Result execute('):source.rfind('\n}')],
    }
    for name, code in pieces.items():
        marker = '/* ' + name + ' */'
        assert program.count(marker) == 1
        program = program.replace(marker, code)
    with tempfile.TemporaryDirectory(prefix='roomgoblin-android-root-process-') as directory:
        work = Path(directory).resolve()
        assert work.parent == Path(tempfile.gettempdir()).resolve()
        (work / 'AndroidRootProcessTest.java').write_text(program, encoding='utf-8')
        subprocess.run(['javac', '--release', '17', 'AndroidRootProcessTest.java'], cwd=work, check=True, timeout=30)
        subprocess.run(['java', '-cp', str(work), 'AndroidRootProcessTest'], cwd=work, check=True, timeout=30)


if __name__ == '__main__':
    main()
