#!/usr/bin/env python3
"""Fail closed unless a file is a non-truncated x86-64 Windows PE image."""
import argparse
from pathlib import Path
import struct


def verify(path, allow_x86=False):
    path = Path(path)
    data = path.read_bytes()
    if len(data) < 0x40 or data[:2] != b'MZ':
        raise ValueError(f'{path}: missing DOS MZ header')
    pe_offset = struct.unpack_from('<I', data, 0x3C)[0]
    if pe_offset < 0x40 or pe_offset + 24 > len(data):
        raise ValueError(f'{path}: invalid or truncated PE header offset')
    if data[pe_offset:pe_offset + 4] != b'PE\0\0':
        raise ValueError(f'{path}: missing PE signature')
    machine = struct.unpack_from('<H', data, pe_offset + 4)[0]
    allowed = {0x8664, 0x14C} if allow_x86 else {0x8664}
    if machine not in allowed:
        expected = 'x86 or x86-64' if allow_x86 else 'x86-64'
        raise ValueError(f'{path}: expected {expected} PE image, got machine 0x{machine:04x}')
    sections = struct.unpack_from('<H', data, pe_offset + 6)[0]
    optional_size = struct.unpack_from('<H', data, pe_offset + 20)[0]
    if sections < 1 or optional_size < 0x70 or pe_offset + 24 + optional_size > len(data):
        raise ValueError(f'{path}: incomplete PE metadata')
    architecture = 'x86-64' if machine == 0x8664 else 'x86'
    print(f'{path}: valid {architecture} PE image')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--allow-x86', action='store_true',
                        help='also allow an x86 PE bootstrap (for the NSIS installer only)')
    parser.add_argument('path')
    args = parser.parse_args()
    verify(args.path, allow_x86=args.allow_x86)
