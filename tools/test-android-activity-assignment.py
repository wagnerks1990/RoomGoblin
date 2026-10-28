#!/usr/bin/env python3
"""Exercise the actual activity assignment methods with a JVM WebView substitute."""
from pathlib import Path
import subprocess
import tempfile


def main():
    root = Path(__file__).resolve().parents[1]
    source = (root / 'agents/android-tv/app/src/main/java/org/roomgoblin/display/MainActivity.java').read_text(encoding='utf-8')
    program = (root / 'test/fixtures/android-activity-assignment.java').read_text(encoding='utf-8')
    pieces = {
        'ACTIVITY_FIELDS': source[source.index('    private WebView webView;'):source.index('    private final Handler')],
        'ACTIVITY_INTENT': source[source.index('    @Override protected void onNewIntent('):source.index('    private void enterImmersive(')],
        'ACTIVITY_LOADER': source[source.index('    private void loadConfiguredUrl('):source.index('    private void startPolicyWatchdog(')],
    }
    for name, code in pieces.items():
        marker = '/* ' + name + ' */'
        assert program.count(marker) == 1
        program = program.replace(marker, code)
    with tempfile.TemporaryDirectory(prefix='roomgoblin-android-activity-') as directory:
        work = Path(directory).resolve()
        assert work.parent == Path(tempfile.gettempdir()).resolve()
        (work / 'ActivityAssignmentTest.java').write_text(program, encoding='utf-8')
        subprocess.run(['javac', '--release', '17', 'ActivityAssignmentTest.java'], cwd=work, check=True, timeout=30)
        subprocess.run(['java', '-cp', str(work), 'ActivityAssignmentTest'], cwd=work, check=True, timeout=30)


if __name__ == '__main__':
    main()
