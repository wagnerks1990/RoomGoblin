"""Conservative source-input planner. Unknown identity or layout always reconciles fully."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

COMPONENTS = ('hub', 'maintenance', 'host')
STATE = Path('/var/lib/classroom-hub/deployment.json')


def run(*args):
    return subprocess.check_output(args, stderr=subprocess.DEVNULL, timeout=30).decode().strip()


def category(path):
    # Schema/startup identity and deployment changes require the complete installer.
    if path in ('src/storage.js', 'src/startup-recovery.js', 'src/direct-display-compat.js',
                'Dockerfile', 'maintenance-agent/Dockerfile', 'VERSION', 'package.json',
                'package-lock.json', '.dockerignore') or path.startswith(('config/', 'deploy/')):
        return 'full'
    if path.startswith(('src/', 'public/')) or path in ('test/esphome_worker_test.py',
            'tools/prepare-display-fonts.sh', 'tools/verify-image-permissions.js'):
        return 'hub'
    if path.startswith(('maintenance-agent/', 'agents/android-tv/')):
        return 'maintenance'
    if path.startswith('host-agent/'):
        # Services/transaction engine are deployment machinery, not a routine hot refresh.
        if path.endswith('.service') or path.endswith('.sh'):
            return 'full'
        return 'host'
    if path.startswith(('docs/', 'wiki/', 'test/')) or ('/' not in path and path.endswith('.md')):
        return 'source'
    return 'full'


def plan(target, revisions, changed, layout_matches=True, force=False):
    result = dict(target=target, full=False, hub=False, maintenance=False, host=False, reasons=[])
    if force or not layout_matches:
        result['reasons'].append('Explicit full update or deployment configuration changed/unverified')
        result['full'] = True
    for component in COMPONENTS:
        revision = revisions.get(component, '')
        if not re.fullmatch('[0-9a-f]{40}', revision):
            result['full'] = True
            result['reasons'].append(f'{component}: no verified running revision')
            continue
        try:
            paths = changed(revision, target)
        except (OSError, subprocess.SubprocessError, ValueError):
            result['full'] = True
            result['reasons'].append(f'{component}: source ancestry unavailable')
            continue
        for path in paths:
            kind = category(path)
            if kind == 'full':
                result['full'] = True
            if kind in ('full', component):
                result[component] = True
                result['reasons'].append(f'{component}: {path}')
    if result['full']:
        result.update({component: True for component in COMPONENTS})
    return result


def changed(old, target):
    subprocess.run(['git', 'merge-base', '--is-ancestor', old, target], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=30)
    # Include both sides of renames/deletions: removing an input is still a change.
    return run('git', 'diff', '--no-renames', '--name-only', old, target).splitlines()


def layout_digest():
    config = json.loads(run('docker', 'compose', 'config', '--format', 'json'))
    for service in config['services'].values():
        service.pop('build', None)
    # Hash only; the resolved configuration can contain secrets and must not be printed.
    return hashlib.sha256(json.dumps(config, sort_keys=True).encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('target')
    parser.add_argument('--record', action='store_true')
    parser.add_argument('--full', action='store_true')
    args = parser.parse_args()
    if not re.fullmatch('[0-9a-f]{40}', args.target):
        parser.error('target must be an exact commit')
    if args.record:
        data = dict(host=args.target, layout=layout_digest())
        STATE.parent.mkdir(parents=True, exist_ok=True)
        temp = STATE.with_suffix('.tmp')
        temp.write_text(json.dumps(data)); temp.chmod(0o600); temp.replace(STATE)
        return
    try:
        saved = json.loads(STATE.read_text())
        layout_matches = saved['layout'] == layout_digest()
    except (OSError, ValueError, KeyError, subprocess.SubprocessError):
        saved, layout_matches = {}, False
    revisions = {'host': saved.get('host', '')}
    for component, container in [('hub', 'classroom-control-hub'),
                                 ('maintenance', 'classroom-control-hub-maintenance')]:
        try:
            image = run('docker', 'inspect', '--format', '{{.Image}}', container)
            revisions[component] = run('docker', 'image', 'inspect', '--format',
                '{{index .Config.Labels "org.opencontainers.image.revision"}}', image)
        except (OSError, subprocess.SubprocessError):
            revisions[component] = ''
    result = plan(args.target, revisions, changed, layout_matches, args.full)
    result['revisions'] = revisions
    print(json.dumps(result))


if __name__ == '__main__':
    main()
