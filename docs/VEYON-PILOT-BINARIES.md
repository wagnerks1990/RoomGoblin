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
Qt generation. Include `libqca-qt6-plugins`: the QCA development package alone
does not supply the RSA provider required at runtime. This is not a portable
cross-distribution archive.

## Pilot installation and acceptance

Use two disposable Ubuntu 24.04 desktop VMs with snapshots and **no existing
Veyon installation**. Do not install on the RoomGoblin appliance or mix these
plugins with Ubuntu's 4.9.7 packages. Windows endpoint interoperability and
Windows packaging remain unvalidated. Run from the extracted artifact directory:

```bash
sha256sum -c SHA256SUMS
tar -tzf veyon-pilot-linux.tar.gz
```

After reviewing the archive, install its complete contents into each disposable
VM (this writes `/usr` and the upstream systemd unit):

```bash
sudo tar -xzf veyon-pilot-linux.tar.gz -C /
sudo systemctl daemon-reload
veyon-cli plugin list
veyon-cli feature list
```

Configure separate test authentication keys and access rules in Veyon Configurator;
never export production keys for this pilot. Start the pilot Veyon service only
after configuring access. Register the test student in native Master on the test
teacher. Native chat/file browsing is launched from Master, not the Hub WebAPI.

Test remote view, text messages, screen lock/unlock, demonstration and ordinary
file transfer. Then test ClassroomChat with one student and a reply to the
teacher, followed by multiple students. For RemoteFileBrowser, create a
`RoomGoblin-Pilot` directory in the student's home with ordinary sample files;
verify listings, retrieved-file hashes and preservation of an existing local file
after interrupted transfers. Other home directories must be rejected. Restart
the disposable endpoint service before replacing the first teacher connection.
See `docs/VEYON-FREE-FEATURES.md` for the resource limits and remaining acceptance
checks. CLI discovery proves loading, not interactive classroom functionality.

Rollback is restoring both VM snapshots. There is no production uninstall or
in-place replacement path: copying individual libraries back cannot reliably
restore an earlier Veyon/Qt installation.
