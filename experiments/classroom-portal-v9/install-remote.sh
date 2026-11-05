#!/usr/bin/env bash
# Download exactly one immutable GitHub source commit, then run its local installer.
set -euo pipefail
[[ "$EUID" -eq 0 ]] || { echo 'Run with sudo.' >&2; exit 1; }
REV="${1:?Usage: sudo bash install-remote.sh COMMIT_SHA HTTPS_ORIGIN}"
ORIGIN="${2:?An exact HTTPS public origin is required.}"
[[ "$REV" =~ ^[0-9a-f]{40}$ ]] || { echo 'Use a full immutable commit SHA.' >&2; exit 1; }
command -v curl >/dev/null
command -v python3 >/dev/null
WORK="$(mktemp -d /tmp/roomgoblin-classroom-v9.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT
curl --proto '=https' --tlsv1.2 --fail --location --silent --show-error \
  --connect-timeout 10 --max-time 120 --retry 2 \
  "https://codeload.github.com/wagnerks1990/RoomGoblin/zip/$REV" -o "$WORK/source.zip"
python3 - "$WORK" <<'PY'
import pathlib,sys,zipfile
work=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(work/'source.zip') as z:
    selected=[]
    for info in z.infolist():
        parts=pathlib.PurePosixPath(info.filename).parts
        if len(parts)>3 and parts[1:3]==('experiments','classroom-portal-v9') and not info.is_dir():
            relative=pathlib.PurePosixPath(*parts[3:])
            if '..' in relative.parts or relative.is_absolute() or ((info.external_attr>>16)&0o170000)==0o120000:
                raise SystemExit('Unsafe source archive entry.')
            if info.file_size>2_000_000:raise SystemExit('Unexpected oversized source file.')
            selected.append((info,relative))
    if not selected:raise SystemExit('Selected commit has no v9 source package.')
    for info,relative in selected:
        dest=work/'package'/relative
        dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_bytes(z.read(info))
PY
bash "$WORK/package/install.sh" --public-origin "$ORIGIN" --repair-legacy-startup
