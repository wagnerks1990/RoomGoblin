#!/usr/bin/env python3
"""Exercise the actual capability snapshot with Android permission substitutes."""
from pathlib import Path
import subprocess
import tempfile


def main():
    root = Path(__file__).resolve().parents[1]
    source = (root / 'agents/android-tv/app/src/main/java/org/roomgoblin/display/AgentCapabilities.java').read_text(encoding='utf-8')
    program = (root / 'test/fixtures/android-capability-truth.java').read_text(encoding='utf-8')
    marker = '/* CAPABILITY_SOURCE */'
    assert program.count(marker) == 1
    program = program.replace(marker, '    static ' + source[source.index('final class AgentCapabilities'):])
    with tempfile.TemporaryDirectory(prefix='roomgoblin-android-capabilities-') as directory:
        work = Path(directory).resolve()
        assert work.parent == Path(tempfile.gettempdir()).resolve()
        (work / 'AndroidCapabilityTruthTest.java').write_text(program, encoding='utf-8')
        subprocess.run(['javac', '--release', '17', 'AndroidCapabilityTruthTest.java'], cwd=work, check=True, timeout=30)
        subprocess.run(['java', '-cp', str(work), 'AndroidCapabilityTruthTest'], cwd=work, check=True, timeout=30)


if __name__ == '__main__':
    main()
