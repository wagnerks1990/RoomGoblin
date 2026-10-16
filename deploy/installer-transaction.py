#!/usr/bin/env python3
"""Read-only admission guard for the native updater's installer handoff."""
import fcntl
import json
import os
from pathlib import Path
import re
import stat
import sys


def private_json(path, owner=0):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != owner or info.st_mode & 0o077:
        raise RuntimeError("Updater journal must be a private owner-controlled regular file")
    if info.st_size > 65536:
        raise RuntimeError("Updater journal exceeds its admission limit")
    return json.loads(path.read_text())


def admit(target, source, commit, state_dir=Path('/var/lib/classroom-hub'),
          lock_file=Path('/run/classroom-control-hub-appliance-mutation.lock'), owner=0):
    if target.resolve() != source.resolve():
        raise RuntimeError("Transactional installer must use the active appliance checkout")
    if not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise RuntimeError("Transactional installer source identity is unavailable")
    lock = lock_file.lstat()
    inherited = os.fstat(9)
    if not stat.S_ISREG(lock.st_mode) or lock.st_uid != owner or (lock.st_dev, lock.st_ino) != (inherited.st_dev, inherited.st_ino):
        raise RuntimeError("Native updater appliance lock was not inherited")
    with lock_file.open('r') as probe:
        try:
            fcntl.flock(probe, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            pass
        else:
            raise RuntimeError("Native updater appliance lock is not held")
    fcntl.flock(9, fcntl.LOCK_EX | fcntl.LOCK_NB)
    request = private_json(state_dir / 'app-update-request.json', owner)
    if request.get('action') != 'published' or request.get('mutationStarted') != 'true' or request.get('targetCommit') != commit:
        raise RuntimeError("Installer requires the matching full native update transaction")
    for key, pattern in [('rollbackCommit', r'[0-9a-f]{40}'),
                         ('rollbackHubImage', r'sha256:[0-9a-f]{64}'),
                         ('rollbackMaintenanceImage', r'sha256:[0-9a-f]{64}'),
                         ('backupName', r'[A-Za-z0-9._-]{1,180}'),
                         ('backupSha256', r'[0-9a-f]{64}')]:
        if not re.fullmatch(pattern, str(request.get(key, ''))):
            raise RuntimeError('Updater safety snapshot is incomplete: ' + key)
    if request.get('failureBackupName') != request['backupName'] or request.get('failureBackupSha256') != request['backupSha256']:
        raise RuntimeError('Updater rollback backup does not match its safety snapshot')
    env = (state_dir / 'app-update.env').lstat()
    if not stat.S_ISREG(env.st_mode) or env.st_uid != owner or env.st_mode & 0o077:
        raise RuntimeError('Updater environment safety snapshot is unavailable or unsafe')


def baseline(target, commit, state_dir=Path('/var/lib/classroom-hub'), owner=0, planner=None):
    import importlib.util
    saved = private_json(state_dir / 'deployment.json', owner)
    if saved.get('host') != commit:
        raise RuntimeError('Checkout has not been recorded as a verified deployment')
    if planner is None:
        spec = importlib.util.spec_from_file_location('installer_plan', Path(__file__).with_name('update-plan.py'))
        planner = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(planner)
    previous_cwd = Path.cwd()
    os.chdir(target)
    try:
        _baseline_components(saved, commit, planner)
    finally:
        os.chdir(previous_cwd)


def _baseline_components(saved, commit, planner):
    if saved.get('layout') != planner.layout_digest():
        raise RuntimeError('Deployment configuration differs from its verified snapshot')
    revisions = {'host': saved['host']}
    for component, container in [('hub', 'classroom-control-hub'), ('maintenance', 'classroom-control-hub-maintenance')]:
        image = planner.run('docker', 'inspect', '--format', '{{.Image}}', container)
        revisions[component] = planner.run('docker', 'image', 'inspect', '--format', '{{index .Config.Labels "org.opencontainers.image.revision"}}', image)
    result = planner.plan(commit, revisions, planner.changed)
    if any(result[key] for key in ['full', 'hub', 'maintenance', 'host']):
        raise RuntimeError('Running components do not match the verified checkout inputs')


if __name__ == '__main__':
    try:
        if sys.argv[1] == '--baseline':
            baseline(Path(sys.argv[2]), sys.argv[3])
        else:
            admit(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3])
    except Exception as error:
        print('Installer transaction admission failed: ' + str(error), file=sys.stderr)
        sys.exit(1)
