#!/usr/bin/python3 -sE
"""Fixed SSH forced-command interface. This is the only passwordless sudo grant."""
import base64
import json
import os
from pathlib import Path
import pwd
import re
import stat
import subprocess
import sys
import time
import uuid
from urllib.parse import urlsplit
from probe import inventory

ROOT = Path('/etc/roomgoblin-display')
STATE = Path('/run/roomgoblin-display')
USER = 'rg-display'
VERSION = '1'


def atomic_json(path, value, mode=0o640):
    tmp = path.with_name(path.name + '.' + uuid.uuid4().hex)
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(value, stream)
            stream.flush()
            os.fsync(stream.fileno())
        if os.geteuid() == 0:
            os.chown(tmp, 0, pwd.getpwnam(USER).pw_gid)
        os.replace(tmp, path)
    finally:
        if tmp.exists():
            tmp.unlink()


def safe_read(path, limit=1024 * 1024, binary=False):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_size > limit:
            raise ValueError('Invalid runtime state')
        data = stream.read(limit + 1)
        if len(data) > limit:
            raise ValueError('Runtime state too large')
    return data if binary else json.loads(data)


def validate_config(value):
    if not isinstance(value, dict):
        raise ValueError('Invalid screen configuration')
    base = urlsplit(value.get('hubUrl', ''))
    if base.scheme not in ('http', 'https') or not base.hostname or base.username or base.password or base.query or base.fragment or base.path not in ('', '/'):
        raise ValueError('A Hub origin is required')
    screens = value.get('screens')
    if not isinstance(screens, list) or len(screens) > 16:
        raise ValueError('At most 16 screens are supported')
    connectors, receivers = set(), set()
    clean = []
    for screen in screens:
        connector, receiver = screen.get('connector', ''), screen.get('receiverId', '')
        if not re.fullmatch(r'[A-Za-z0-9_.-]{1,64}', connector) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,40}', receiver):
            raise ValueError('Invalid output or receiver ID')
        if connector in connectors or receiver in receivers:
            raise ValueError('Each output needs a unique receiver')
        connectors.add(connector)
        receivers.add(receiver)
        monitor = screen.get('monitorId', '')
        if not re.fullmatch(r'[0-9a-f]{64}', monitor):
            raise ValueError('A verified monitor identity is required')
        mode = screen.get('mode', 'auto')
        if mode != 'auto' and not re.fullmatch(r'[1-9][0-9]{2,4}x[1-9][0-9]{2,4}', mode):
            raise ValueError('Invalid resolution')
        rotation = screen.get('rotation', 'normal')
        if rotation not in ('normal', 'left', 'right', 'inverted'):
            raise ValueError('Invalid rotation')
        name = str(screen.get('name', receiver))[:100]
        token = screen.get('enrollmentToken', '')
        if token and not re.fullmatch(r'[A-Za-z0-9_-]{32,128}', token):
            raise ValueError('Invalid display enrollment')
        clean.append(dict(connector=connector, receiverId=receiver, name=name, monitorId=monitor,
                          mode=mode, rotation=rotation, enabled=screen.get('enabled', True) is True,
                          enrollmentToken=token))
    return {'hubUrl': value['hubUrl'].rstrip('/'), 'screens': clean}


def status():
    result = inventory()
    result['protocolVersion'] = VERSION
    result['agentVersion'] = safe_read(ROOT / 'identity.json').get('version', 'unknown')
    result['identity'] = safe_read(ROOT / 'identity.json')['id']
    try:
        session = safe_read(STATE / 'state.json')
        result['session'] = session if time.time() - session.get('at', 0) < 12 else {'online': False, 'error': 'session-stale'}
    except (OSError, ValueError):
        result['session'] = {'online': False, 'error': 'session-unavailable'}
    return result


def command(request):
    if not isinstance(request, dict):
        raise ValueError('Invalid request')
    identity = safe_read(ROOT / 'identity.json')
    if request.get('id') != identity['id']:
        raise ValueError('Device identity mismatch')
    action = request.get('action')
    if action == 'status':
        return status()
    if action == 'configure':
        config = validate_config(request.get('config'))
        atomic_json(ROOT / 'config.json', config)
        policy = {'AutoplayAllowed': False, 'AutoplayAllowlist': [config['hubUrl']],
                  'PasswordManagerEnabled': False, 'BrowserSignin': 0}
        from installer import write
        for folder in ('/etc/chromium/policies/managed', '/var/snap/chromium/current/policies/managed'):
            write(Path(folder) / 'roomgoblin-display.json', json.dumps(policy))
        return {'configured': True}
    if action in ('restart-screen', 'identify'):
        screen = request.get('receiverId', '')
        config = safe_read(ROOT / 'config.json')
        if action == 'restart-screen' and screen not in [s['receiverId'] for s in config['screens']]:
            raise ValueError('Unknown receiver')
        atomic_json(ROOT / 'command.json', {'action': action, 'receiverId': screen, 'id': uuid.uuid4().hex, 'expires': time.time() + 20})
        return {'accepted': True}
    if action == 'screenshot':
        session = status()['session']
        screen = next((s for s in session.get('screens', []) if s['receiverId'] == request.get('receiverId') and s.get('browserRunning')), None)
        if not screen:
            raise ValueError('Screen is not running')
        g = screen['geometry']
        if any(not isinstance(g.get(k), int) or g[k] < 0 or g[k] > 32768 for k in ('x', 'y', 'width', 'height')):
            raise ValueError('Invalid screen geometry')
        shot = STATE / 'screenshot.png'
        # The kiosk owns this path; scrot never runs as root.
        subprocess.run(['runuser', '-u', USER, '--', 'env', 'DISPLAY=:0', 'XAUTHORITY=/home/rg-display/.Xauthority',
                        'scrot', '-o', '-a', ','.join(str(g[k]) for k in ('x', 'y', 'width', 'height')), str(shot)],
                       check=True, capture_output=True, timeout=12)
        data = safe_read(shot, 8 * 1024 * 1024, binary=True)
        if not data.startswith(b'\x89PNG\r\n\x1a\n'):
            raise ValueError('Invalid screenshot')
        return {'png': base64.b64encode(data).decode()}
    if action in ('activate', 'reboot', 'shutdown', 'rollback'):
        if request.get('confirm') is not True:
            raise ValueError('Confirmation required')
        if action == 'rollback':
            from installer import rollback
            rollback()
            return {'accepted': True, 'rollback': True}
        if action == 'activate':
            # Switch only after bootstrap/configuration and restricted-key verification.
            link = Path('/etc/systemd/system/display-manager.service')
            if link.exists() and not link.is_symlink():
                raise ValueError('Unexpected display-manager service file')
            subprocess.run(['systemctl', 'stop', 'display-manager'], capture_output=True, timeout=30)
            link.unlink(missing_ok=True)
            link.symlink_to('/usr/lib/systemd/system/lightdm.service')
            subprocess.run(['systemctl', 'daemon-reload'], check=True, capture_output=True, timeout=30)
        cmd = {'activate': ['systemctl', 'restart', 'lightdm'], 'reboot': ['systemctl', 'reboot'],
               'shutdown': ['systemctl', 'poweroff']}[action]
        subprocess.Popen(['sh', '-c', 'sleep 2; exec "$@"', 'sh', *cmd], stdin=subprocess.DEVNULL,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        return {'accepted': True}
    raise ValueError('Unsupported management action')


if __name__ == '__main__':
    try:
        raw = sys.stdin.buffer.read(128 * 1024 + 1)
        if len(raw) > 128 * 1024:
            raise ValueError('Request too large')
        print(json.dumps({'ok': True, **command(json.loads(raw))}))
    except Exception:
        # Root process errors must not leak local configuration, URLs or secrets.
        print(json.dumps({'ok': False, 'error': 'Device operation failed; check its identity, configuration and local session.'}))
        sys.exit(1)
