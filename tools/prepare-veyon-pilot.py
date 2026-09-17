#!/usr/bin/env python3
"""Prepare an isolated, pinned native Veyon source build. Never install services."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess

UPSTREAM = 'https://github.com/veyon/veyon.git'
REVISION = 'afecfd6cbf78efa34da80acb7ea449001574e8cc'  # official v4.11.2
PLUGINS = ('classroomchat', 'remotefilebrowser', 'webbridge')


def patch_linux_string_lifetime(destination):
    # QStringBuilder holds references. Materialize before temporary operands die.
    path = Path(destination) / 'plugins/platform/linux/LinuxServerProcess.cpp'
    original = 'const auto desktopFile = VeyonCore::applicationsDirectory()'
    replacement = 'const QString desktopFile = VeyonCore::applicationsDirectory()'
    content = path.read_text()
    if content.count(original) != 1:
        raise RuntimeError('Pinned Linux string-lifetime patch does not match source')
    path.write_text(content.replace(original, replacement))



def patch_browser_api(destination):
    base = Path(destination) / 'plugins/webapi'
    patches = {
        'WebApiController.h': ('\tResponse getFramebuffer( const Request& request );',
            '\tResponse roomGoblinRequest(const Request& request, const QString& action);\n\tResponse getFramebuffer( const Request& request );'),
        'WebApiHttpServer.cpp': ('\tauto success = true;',
            '\tauto success = true;\n\tsuccess &= addRoute<Method::Post>(QStringLiteral("roomgoblin/<arg>"), &WebApiController::roomGoblinRequest);'),
    }
    for name, (old, new) in patches.items():
        path = base / name
        text = path.read_text()
        if text.count(old) != 1:
            raise RuntimeError('Pinned browser API patch does not match source: ' + name)
        path.write_text(text.replace(old, new))
    path = base / 'WebApiController.cpp'
    path.write_text(path.read_text() + '\n#include "../webbridge/WebApiBrowserRequest.inc"\n')


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
    patch_linux_string_lifetime(destination)
    # fb_update_sent can return early in no-framebuffer mode without setting
    # its output argument. Initialize the caller's counter for that path.
    input_path = destination / '3rdparty/x11vnc/src/userinput.c'
    content = input_path.read_text()
    anchor = 'int cnt, iter = 0;'
    if content.count(anchor) != 1:
        raise RuntimeError('Pinned x11vnc counter patch does not match source')
    input_path.write_text(content.replace(anchor, 'int cnt = 0, iter = 0;'))
    for plugin in PLUGINS:
        shutil.copytree(source / plugin, destination / 'plugins' / plugin)
    patch_browser_api(destination)
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
