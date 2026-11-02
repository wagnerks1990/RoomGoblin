#!/usr/bin/env python3
"""Exercise Android listener/shutdown source with real, loopback-only JVM sockets."""
from pathlib import Path
import subprocess
import tempfile


def main():
    root = Path(__file__).resolve().parents[1]
    source = (root / 'agents/android-tv/app/src/main/java/org/roomgoblin/display/AgentService.java').read_text(encoding='utf-8')
    program = (root / 'test/fixtures/android-socket-lifecycle.java').read_text(encoding='utf-8')
    pieces = {
        'SERVICE_FIELDS': source[source.index('    private static final String TAG='):source.index('    public static void start(')],
        'SERVICE_DESTROY': source[source.index('    @Override public void onDestroy()'):source.index('    private void createNotificationChannel(')],
        'SERVICE_LISTENER': source[source.index('    private void listen('):source.index('    private void handle(')],
    }
    for name, code in pieces.items():
        marker = '/* ' + name + ' */'
        assert program.count(marker) == 1
        program = program.replace(marker, code)
    with tempfile.TemporaryDirectory(prefix='roomgoblin-android-sockets-') as directory:
        work = Path(directory).resolve()
        assert work.parent == Path(tempfile.gettempdir()).resolve()
        (work / 'AndroidSocketLifecycleTest.java').write_text(program, encoding='utf-8')
        subprocess.run(['javac', '--release', '17', 'AndroidSocketLifecycleTest.java'], cwd=work, check=True, timeout=30)
        subprocess.run(['java', '-cp', str(work), 'AndroidSocketLifecycleTest'], cwd=work, check=True, timeout=30)


if __name__ == '__main__':
    main()
