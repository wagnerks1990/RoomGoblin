"""Explicit administrator bootstrap. Snapshot first; activation is a separate action."""
import base64
import json
import os
from pathlib import Path
import pwd
import re
import shutil
import subprocess
import time
import uuid
import fcntl

LIB = Path('/usr/local/libexec/roomgoblin-display')
ROOT = Path('/etc/roomgoblin-display')
BACKUP = Path('/var/lib/roomgoblin-display/rollback')
USER = 'rg-display'
MANAGER = 'rg-display-mgr'
OWNED = ['/etc/lightdm/lightdm.conf', '/etc/X11/default-display-manager',
         '/etc/sudoers.d/roomgoblin-display', '/usr/share/xsessions/roomgoblin-display.desktop',
         '/etc/chromium/policies/managed/roomgoblin-display.json',
         '/var/snap/chromium/current/policies/managed/roomgoblin-display.json',
         '/etc/tmpfiles.d/roomgoblin-display.conf',
         '/usr/local/libexec/roomgoblin-display-recovery.py',
         '/etc/systemd/system/roomgoblin-display-maintenance.service',
         '/etc/systemd/system/roomgoblin-display-recovery.service']


def call(args):
    subprocess.run(args, check=True, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                   stderr=subprocess.DEVNULL, timeout=900)


def write(path, content, mode=0o644):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_symlink():
        raise ValueError('Refusing a symlink destination')
    temp = path.with_name(path.name + '.roomgoblin-' + uuid.uuid4().hex)
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    try:
        with os.fdopen(fd, 'w') as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, path)
        os.chmod(path, mode)
    finally:
        temp.unlink(missing_ok=True)


def snapshot():
    BACKUP.mkdir(parents=True, mode=0o700, exist_ok=True)
    os.chmod(BACKUP.parent, 0o700)
    manifest_path = BACKUP / 'manifest.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {'files': [], 'displayManager': None}
    link = Path('/etc/systemd/system/display-manager.service')
    if not manifest_path.exists() and link.is_symlink():
        manifest['displayManager'] = os.readlink(link)
    for index, name in enumerate(OWNED):
        if any(entry['path'] == name for entry in manifest['files']):
            continue  # Never replace the first snapshot of previously managed paths.
        path = Path(name)
        if path.is_symlink():
            raise ValueError('Existing configuration symlink requires manual review')
        entry = {'path': name, 'backup': str(index), 'exists': path.exists()}
        if path.exists():
            if not path.is_file():
                raise ValueError('Unexpected configuration type')
            shutil.copy2(path, BACKUP / str(index))
        manifest['files'].append(entry)
    write(BACKUP / 'manifest.json', json.dumps(manifest), 0o600)


def rollback():
    manifest = json.loads((BACKUP / 'manifest.json').read_text())
    call(['systemctl', 'stop', 'lightdm'])
    subprocess.run(['systemctl', 'disable', 'roomgoblin-display-recovery.service'], capture_output=True, timeout=30)
    for entry in manifest['files']:
        if entry['path'] not in OWNED:
            raise ValueError('Invalid rollback manifest')
        path = Path(entry['path'])
        if path.is_symlink():
            raise ValueError('Rollback destination changed')
        if entry['exists']:
            shutil.copy2(BACKUP / entry['backup'], path)
        else:
            path.unlink(missing_ok=True)
    link = Path('/etc/systemd/system/display-manager.service')
    if link.is_symlink():
        link.unlink()
    if manifest['displayManager']:
        link.symlink_to(manifest['displayManager'])
    call(['systemctl', 'daemon-reload'])
    if manifest['displayManager']:
        call(['systemctl', 'start', 'display-manager'])
    # Keep the protected snapshot, profiles and local administrator access.


def install(payload):
    with open('/run/lock/roomgoblin-display.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return install_locked(payload)


def install_locked(payload):
    if os.geteuid() != 0 or payload.get('confirm') is not True:
        raise ValueError('Administrator installation confirmation required')
    release = Path('/etc/os-release').read_text()
    if not re.search(r'^ID=ubuntu$', release, re.M) or not re.search(r'^VERSION_ID="(?:22|24|26)\.04"$', release, re.M):
        raise ValueError('Supported Ubuntu LTS required')
    if os.uname().machine != 'x86_64':
        raise ValueError('This release supports Ubuntu x86-64')
    device_id = payload['id']
    if not re.fullmatch(r'[a-f0-9-]{36}', device_id):
        raise ValueError('Invalid identity')
    existing = ROOT / 'identity.json'
    if existing.exists() and json.loads(existing.read_text())['id'] != device_id:
        raise ValueError('Computer already belongs to another enrollment')
    key = payload['publicKey']
    if not re.fullmatch(r'ssh-rsa [A-Za-z0-9+/=]{200,2000}', key):
        raise ValueError('Invalid management key')
    files = payload['files']
    if set(files) != {'probe.py', 'control.py', 'session.py', 'installer.py', 'lifecycle.py'}:
        raise ValueError('Invalid agent package')
    for name, content in files.items():
        if len(content) > 256 * 1024:
            raise ValueError('Agent file too large')
        compile(content, name, 'exec')
    journal = BACKUP.parent / 'installation.json'
    admitted = journal.exists() and json.loads(journal.read_text()).get('id') == device_id
    for user in (USER, MANAGER):
        try:
            pwd.getpwnam(user)
            if not existing.exists() and not admitted:
                raise ValueError('Reserved account already exists; review ownership first')
        except KeyError:
            pass
    snapshot()
    write(journal, json.dumps({'id': device_id, 'state': 'installing'}), 0o600)
    # Do not stop/restart an existing desktop during package installation.
    policy = Path('/usr/sbin/policy-rc.d')
    if policy.exists():
        raise ValueError('Existing package service policy requires administrator review')
    policy_identity = None
    try:
        fd = os.open(policy, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o755)
        with os.fdopen(fd, 'w') as stream:
            policy_identity = os.fstat(stream.fileno()).st_ino
            stream.write('#!/bin/sh\nexit 101\n')
            stream.flush()
            os.fsync(stream.fileno())
        call(['apt-get', 'update'])
        env = dict(os.environ, DEBIAN_FRONTEND='noninteractive')
        subprocess.run(['apt-get', 'install', '-y', '--no-install-recommends', 'lightdm', 'lightdm-gtk-greeter',
                        'xorg', 'openbox', 'x11-xserver-utils', 'wmctrl', 'scrot', 'python3-tk', 'dbus-user-session',
                        'pipewire', 'pipewire-pulse', 'wireplumber', 'pulseaudio-utils', 'sudo', 'chromium-browser'], env=env, check=True, timeout=900,
                       stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    finally:
        if policy_identity is not None and policy.exists() and policy.lstat().st_ino == policy_identity:
            policy.unlink()
    if not Path('/snap/bin/chromium').exists():
        call(['snap', 'install', 'chromium'])
    for user in (USER, MANAGER):
        try:
            pwd.getpwnam(user)
        except KeyError:
            call(['useradd', '--create-home', '--shell', '/bin/sh', user])
        call(['passwd', '-l', user])
    call(['usermod', '-aG', 'audio,video', USER])
    LIB.mkdir(parents=True, exist_ok=True)
    ROOT.mkdir(parents=True, exist_ok=True)
    os.chmod(ROOT, 0o750)
    os.chown(ROOT, 0, pwd.getpwnam(USER).pw_gid)
    for name, content in files.items():
        write(LIB / name, content, 0o755 if name == 'control.py' else 0o644)
    import hashlib
    package_digest = hashlib.sha256(''.join(name + '\0' + hashlib.sha256(files[name].replace('\r\n', '\n').encode()).hexdigest() + '\n' for name in sorted(files)).encode()).hexdigest()
    write(ROOT / 'identity.json', json.dumps({'id': device_id, 'version': str(payload.get('version', 'unknown'))[:80], 'packageDigest': package_digest, 'installedAt': time.time()}), 0o640)
    os.chown(ROOT / 'identity.json', 0, pwd.getpwnam(USER).pw_gid)
    manager = pwd.getpwnam(MANAGER)
    os.chown(manager.pw_dir, 0, 0)
    os.chmod(manager.pw_dir, 0o755)
    ssh_dir = Path(manager.pw_dir) / '.ssh'
    ssh_dir.mkdir(mode=0o700, exist_ok=True)
    # root ownership prevents the restricted account replacing its forced command.
    os.chown(ssh_dir, 0, 0)
    os.chmod(ssh_dir, 0o755)
    write(ssh_dir / 'authorized_keys', 'restrict,command="sudo -n /usr/local/libexec/roomgoblin-display/control.py" ' + key + '\n')
    write('/etc/sudoers.d/roomgoblin-display', MANAGER + ' ALL=(root) NOPASSWD: /usr/local/libexec/roomgoblin-display/control.py ""\n', 0o440)
    call(['visudo', '-cf', '/etc/sudoers.d/roomgoblin-display'])
    write('/etc/tmpfiles.d/roomgoblin-display.conf', 'd /run/roomgoblin-display 0750 rg-display rg-display -\n')
    call(['systemd-tmpfiles', '--create', '/etc/tmpfiles.d/roomgoblin-display.conf'])
    write('/usr/share/xsessions/roomgoblin-display.desktop', '[Desktop Entry]\nName=RoomGoblin Displays\nType=Application\nExec=/usr/bin/python3 /usr/local/libexec/roomgoblin-display/session.py\n')
    write('/etc/lightdm/lightdm.conf', '[Seat:*]\nautologin-user=rg-display\nautologin-user-timeout=0\nuser-session=roomgoblin-display\nautologin-session=roomgoblin-display\nallow-guest=false\nxserver-allow-tcp=false\n')
    write('/etc/X11/default-display-manager', '/usr/sbin/lightdm\n')
    write('/etc/systemd/system/roomgoblin-display-maintenance.service', '[Unit]\nDescription=RoomGoblin display maintenance\nAfter=network-online.target\n[Service]\nType=oneshot\nExecStart=/usr/bin/python3 -sE /usr/local/libexec/roomgoblin-display/lifecycle.py --run\nTimeoutStartSec=45min\nKillMode=control-group\nUMask=0077\nStandardOutput=null\nStandardError=null\n')
    write('/usr/local/libexec/roomgoblin-display-recovery.py', files['lifecycle.py'])
    write('/etc/systemd/system/roomgoblin-display-recovery.service', '[Unit]\nDescription=RoomGoblin display agent recovery\nBefore=lightdm.service\n[Service]\nType=oneshot\nExecStart=/usr/bin/python3 -sE /usr/local/libexec/roomgoblin-display-recovery.py --recover\nUMask=0077\n[Install]\nWantedBy=multi-user.target\n')
    call(['systemctl', 'daemon-reload'])
    call(['systemctl', 'enable', 'roomgoblin-display-recovery.service'])
    write(journal, json.dumps({'id': device_id, 'state': 'installed'}), 0o600)
    # Activation explicitly switches display-manager after all identities are verified.
    return {'installed': True, 'activationRequired': True}
