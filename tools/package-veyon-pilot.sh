#!/usr/bin/env bash
# Build a complete native pilot without installing files or starting services.
set -Eeuo pipefail
[[ $# == 1 ]] || { echo 'Usage: package-veyon-pilot.sh NEW_WORK_DIRECTORY' >&2; exit 2; }
[[ $(uname -s) == Linux ]] || { echo 'This package targets Linux only.' >&2; exit 2; }
work="$1"
[[ ! -e "$work" && ! -L "$work" ]] || { echo 'Work directory must not exist.' >&2; exit 2; }
for command in python3 git cmake ninja tar sha256sum; do
  command -v "$command" >/dev/null || { echo "Missing build dependency: $command" >&2; exit 2; }
done
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$work"
work="$(cd "$work" && pwd)"
python3 "$root/tools/prepare-veyon-pilot.py" "$work/source"
cmake -S "$work/source" -B "$work/build" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release -DWITH_LTO=OFF -DWITH_TRANSLATIONS=OFF \
  -DCMAKE_INSTALL_PREFIX=/usr -DCMAKE_INSTALL_LIBDIR=lib
cmake --build "$work/build" --parallel 2
"$work/build/plugins/remotefilebrowser/roomgoblin-pilot-policy-test"
# DESTDIR stages upstream's absolute service paths too. Never use sudo here.
DESTDIR="$work/stage" cmake --install "$work/build"
mkdir -p "$work/artifacts" "$work/home"
export QT_QPA_PLATFORM=offscreen
export XDG_CONFIG_HOME="$work/home/config"
export LD_LIBRARY_PATH="$work/stage/usr/lib/veyon"
"$work/stage/usr/bin/veyon-cli" plugin list > "$work/artifacts/plugins.txt"
grep -Fxq ClassroomChat "$work/artifacts/plugins.txt"
grep -Fxq RemoteFileBrowser "$work/artifacts/plugins.txt"
grep -Fxq RoomGoblinWebBridge "$work/artifacts/plugins.txt"
grep -Fxq InternetGuard "$work/artifacts/plugins.txt"
"$work/stage/usr/bin/veyon-cli" feature list > "$work/artifacts/features.txt"
grep -Fxq RoomGoblinClipboardWrite "$work/artifacts/features.txt"
grep -Fxq RoomGoblinKeySequence "$work/artifacts/features.txt"
grep -Fxq RoomGoblinBrowserControl "$work/artifacts/features.txt"
grep -Fxq RoomGoblinClipboardRead "$work/artifacts/features.txt"
grep -Fxq RoomGoblinTerminal "$work/artifacts/features.txt"
grep -Fxq InternetGuard "$work/artifacts/features.txt"
grep -Fxq InternetGuardBlock "$work/artifacts/features.txt"
grep -Fxq InternetGuardAllow "$work/artifacts/features.txt"
cp "$root/docs/VEYON-PILOT-BINARIES.md" "$work/artifacts/README.md"
cp "$root/integrations/veyon-plugins/COPYING" "$work/artifacts/COPYING"
cp "$root/integrations/veyon-plugins/PROVENANCE.md" "$work/artifacts/PROVENANCE.md"
git -C "$root" rev-parse HEAD > "$work/artifacts/roomgoblin-revision.txt"
git -C "$work/source" rev-parse HEAD > "$work/artifacts/veyon-revision.txt"
# CMake's DESTDIR install can inherit a runner umask/permission normalization.
# Restore and verify the two upstream-declared setuid-root helper modes inside
# the isolated staging tree before archive metadata is normalized to root.
for helper in veyon-auth-helper veyon-input-helper; do
  chmod 4755 "$work/stage/usr/bin/$helper"
  [[ $(stat -c '%a' "$work/stage/usr/bin/$helper") == 4755 ]] || { echo "Invalid staged mode for $helper" >&2; exit 1; }
done
# Include all corresponding source, including initialized submodules, and omit
# only Git metadata. The build directory and runtime configuration are separate.
tar --exclude=.git -czf "$work/artifacts/veyon-pilot-source.tar.gz" -C "$work" source
tar --numeric-owner --owner=0 --group=0 -czf "$work/artifacts/veyon-pilot-linux.tar.gz" -C "$work/stage" .
python3 "$root/tools/verify-veyon-pilot-archive.py" "$work/artifacts/veyon-pilot-linux.tar.gz"
(
  cd "$work/artifacts"
  sha256sum ./*.tar.gz > SHA256SUMS
)
echo "Pilot artifacts: $work/artifacts (not installed; Linux only)"
