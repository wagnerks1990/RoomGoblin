#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Prepare a separate source-complete AI pilot; never install or start services."""
import argparse
import hashlib
from pathlib import Path
import shutil
import subprocess

REVISION = 'db02a70439aad0c21e93de51d37761e082a9c393'
MODEL_SHA256 = '06e0beb4adecd05a6d04f5dd9d42669dc3020fe6669f68302ac0ff85e1600b6c'


def prepare(destination):
    destination = Path(destination).absolute()
    if destination.exists():
        raise ValueError('Use a new disposable directory')
    source = Path(__file__).parent
    shutil.copytree(source, destination, ignore=shutil.ignore_patterns('__pycache__'))
    upstream = destination / 'upstream'
    subprocess.run(['git', 'clone', '--no-checkout', 'https://github.com/vainmari/Veyon-detection.git', str(upstream)], check=True)
    subprocess.run(['git', '-C', str(upstream), 'checkout', '--detach', REVISION], check=True)
    if subprocess.check_output(['git', '-C', str(upstream), 'rev-parse', 'HEAD'], text=True).strip() != REVISION:
        raise RuntimeError('Source identity mismatch')
    if hashlib.sha256((upstream / 'weights/yolo26n.onnx').read_bytes()).hexdigest() != MODEL_SHA256:
        raise RuntimeError('Model identity mismatch')
    print('Prepared source only; no dependencies installed and no service started.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination')
    prepare(parser.parse_args().destination)
