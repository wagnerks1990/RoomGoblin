#!/usr/bin/env bash
# Build a complete x86_64 Windows Veyon pilot in Veyon's MinGW/Qt toolchain.
# This creates artifacts only. It never installs Veyon or contacts endpoints.
set -Eeuo pipefail

[[ $# == 1 ]] || { echo 'Usage: package-veyon-pilot-windows.sh NEW_WORK_DIRECTORY' >&2; exit 2; }
work="$1"
[[ ! -e "$work" && ! -L "$work" ]] || { echo 'Work directory must not exist.' >&2; exit 2; }

for command in python3 git cmake ninja makensis tar sha256sum; do
	command -v "$command" >/dev/null || { echo "Missing Windows build dependency: $command" >&2; exit 2; }
done

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mingw_prefix="${VEYON_MINGW_PREFIX:-/usr/x86_64-w64-mingw32}"
qt_cmake="${VEYON_QT_CMAKE:-$mingw_prefix/bin/qt-cmake}"
[[ -x "$qt_cmake" ]] || {
	echo "Missing matching Qt cross-build launcher: $qt_cmake" >&2
	echo 'Run this script only in the reviewed Veyon x86_64 MinGW/Qt build environment.' >&2
	exit 2
}

mkdir -p "$work"
work="$(cd "$work" && pwd)"
python3 "$root/tools/prepare-veyon-pilot.py" "$work/source"

"$qt_cmake" -S "$work/source" -B "$work/build" -G Ninja \
	-DCMAKE_BUILD_TYPE=Release -DWITH_LTO=OFF

# windows-binaries assembles the complete matching runtime tree. Do not package
# individual plugin DLLs: Veyon core, Qt, plugins and runtime dependencies are
# one ABI-matched pilot.
cmake --build "$work/build" --target windows-binaries --parallel 2

mapfile -t runtime_dirs < <(find "$work/build" -maxdepth 1 -type d -name 'veyon-win64-*' -print)
[[ ${#runtime_dirs[@]} == 1 ]] || {
	printf 'Expected one complete win64 runtime directory; found %s.\n' "${#runtime_dirs[@]}" >&2
	exit 1
}
runtime_dir="${runtime_dirs[0]}"

required_plugins=(classroomchat internetguard remotefilebrowser webbridge)
for plugin in "${required_plugins[@]}"; do
	plugin_path="$runtime_dir/plugins/$plugin.dll"
	[[ -f "$plugin_path" ]] || { echo "Missing required Windows pilot plugin: $plugin_path" >&2; exit 1; }
	python3 "$root/tools/verify-veyon-windows-pe.py" "$plugin_path"
done

for executable in veyon-cli.exe veyon-service.exe veyon-server.exe veyon-worker.exe; do
	[[ -f "$runtime_dir/$executable" ]] || { echo "Missing required Windows runtime executable: $executable" >&2; exit 1; }
	python3 "$root/tools/verify-veyon-windows-pe.py" "$runtime_dir/$executable"
done

find "$runtime_dir/plugins" -maxdepth 1 -type f -name '*.dll' -printf '%f\n' | LC_ALL=C sort > "$work/windows-plugins.txt"
printf '%s\n' \
	ClassroomChat RemoteFileBrowser RoomGoblinKeySequence RoomGoblinBrowserControl \
	RoomGoblinClipboardWrite RoomGoblinClipboardRead RoomGoblinTerminal \
	InternetGuard InternetGuardBlock InternetGuardAllow > "$work/expected-community-features.txt"

# The upstream installer target consumes the verified runtime tree and removes
# it after producing the NSIS installer.
cmake --build "$work/build" --target create-windows-installer --parallel 2
mapfile -t installers < <(find "$work/build" -maxdepth 1 -type f -name 'veyon-*-win64-setup.exe' -print)
[[ ${#installers[@]} == 1 ]] || {
	printf 'Expected one complete win64 NSIS installer; found %s.\n' "${#installers[@]}" >&2
	exit 1
}
# NSIS itself can use an x86 bootstrap for a win64 payload. The installed
# executables and plugins above remain strictly x86-64.
python3 "$root/tools/verify-veyon-windows-pe.py" --allow-x86 "${installers[0]}"

mkdir -p "$work/artifacts"
cp "${installers[0]}" "$work/artifacts/"
cp "$work/windows-plugins.txt" "$work/artifacts/plugins-built.txt"
cp "$work/expected-community-features.txt" "$work/artifacts/features-expected.txt"
cp "$root/docs/VEYON-WINDOWS-PILOT.md" "$work/artifacts/README.md"
cp "$root/integrations/veyon-plugins/COPYING" "$work/artifacts/COPYING"
cp "$root/integrations/veyon-plugins/PROVENANCE.md" "$work/artifacts/PROVENANCE.md"
git -C "$root" rev-parse HEAD > "$work/artifacts/roomgoblin-revision.txt"
git -C "$work/source" rev-parse HEAD > "$work/artifacts/veyon-revision.txt"
tar --exclude=.git -czf "$work/artifacts/veyon-pilot-source.tar.gz" -C "$work" source

(
	cd "$work/artifacts"
	sha256sum ./*.exe ./*.tar.gz > SHA256SUMS
)

echo "Windows pilot artifacts: $work/artifacts (not installed; disposable testing only)"
echo 'Runtime feature discovery still must pass on a disposable Windows endpoint.'
