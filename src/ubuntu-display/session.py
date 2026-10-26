"""Unprivileged persistent Chromium sessions, one profile/window per physical output."""
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
from urllib.parse import quote
from probe import parse_outputs, run
from control import ROOT, STATE, atomic_json, safe_read, validate_config


def resolve_screens(config, outputs):
    """Never infer another connector or monitor when a saved identity disappears."""
    by_connector = {o['connector']: o for o in outputs}
    screens = []
    for saved in config['screens']:
        output = by_connector.get(saved['connector'])
        error = ''
        if not saved['enabled']:
            error = 'disabled'
        elif not output or not output['connected']:
            error = 'disconnected'
        elif output['monitorId'] != saved['monitorId']:
            error = 'monitor-changed'
        elif saved['mode'] != 'auto' and saved['mode'] not in output['modes']:
            error = 'resolution-unavailable'
        screens.append({**saved, 'error': error, 'geometry': output.get('geometry') if output else None})
    return screens


def stop(process):
    if process and process.poll() is None:
        try:
            os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=4)
        except (OSError, subprocess.TimeoutExpired):
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except OSError:
                pass


def identify(screens):
    import tkinter as tk
    root = tk.Tk()
    root.withdraw()
    for index, screen in enumerate(screens, 1):
        if screen['error'] or not screen['geometry']:
            continue
        g = screen['geometry']
        window = tk.Toplevel(root)
        window.overrideredirect(True)
        window.geometry(f"{g['width']}x{g['height']}+{g['x']}+{g['y']}")
        window.configure(bg='#0b1220')
        window.attributes('-topmost', True)
        tk.Label(window, text=f"{index}\n{screen['name']}\n{screen['connector']}\nRoomGoblin", fg='#22c55e',
                 bg='#0b1220', font=('Sans', 48), wraplength=max(300, g['width'] - 80)).pack(expand=True)
    root.after(10000, root.destroy)
    root.mainloop()


def main():
    os.environ['XDG_RUNTIME_DIR'] = '/run/user/' + str(os.getuid())
    os.environ['DBUS_SESSION_BUS_ADDRESS'] = 'unix:path=' + os.environ['XDG_RUNTIME_DIR'] + '/bus'
    os.environ['LC_ALL'] = 'C'
    subprocess.Popen(['openbox'], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for command in (['xset', 's', 'off'], ['xset', 's', 'noblank'], ['xset', '-dpms']):
        subprocess.run(command, capture_output=True)
    children, signatures, next_start, failures, placements = {}, {}, {}, {}, {}
    last_layout, last_command = '', ''
    try:
        while True:
            try:
                config = validate_config(safe_read(ROOT / 'config.json'))
                outputs = parse_outputs(run(['xrandr', '--prop']))
                screens = resolve_screens(config, outputs)
                active = {s['receiverId'] for s in screens if not s['error']}
                # Close orphaned windows before the desktop is rearranged.
                for receiver in list(children):
                    if receiver not in active:
                        stop(children.pop(receiver))
                        signatures.pop(receiver, None)
                layout = json.dumps([(s['connector'], s['monitorId'], s['mode'], s['rotation'], s['error']) for s in screens])
                if layout != last_layout:
                    args, x = ['xrandr'], 0
                    for screen in screens:
                        if screen['error']:
                            continue
                        output = next(o for o in outputs if o['connector'] == screen['connector'])
                        mode = screen['mode'] if screen['mode'] != 'auto' else (output['modes'][0] if output['modes'] else '')
                        if not mode:
                            raise ValueError('No usable output mode')
                        width, height = map(int, mode.split('x'))
                        args += ['--output', screen['connector'], '--mode', mode, '--rotate', screen['rotation'], '--pos', f'{x}x0']
                        x += height if screen['rotation'] in ('left', 'right') else width
                    if len(args) > 1:
                        run(args)
                    last_layout = layout
                    outputs = parse_outputs(run(['xrandr', '--prop']))
                    screens = resolve_screens(config, outputs)
                try:
                    command = safe_read(ROOT / 'command.json')
                except (OSError, ValueError):
                    command = {}
                if command.get('id') != last_command and command.get('expires', 0) > time.time():
                    last_command = command['id']
                    if command['action'] == 'restart-screen':
                        receiver = command['receiverId']
                        stop(children.pop(receiver, None))
                        next_start.pop(receiver, None)
                    elif command['action'] == 'identify':
                        subprocess.Popen([sys.executable, __file__, '--identify'], stdin=subprocess.DEVNULL,
                                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                state = []
                for screen in screens:
                    receiver, geometry = screen['receiverId'], screen['geometry']
                    error = screen['error']
                    if not error and geometry:
                        url = config['hubUrl'] + '/display/' + quote(receiver)
                        signature = hashlib.sha256(url.encode()).hexdigest()
                        process = children.get(receiver)
                        if signatures.get(receiver) != signature:
                            stop(process)
                            process = None
                        if process and process.poll() is not None:
                            failures[receiver] = min(failures.get(receiver, 0) + 1, 5)
                            next_start[receiver] = time.time() + min(60, 2 ** failures[receiver])
                            children.pop(receiver, None)
                            process = None
                        if process is None and time.time() >= next_start.get(receiver, 0):
                            profile = Path.home() / 'snap/chromium/common/roomgoblin/profiles' / receiver
                            profile.mkdir(parents=True, exist_ok=True)
                            # Keep the one-use browser credential in its isolated profile.
                            marker = profile / '.enrollment-attempted'
                            token = screen.get('enrollmentToken', '')
                            token_hash = hashlib.sha256(token.encode()).hexdigest()
                            if token and (not marker.exists() or marker.read_text() != token_hash):
                                url += '#enrollmentToken=' + token
                                marker.write_text(token_hash)
                            args = ['/snap/bin/chromium', '--user-data-dir=' + str(profile), '--class=rg-' + receiver,
                                    '--app=' + url, '--no-first-run', '--no-default-browser-check', '--noerrdialogs',
                                    '--disable-session-crashed-bubble', '--force-device-scale-factor=1',
                                    '--window-position=' + str(geometry['x']) + ',' + str(geometry['y']),
                                    '--window-size=' + str(geometry['width']) + ',' + str(geometry['height'])]
                            children[receiver] = subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                                                 stderr=subprocess.DEVNULL, start_new_session=True)
                            signatures[receiver] = signature
                        # Move the existing window; never navigate/reload for placement.
                        title = 'rg-' + receiver
                        windows = run(['wmctrl', '-lx'])
                        window = next((line.split()[0] for line in windows.splitlines() if len(line.split()) > 2 and title.lower() in line.split()[2].lower().split('.')), None)
                        if window:
                            placement = (window, geometry['x'], geometry['y'], geometry['width'], geometry['height'])
                            if placements.get(receiver) != placement:
                                run(['wmctrl', '-i', '-r', window, '-b', 'remove,fullscreen'])
                                run(['wmctrl', '-i', '-r', window, '-e', ','.join(map(str, [0, geometry['x'], geometry['y'], geometry['width'], geometry['height']]))])
                                run(['wmctrl', '-i', '-r', window, '-b', 'add,fullscreen'])
                                placements[receiver] = placement
                            failures[receiver] = 0
                        else:
                            error = 'browser-starting'
                    state.append({'receiverId': receiver, 'connector': screen['connector'], 'geometry': geometry,
                                  'browserRunning': receiver in children and children[receiver].poll() is None,
                                  'error': error})
                atomic_json(STATE / 'state.json', {'online': True, 'at': time.time(), 'screens': state})
            except Exception:
                atomic_json(STATE / 'state.json', {'online': False, 'at': time.time(), 'error': 'session-reconciliation-failed'})
            time.sleep(2)
    finally:
        for process in children.values():
            stop(process)


if __name__ == '__main__':
    if '--identify' in sys.argv:
        identify(resolve_screens(validate_config(safe_read(ROOT / 'config.json')), parse_outputs(run(['xrandr', '--prop']))))
    else:
        main()
