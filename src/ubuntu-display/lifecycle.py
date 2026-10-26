"""Root-owned, fixed device maintenance jobs. No caller-supplied commands or files."""
import contextlib
import fcntl
import hashlib
import json
import os
import pwd
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
import uuid

LIB = Path('/usr/local/libexec/roomgoblin-display')
DATA = Path('/var/lib/roomgoblin-display')
ROOT = Path('/etc/roomgoblin-display')
LOCK = Path('/run/lock/roomgoblin-display.lock')
UNIT = 'roomgoblin-display-maintenance.service'
FILES = ('control.py', 'installer.py', 'lifecycle.py', 'probe.py', 'session.py')
ACTIONS = ('check-updates', 'update-os', 'update-browser', 'revert-browser', 'update-agent', 'revert-agent')
REPOSITORY = 'wagnerks1990/RoomGoblin'


def save(path, value):
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, delete=False) as stream:
        name = stream.name
        json.dump(value, stream)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(name, path)
    fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def read(path, default=None):
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        return default


def stage(message):
    job = read(DATA / 'maintenance.json', {})
    if job.get('state') == 'running':
        save(DATA / 'maintenance.json', {**job, 'stage': message, 'updatedAt': time.time()})


@contextlib.contextmanager
def mutation_lock():
    with LOCK.open('a') as stream:
        fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def run(args, timeout=120, capture=False):
    # A private file bounds resident memory even when package tools produce large output.
    with tempfile.TemporaryFile() as output:
        result = subprocess.run(args, stdin=subprocess.DEVNULL, stdout=output, stderr=output,
                                env={**os.environ, 'LC_ALL': 'C', 'DEBIAN_FRONTEND': 'noninteractive',
                                     'NEEDRESTART_MODE': 'l'}, timeout=timeout, check=False)
        if result.returncode:
            raise RuntimeError('maintenance-command-failed')
        if not capture:
            return ''
        output.seek(0)
        data = output.read(2 * 1024 * 1024 + 1)
        if len(data) > 2 * 1024 * 1024:
            raise ValueError('maintenance-output-limit')
        return data.decode('utf8', 'replace')


def digest(folder):
    parts = []
    for name in FILES:
        data = (folder / name).read_bytes().replace(b'\r\n', b'\n')
        parts.append(name + '\0' + hashlib.sha256(data).hexdigest() + '\n')
    return hashlib.sha256(''.join(parts).encode()).hexdigest()


def active():
    result = subprocess.run(['systemctl', 'show', '-p', 'ActiveState', '--value', UNIT],
                            capture_output=True, timeout=5, check=True)
    return result.stdout.strip() in (b'active', b'activating', b'deactivating')


def status():
    job = read(DATA / 'maintenance.json', {})
    if job.get('state') in ('queued', 'running') and time.time() - job.get('updatedAt', 0) > 30 and not active():
        # Report interrupted work; never replay an uncertain package/power command.
        job = {**job, 'state': 'interrupted', 'stage': 'Maintenance stopped before completion. Check packages before retrying.'}
    return {'job': {k: v for k, v in job.items() if k != 'packageDigest'},
            'updates': read(DATA / 'updates.json', {}),
            'history': read(DATA / 'maintenance-history.json', [])[-20:],
            'agentRollbackAvailable': (DATA / 'previous-agent' / 'manifest.json').is_file()}


def begin(request):
    operation = request.get('operation')
    if operation not in ACTIONS or request.get('confirm') is not True:
        raise ValueError('Explicit maintenance confirmation required')
    request_id = request.get('requestId', '')
    if not re.fullmatch(r'[a-f0-9-]{36}', request_id):
        raise ValueError('Invalid maintenance request identity')
    package_digest = request.get('packageDigest', '')
    if operation == 'update-agent' and not re.fullmatch(r'[a-f0-9]{64}', package_digest):
        raise ValueError('Verified Hub package required')
    with mutation_lock():
        existing = read(DATA / 'maintenance.json', {})
        if existing.get('id') == request_id:
            return {'accepted': True, 'job': status()['job']}
        receipts = {key: value for key, value in read(DATA / 'maintenance-receipts.json', {}).items()
                    if time.time() - value.get('startedAt', 0) < 32 * 86400}
        if request_id in receipts:
            return {'accepted': True, 'job': receipts[request_id]}
        if len(receipts) >= 2048:
            raise ValueError('Maintenance receipt limit reached')
        if active() or (existing.get('state') in ('queued', 'running') and time.time() - existing.get('updatedAt', 0) < 30):
            raise ValueError('Maintenance already running')
        job = dict(id=request_id, operation=operation, state='queued', stage='Waiting for device maintenance',
                   startedAt=time.time(), updatedAt=time.time(), packageDigest=package_digest)
        # The device remembers accepted IDs independently of Hub backups. A restored
        # old Hub schedule must not replay a command already accepted here.
        receipts[request_id] = {k: v for k, v in job.items() if k != 'packageDigest'}
        save(DATA / 'maintenance-receipts.json', receipts)
        save(DATA / 'maintenance.json', job)
        try:
            run(['systemctl', 'reset-failed', UNIT])
            run(['systemctl', 'start', '--no-block', UNIT])
        except Exception:
            save(DATA / 'maintenance.json', {**job, 'state': 'failed', 'stage': 'Maintenance service could not start.'})
            raise
        return {'accepted': True, 'job': {k: v for k, v in job.items() if k != 'packageDigest'}}


def apt_plan(text):
    if any(line.startswith('Remv ') for line in text.splitlines()):
        raise ValueError('Package removals are prohibited')
    packages = []
    for line in text.splitlines():
        if not line.startswith('Inst '):
            continue
        match = re.match(r'Inst ([a-z0-9][a-z0-9+.:~-]*) (?:\[([^\]]+)\] )?\(([^\s]+) ', line)
        if not match:
            raise ValueError('Unrecognized package plan')
        packages.append({'name': match[1], 'installed': match[2] or '', 'candidate': match[3],
                         'security': '-security' in line})
    if len(packages) > 3000:
        raise ValueError('Package plan exceeded its limit')
    return packages


def check_updates():
    stage('Refreshing Ubuntu package lists')
    run(['apt-get', '-o', 'DPkg::Lock::Timeout=60', '-o', 'APT::Update::Error-Mode=any', 'update'], timeout=300)
    packages = apt_plan(run(['apt-get', '-s', '--no-remove', 'upgrade'], capture=True))
    stage('Checking available Ubuntu packages and Chromium revision')
    plan = {'checkedAt': time.time(), 'packages': packages,
            'count': len(packages), 'securityCount': sum(p['security'] for p in packages),
            'rebootRequired': Path('/var/run/reboot-required').exists()}
    try:
        rows = run(['snap', 'refresh', '--list'], timeout=120, capture=True).splitlines()
        browser = next((row.split() for row in rows if row.startswith('chromium ')), None)
        plan['browser'] = {'available': bool(browser), **({'version': browser[1][:80], 'revision': browser[2][:40]} if browser and len(browser) >= 3 else {})}
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError):
        plan['browser'] = {'available': None, 'error': 'Chromium update availability could not be checked.'}
    plan['planId'] = hashlib.sha256(json.dumps(packages, sort_keys=True).encode()).hexdigest()
    save(DATA / 'updates.json', plan)
    return plan


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ValueError('Unexpected release redirect')


def download(url, limit):
    # All callers construct URLs from the fixed repository and verified commit.
    request = urllib.request.Request(url, headers={'User-Agent': 'RoomGoblin-display-updater', 'Accept': 'application/vnd.github+json'})
    with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
        data = response.read(limit + 1)
        if len(data) > limit:
            raise ValueError('Release file exceeded its limit')
        return data


def prepare_agent(folder, expected):
    commit = json.loads(download('https://api.github.com/repos/' + REPOSITORY + '/commits/main', 512 * 1024))['sha']
    if not re.fullmatch(r'[a-f0-9]{40}', commit):
        raise ValueError('Invalid trusted main revision')
    base = 'https://raw.githubusercontent.com/' + REPOSITORY + '/' + commit + '/'
    for name in FILES:
        data = download(base + 'src/ubuntu-display/' + name, 256 * 1024)
        compile(data, name, 'exec')
        (folder / name).write_bytes(data)
    if digest(folder) != expected:
        raise ValueError('Trusted main package differs from this Hub. Upgrade RoomGoblin first.')
    version = download(base + 'VERSION', 128).decode().strip()
    if not re.fullmatch(r'[a-zA-Z0-9.+-]{1,80}', version):
        raise ValueError('Invalid release version')
    return version, commit


def restore_agent():
    previous = DATA / 'previous-agent'
    for name in FILES:
        if not (previous / name).is_file():
            raise ValueError('Previous package is incomplete')
    manifest = read(previous / 'manifest.json', {})
    identity_data = (previous / 'identity.json').read_bytes()
    if digest(previous) != manifest.get('digest') or hashlib.sha256(identity_data).hexdigest() != manifest.get('identityHash'):
        raise ValueError('Previous package verification failed')
    # Recovery deliberately imports no installed agent modules: a torn package
    # must be recoverable even if control.py or installer.py cannot be imported.
    def restore_file(path, data, mode, gid=0):
        with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
            temp = Path(stream.name)
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temp, mode)
        os.chown(temp, 0, gid)
        os.replace(temp, path)
    for name in FILES:
        restore_file(LIB / name, (previous / name).read_bytes(), 0o755 if name == 'control.py' else 0o644)
    restore_file(ROOT / 'identity.json', identity_data, 0o640, pwd.getpwnam('rg-display').pw_gid)
    (DATA / 'agent-transaction.json').unlink(missing_ok=True)


def recover_agent():
    if (DATA / 'agent-transaction.json').exists():
        restore_agent()


def update_agent(expected):
    from installer import write
    from control import atomic_json
    with tempfile.TemporaryDirectory(prefix='agent-', dir=DATA) as directory:
        stage('Downloading and verifying the agent package against this Hub')
        staged = Path(directory)
        version, commit = prepare_agent(staged, expected)
        # Validate imports before changing the installed package. Sources come only from trusted main.
        run(['/usr/bin/python3', '-sE', '-c',
             'import sys; sys.path.insert(0, sys.argv[1]); import control,installer,lifecycle,probe,session', str(staged)])
        if digest(LIB) == expected:
            return
        previous = DATA / 'previous-agent'
        previous.mkdir(mode=0o700, exist_ok=True)
        (previous / 'manifest.json').unlink(missing_ok=True)
        for name in FILES:
            write(previous / name, (LIB / name).read_text(), 0o600)
        write(previous / 'identity.json', (ROOT / 'identity.json').read_text(), 0o600)
        save(previous / 'manifest.json', {'digest': digest(previous), 'identityHash': hashlib.sha256((previous / 'identity.json').read_bytes()).hexdigest()})
        save(DATA / 'agent-transaction.json', {'at': time.time()})
        stage('Installing agent files with the previous package retained for rollback')
        try:
            for name in FILES:
                write(LIB / name, (staged / name).read_text(), 0o755 if name == 'control.py' else 0o644)
            identity = read(ROOT / 'identity.json')
            atomic_json(ROOT / 'identity.json', {**identity, 'version': version, 'sourceRevision': commit,
                                                'packageDigest': expected, 'updatedAt': time.time()})
            result = json.loads(run(['/usr/bin/python3', '-sE', '-c',
                                    'import sys,json; sys.path.insert(0, sys.argv[1]); from control import status; print(json.dumps(status()))', str(LIB)], capture=True))
            if result['identity'] != identity['id'] or result['packageDigest'] != expected:
                raise ValueError('Updated package verification failed')
            (DATA / 'agent-transaction.json').unlink()
        except Exception:
            restore_agent()
            raise


def execute(job):
    operation = job['operation']
    if operation == 'check-updates':
        check_updates()
    elif operation == 'update-os':
        # No dist-upgrade, package removal, autoremove, repository changes or automatic reboot.
        check_updates()
        save(DATA / 'packages-before-update.json', {'at': time.time(), 'packages': run(
            ['dpkg-query', '-W', '-f=${binary:Package}\t${Version}\n'], capture=True)})
        stage('Installing Ubuntu package updates; preserving existing configuration')
        run(['apt-get', '-y', '--no-remove', '-o', 'DPkg::Lock::Timeout=60',
             '-o', 'Dpkg::Options::=--force-confold', 'upgrade'], timeout=1500)
        check_updates()
    elif operation in ('update-browser', 'revert-browser'):
        stage('Updating Chromium; the managed kiosk will restart')
        # Snap refresh is blocked by active Chromium processes; stop only the managed kiosk.
        running = subprocess.run(['systemctl', 'is-active', '--quiet', 'lightdm'], timeout=5).returncode == 0
        if running:
            run(['systemctl', 'stop', 'lightdm'])
        try:
            run(['snap', 'refresh' if operation == 'update-browser' else 'revert', 'chromium'], timeout=900)
        finally:
            if running:
                run(['systemctl', 'start', 'lightdm'])
    elif operation == 'update-agent':
        update_agent(job['packageDigest'])
        run(['systemctl', 'try-restart', 'lightdm'])
    elif operation == 'revert-agent':
        restore_agent()
        run(['systemctl', 'try-restart', 'lightdm'])


def worker():
    with mutation_lock():
        job = read(DATA / 'maintenance.json', {})
        if job.get('state') != 'queued' or job.get('operation') not in ACTIONS:
            return  # Never resume an uncertain update by rerunning it.
        job.update(state='running', stage='Running ' + job['operation'], updatedAt=time.time())
        save(DATA / 'maintenance.json', job)
        try:
            recover_agent()
            execute(job)
            job.update(state='completed', stage='Completed. Refresh status to verify the computer and its screens.')
        except Exception:
            last = read(DATA / 'maintenance.json', {}).get('stage', 'maintenance')
            job.update(state='failed', stage='Failed during: ' + last + '. Check connectivity, package health and disk space before retrying.')
        job.update(updatedAt=time.time(), finishedAt=time.time())
        save(DATA / 'maintenance.json', job)
        entry = {k: v for k, v in job.items() if k != 'packageDigest'}
        save(DATA / 'maintenance-history.json', (read(DATA / 'maintenance-history.json', []) + [entry])[-20:])
        receipts = read(DATA / 'maintenance-receipts.json', {})
        receipts[job['id']] = entry
        save(DATA / 'maintenance-receipts.json', receipts)


if __name__ == '__main__':
    if os.geteuid() != 0:
        raise SystemExit(1)
    if sys.argv[1:] == ['--run']:
        worker()
    elif sys.argv[1:] == ['--recover']:
        with mutation_lock():
            recover_agent()
    else:
        raise SystemExit(1)
