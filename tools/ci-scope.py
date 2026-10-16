#!/usr/bin/env python3
"""Conservative PR-only selection; errors and every main push use full CI."""
import os
from pathlib import PurePosixPath
import re
import subprocess


ROOT_DOCS = {'AGENTS.md', 'README.md', 'CHANGELOG.md', 'INSTALL.md', 'CONTRIBUTING.md', 'SECURITY.md'}


def documentation_only(paths):
    return bool(paths) and all(
        path in ROOT_DOCS or (
            PurePosixPath(path).parts[0] in ('docs', 'wiki')
            and PurePosixPath(path).suffix == '.md'
            and '..' not in PurePosixPath(path).parts
        ) for path in paths if path
    ) and all(paths)


def full_required(event, base_ref, base_sha, read_changes):
    if event != 'pull_request' or base_ref != 'main' or not re.fullmatch(r'[0-9a-f]{40}', base_sha):
        return True
    try:
        return not documentation_only(read_changes(base_sha))
    except Exception:
        return True


def changed_paths(base_sha):
    # Fetch only the authenticated base identity, never a user-supplied ref or shell.
    subprocess.run(['git', 'fetch', '--no-tags', '--depth=1', 'origin', base_sha],
                   check=True, capture_output=True, timeout=30)
    result = subprocess.run(['git', 'diff', '--no-ext-diff', '--no-renames', '--name-only', '-z', base_sha, 'HEAD', '--'],
                            check=True, capture_output=True, timeout=30)
    if result.stdout and not result.stdout.endswith(b'\0'):
        raise ValueError('Incomplete changed-file response')
    return [entry.decode('utf-8', 'strict') for entry in result.stdout.split(b'\0') if entry]


if __name__ == '__main__':
    full = full_required(os.environ.get('CI_EVENT_NAME', ''), os.environ.get('CI_BASE_REF', ''),
                         os.environ.get('CI_BASE_SHA', ''), changed_paths)
    value = 'true' if full else 'false'
    print('CI scope: ' + ('full qualification' if full else 'Markdown-only PR; source/policy/security checks retained'))
    output = os.environ.get('GITHUB_OUTPUT')
    if output:
        with open(output, 'a', encoding='utf-8') as stream:
            stream.write('full=' + value + '\n')
