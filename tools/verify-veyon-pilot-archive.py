#!/usr/bin/env python3
"""Fail closed when a native pilot archive has unsafe metadata."""
import pathlib
import posixpath
import sys
import tarfile


def verify(path):
    with tarfile.open(path, 'r:gz') as archive:
        members = archive.getmembers()
        if not members:
            raise ValueError('empty pilot archive')
        names = {posixpath.normpath(member.name.removeprefix('./')) for member in members}
        privileged = {'usr/bin/veyon-auth-helper', 'usr/bin/veyon-input-helper'}
        for member in members:
            name = member.name.removeprefix('./')
            normalized = posixpath.normpath(name)
            if not name or name.startswith('/') or normalized == '..' or normalized.startswith('../'):
                raise ValueError(f'unsafe archive path: {member.name}')
            if member.uid != 0 or member.gid != 0:
                raise ValueError(f'non-root archive owner: {member.name}')
            if not (member.isdir() or member.isfile() or member.issym() or member.islnk()):
                raise ValueError(f'unsafe archive entry type: {member.name}')
            if member.issym():
                target = member.linkname
                resolved = posixpath.normpath(posixpath.join(posixpath.dirname(normalized), target))
                if target.startswith('/') or resolved == '..' or resolved.startswith('../'):
                    raise ValueError(f'unsafe archive link: {member.name}')
            if member.islnk():
                target = posixpath.normpath(member.linkname.removeprefix('./'))
                if member.linkname.startswith('/') or target == '..' or target.startswith('../') or target not in names:
                    raise ValueError(f'unsafe archive hardlink: {member.name}')
            if normalized in privileged:
                if not member.isfile() or member.mode & 0o7777 != 0o4755:
                    raise ValueError(f'invalid privileged helper: {member.name}')
            elif member.mode & 0o6000:
                raise ValueError(f'unsafe privileged entry: {member.name}')
            if (member.isfile() or member.isdir()) and member.mode & 0o022:
                raise ValueError(f'group/world-writable archive entry: {member.name}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('usage: verify-veyon-pilot-archive.py ARCHIVE')
    verify(pathlib.Path(sys.argv[1]))
