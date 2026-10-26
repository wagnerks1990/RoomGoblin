"""Bounded Ubuntu/Xorg inventory; no device mutation and no credentials in output."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import shutil


def run(args, env=None, timeout=8):
    result = subprocess.run(args, env=env, capture_output=True, timeout=timeout, check=True)
    if len(result.stdout) > 1024 * 1024:
        raise ValueError('Inventory exceeded its size limit')
    return result.stdout.decode('utf-8', 'replace')


def x_environment():
    env = dict(os.environ, LC_ALL='C')
    if env.get('DISPLAY') and env.get('XAUTHORITY'):
        return env
    # Read only Xorg's display/auth arguments; never expose process environments.
    for process in Path('/proc').glob('[0-9]*'):
        try:
            args = (process / 'cmdline').read_bytes().decode().split('\0')
            if Path(args[0]).name not in ('Xorg', 'X'):
                continue
            display = next((a for a in args if re.fullmatch(r':\d+', a)), ':0')
            auth = args[args.index('-auth') + 1]
            env.update(DISPLAY=display, XAUTHORITY=auth)
            return env
        except (OSError, ValueError, IndexError, UnicodeError):
            continue
    return env


def parse_outputs(text):
    outputs = []
    current = None
    edid = False
    for line in text.splitlines():
        match = re.match(r'^([\w.-]+) (connected|disconnected)\b(.*)', line)
        if match:
            current = {'connector': match[1], 'connected': match[2] == 'connected',
                       'modes': [], 'edid': '', 'geometry': None}
            geometry = re.search(r'(\d+)x(\d+)\+(-?\d+)\+(-?\d+)', match[3])
            if geometry:
                current['geometry'] = dict(zip(('width', 'height', 'x', 'y'), map(int, geometry.groups())))
            outputs.append(current)
            edid = False
        elif current:
            if line.strip() == 'EDID:':
                edid = True
            elif edid and re.fullmatch(r'\s+[0-9a-fA-F]{32}', line):
                current['edid'] += line.strip()
            else:
                edid = False
                mode = re.match(r'^\s+(\d+x\d+)\s+[\d.]', line)
                if mode and mode[1] not in current['modes']:
                    current['modes'].append(mode[1])
    for output in outputs:
        edid = output.pop('edid')
        output['monitorId'] = hashlib.sha256(bytes.fromhex(edid)).hexdigest() if edid else ''
        output['modes'] = output['modes'][:64]
    return outputs[:16]


def inventory():
    release = {}
    for line in Path('/etc/os-release').read_text().splitlines():
        if '=' in line:
            key, value = line.split('=', 1)
            release[key] = value.strip('"')
    try:
        outputs = parse_outputs(run(['xrandr', '--prop'], x_environment()))
        graphics = 'x11'
    except (OSError, ValueError, subprocess.SubprocessError):
        outputs, graphics = [], 'session-unavailable'
    connectors = []
    for status in Path('/sys/class/drm').glob('card*-*/status'):
        connectors.append({'connector': status.parent.name, 'connected': status.read_text().strip() == 'connected'})
    memory = dict(re.findall(r'^(MemTotal|MemAvailable):\s+(\d+)', Path('/proc/meminfo').read_text(), re.M))
    disk = shutil.disk_usage('/')
    return {'hostname': os.uname().nodename, 'distribution': release.get('ID'),
            'version': release.get('VERSION_ID'), 'architecture': os.uname().machine,
            'machineId': hashlib.sha256(Path('/etc/machine-id').read_bytes().strip()).hexdigest(),
            'graphics': graphics, 'outputs': outputs, 'hardwareConnectors': connectors[:16],
            'installed': Path('/etc/roomgoblin-display/identity.json').exists(),
            'health': {'uptimeSeconds': int(float(Path('/proc/uptime').read_text().split()[0])),
                       'loadAverage': list(os.getloadavg()), 'memoryTotalKiB': int(memory.get('MemTotal', 0)),
                       'memoryAvailableKiB': int(memory.get('MemAvailable', 0)), 'diskTotalBytes': disk.total, 'diskFreeBytes': disk.free},
            'desktopPresent': Path('/etc/X11/default-display-manager').exists()}


if __name__ == '__main__':
    print(json.dumps(inventory()))
