# Native Veyon pilot binaries

The Validate workflow builds a **complete Linux Veyon 4.11.2 pilot** with
ClassroomChat and RemoteFileBrowser, together with native monitoring, remote
control, demonstrations, file transfer, messaging and the other upstream core
features. It publishes the `RoomGoblin-Veyon-pilot-linux` workflow artifact only
after the full build, file-policy test and installed CLI plugin discovery pass.
An artifact is a test build, not a production release or Windows installer.

Download the artifact from the successful Validate run for the desired commit.
It contains the staged native installation, full corresponding source including
submodules, GPL terms, provenance, plugin/feature inventories and SHA-256 sums.
Artifacts expire after 14 days; retain the source alongside any binary you share.
No paid add-on or trial is activated. The Hub Docker images do not contain these
native binaries and the production updater does not install them.
The Linux artifact builds and advertises InternetGuard so the Linux controller
can dispatch its feature messages to matching Windows endpoints. Its Linux
worker backend always returns unavailable and never changes local networking;
actual firewall mutation remains Windows-only. RoomGoblinTerminal follows the
same split: its shared feature protocol is compiled and discovered on Linux,
while CMD/PowerShell process launch remains Windows-only.

## Build locally

Use a disposable Ubuntu 24.04 amd64 build VM with the dependencies listed in
the `veyon-pilot` job of `.github/workflows/validate.yml`, then run as a normal user:

```bash
bash tools/package-veyon-pilot.sh /tmp/roomgoblin-native-build
```

The destination must not exist. Source and submodules are pinned by
`prepare-veyon-pilot.py`. The script builds all native targets, stages installation
with DESTDIR and verifies both community plugins through the staged CLI. It never
invokes a service manager or installs into the host root. System libraries are
not bundled: use matching Ubuntu 24.04 dependencies, compiler architecture and
Qt generation. Binary archive entries are normalized to numeric root ownership
and rejected if they contain traversal, escaping links or unsafe privileged
metadata. Include `libqca-qt6-plugins`: the QCA development package alone
does not supply the RSA provider required at runtime. This is not a portable
cross-distribution archive.

A host-native source build on Ubuntu 26.04 uses GCC 15. That compiler can emit a
`stringop-overflow` false positive while optimizing QtConcurrent's inlined atomic
increment in `MonitoringMode.cpp`; upstream's target-wide `-Werror` otherwise
stops the build. The pinned preparer adds only
`-Wno-error=stringop-overflow` to `veyon-core`, and only for GNU compiler version
15 or newer. The diagnostic remains a warning, other warnings remain errors, and
the CI Ubuntu 24.04 build is unchanged. Do not replace this with a global warning
disable.

The source preparer redacts native WebAPI debug logging for both RoomGoblin
browser-bridge and Veyon authentication routes. Authentication POST bodies carry
private PEM material and their responses carry private connection identifiers;
neither is safe diagnostic output.

## Pilot installation and acceptance

Use two disposable Ubuntu 24.04 desktop VMs with snapshots and **no existing
Veyon installation**. Do not install on the RoomGoblin appliance or mix these
plugins with Ubuntu's 4.9.7 packages. Windows endpoint interoperability and
Windows packaging remain unvalidated. Separate fail-closed Windows packaging
tooling now exists, but no Windows artifact or live behavior is accepted until
the reviewed toolchain build and disposable-endpoint procedure in
`VEYON-WINDOWS-PILOT.md` pass. Run from the extracted Linux artifact directory:

```bash
sha256sum -c SHA256SUMS
tar -tzf veyon-pilot-linux.tar.gz
```

After reviewing the archive, install its complete contents into each disposable
VM (this writes `/usr` and the upstream systemd unit). Windows endpoint
interoperability and packaging remain unvalidated, including the live-terminal
launch path:

```bash
sudo tar -xzf veyon-pilot-linux.tar.gz -C /
sudo systemctl daemon-reload
veyon-cli plugin list
veyon-cli feature list
```

Configure separate test authentication keys and access rules in Veyon Configurator;
never export production keys for this pilot. Start the pilot Veyon service only
after configuring access. Register the test student in native Master on the test
teacher. The matching Hub can launch browser chat, restricted pilot files and
bounded remote control. Native Master remains useful for native-only workflows.

Test remote view, text messages, screen lock/unlock, demonstration and ordinary
file transfer. Then test ClassroomChat with one student and a reply to the
teacher, followed by multiple students. For RemoteFileBrowser, create a
`RoomGoblin-Pilot` directory in the student's home with ordinary sample files;
verify listings, retrieved-file hashes and preservation of an existing local file
after interrupted transfers. Test atomic Inbox upload with a new small file,
duplicate-name rejection and interrupted-upload cleanup. Other home directories must be rejected. Close the
browser/native file session before replacing the authenticated teacher connection;
the close stops its endpoint worker and clears all reply generations.
See `docs/VEYON-FREE-FEATURES.md` for the resource limits and remaining acceptance
checks. CLI discovery proves loading, not interactive classroom functionality.

Rollback is restoring both VM snapshots. There is no production uninstall or
in-place replacement path: copying individual libraries back cannot reliably
restore an earlier Veyon/Qt installation.

## Browser bridge

The complete Linux build also contains RoomGoblinWebBridge and InternetGuard and
checks their ClipboardWrite, BrowserControl, ClipboardRead, Terminal and
InternetGuard feature inventories. See
[browser clipboard sending](VEYON-WEB-CLIPBOARD.md) and
[browser remote control](VEYON-BROWSER-CONTROL.md) for those acceptance requirements.
See [Veyon live terminal](VEYON-LIVE-TERMINAL.md) and
[Veyon Windows endpoint pilot](VEYON-WINDOWS-PILOT.md) for the separate complete
Windows build, privilege, rollback and disposable-endpoint acceptance requirements.
The archive remains a disposable pilot overlay, not a managed production package.
