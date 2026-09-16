#!/usr/bin/env python3
"""Prepare an isolated, pinned native Veyon source build. Never install services."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess

UPSTREAM = 'https://github.com/veyon/veyon.git'
REVISION = 'afecfd6cbf78efa34da80acb7ea449001574e8cc'  # official v4.11.2
PLUGINS = ('classroomchat', 'remotefilebrowser')


def prepare(destination):
    destination = Path(destination).absolute()
    if destination.exists():
        raise ValueError('Destination must not exist; use a new disposable build directory.')
    source = Path(__file__).resolve().parent.parent / 'integrations' / 'veyon-plugins'
    subprocess.run(['git', 'clone', '--no-checkout', '--filter=blob:none', UPSTREAM, str(destination)], check=True)
    subprocess.run(['git', '-C', str(destination), 'checkout', '--detach', REVISION], check=True)
    actual = subprocess.check_output(['git', '-C', str(destination), 'rev-parse', 'HEAD'], text=True).strip()
    if actual != REVISION:
        raise RuntimeError('Upstream source identity mismatch')
    subprocess.run(['git', '-C', str(destination), 'submodule', 'update', '--init', '--recursive'], check=True)
    for plugin in PLUGINS:
        shutil.copytree(source / plugin, destination / 'plugins' / plugin)
    # Official v4.11.2 discovers plugin subdirectories automatically.
    # Do not add duplicate add_subdirectory entries.
    shutil.copyfile(source / 'PROVENANCE.md', destination / 'ROOMGOBLIN-PILOT.md')
    print(json.dumps({'source': str(destination), 'revision': actual, 'plugins': PLUGINS,
                      'installed': False, 'warning': 'Disposable pilot only; never mix with production 4.9.7 binaries.'}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination')
    args = parser.parse_args()
    prepare(args.destination)
