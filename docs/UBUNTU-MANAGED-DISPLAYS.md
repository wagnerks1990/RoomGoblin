# Ubuntu managed display computers

Managed Displays includes Ubuntu computers alongside the existing Android/ADB
inventory. A computer owns independent physical screen assignments: each selected
HDMI/DisplayPort connector has a unique existing or new RoomGoblin receiver ID,
its own Chromium profile/window, content, groups and schedules. The ordinary
display renderer and announcement/audio priority rules remain authoritative.

## Enroll

1. Install Ubuntu 22.04, 24.04 or 26.04 LTS on an x86-64 computer, enable SSH,
   and connect its monitors. The Hub must reach its private IPv4 SSH address.
2. Open Managed Displays over HTTPS (or loopback through an SSH tunnel), then
   choose **Add Ubuntu computer**. Enter the address, port and administrator
   SSH account. Root or passwordless sudo is required for installation.
3. Read the SSH host fingerprint and compare it with the computer or a previously
   trusted SSH inventory. Accept it explicitly. Choose an SSH key or password.
   Bootstrap credentials are not saved; encrypted private keys can use a passphrase.
4. Check the computer. Assign each connected Xorg output its own receiver ID,
   name, advertised resolution, rotation and audio output. Matching EDID values on identical
   monitors are disambiguated by connector; a missing identity fails closed.
5. Review and confirm installation. The installer snapshots desktop configuration,
   installs the Chromium Snap/Xorg/Openbox/LightDM dependencies and restricted
   accounts, and verifies independent management access before reporting success.
6. Activate the kiosk. This restarts the graphical session on the computer.
   Verify every screen's placement, content and audio. **Identify screens** shows
   temporary numbered cards without replacing the receiver sessions.

A fresh Server install or Wayland desktop may not expose Xorg outputs yet. In
that case, install and activate the prepared kiosk first, then use **Assign
screens** to select its detected monitors. Screen configuration is preserved
across normal reboot. Missing/replaced connectors or monitors need explicit
reassignment; the agent never guesses a different receiver or output.

Existing receiver IDs keep their groups, content and schedules. New receivers
default to independent audio scope. The physical output connector is separate
from the AV matrix's output number: this feature never guesses an AV mapping.
Multiple simultaneous hosts must not share a receiver ID. The installer cannot
infer whether an unmanaged browser elsewhere is using an existing ID; the
administrator must retire that old session before assigning the ID here.

## Management and trust

`src/ubuntu-displays.js` supplies the administrator API at
`/api/v1/ubuntu-displays`; `public/managed-displays/ubuntu.js` owns its wizard and
inventory. Existing Android controls, ADB availability and enrollment are separate.

Routine management uses SSH with a pinned SHA-256 host fingerprint and a unique
RSA key encrypted in SQLite `secret_store`. The `rg-display-mgr` account has a
root-owned restricted `authorized_keys` forced command, no forwarding/PTY, and
only one exact sudo grant: the fixed `control.py` entry point without arguments.
That entry point accepts bounded JSON and allowlisted actions. There is no remote
shell UI or arbitrary root command API. SSH errors and installer output are not
returned verbatim, and neither keys nor bootstrap credentials belong in logs.

The `rg-display` kiosk account has a locked password and no sudo access. Its
session uses the systemd user D-Bus, Xorg extended desktop, and separate Chromium
profiles beneath the Snap-owned `~/snap/chromium/common/roomgoblin/` tree.
Chromium never inherits a console file descriptor. Root-owned managed autoplay
policy is scoped to the configured Hub origin. Verify effective Chromium policy
and audible playback on the actual hardware; a running browser alone is not proof
of audio. Stable display URLs and optional browser credential enrollment retain
their existing behavior.

The computer's SSH connection, kiosk session, individual browser processes and
Hub receiver WebSocket are reported separately. Preview captures only the selected
output geometry. Restart screen replaces only that screen's browser. Reboot,
shutdown, activation and rollback require explicit confirmation and affect the
whole computer. Commands with uncertain delivery are not automatically replayed.
Installation jobs survive browser closure; after a Hub restart, an incomplete
enrollment remains visible for explicit repair instead of being retried blindly.

Registry/key writes, installation jobs and management actions participate in the
Hub's Full Recovery writer drain. Device identity, records and encrypted keys
are included in the normal SQLite recovery identity. Recovery never impersonates
a different computer solely because its IP address matches.

## Rollback and removal

Before package changes, installation stores the original LightDM configuration,
display-manager selection and any overwritten RoomGoblin-owned policy files under
`/var/lib/roomgoblin-display/rollback`, accessible only to root. Existing users,
SSH credentials, other home directories and browser profiles remain untouched.
The first snapshot is retained across repairs. A durable installation marker
allows a partial installation to be repaired with the same device identity.

**Restore previous desktop** stops the kiosk, restores the captured configuration
and previous display manager, and removes the newly added sudo grant when absent
before installation. Newly installed packages, dedicated accounts and browser
profiles are retained for diagnosis; this is configuration rollback, not an OS
image restore. SSH and virtual-console recovery remain available. If management
is unavailable, an administrator can run the installed Python `installer.rollback`
function locally from `/usr/local/libexec/roomgoblin-display`.

**Remove enrollment** deletes only Hub management metadata and its stored key.
It leaves computer files and receiver IDs intact. Restore the old desktop first
when the intent is also to stop the kiosk. Removal is deliberately not a wipe.

Hub deployment uses the normal exact-main-image updater and its operational
backup/source/database rollback. It does not silently upgrade remote computer
agents. Use **Repair / update agent** with administrator SSH access to explicitly
install the Hub's reviewed package while retaining the device identity/profiles.

## Limits and validation

This release supports the dedicated Xorg kiosk on Ubuntu LTS x86-64. Windows,
ARM, Wayland kiosk sessions, Wake-on-LAN, per-monitor hardware power, automatic OS upgrades and offline content caching are not
implemented. Browser-level volume follows the existing receiver controls. Each screen can
select an advertised audio sink or stay muted. The selected existing card profiles
are restored in the dedicated kiosk session; unavailable selected sinks fail muted
and report a diagnostic instead of playing through a different output. Multiple 4K outputs remain subject to
the GPU, driver, cable, video decoder and Xorg framebuffer limits; unsupported
modes are reported rather than silently mirrored.

Regression coverage: `test/ubuntu-displays.test.js` exercises real SSH host-key
verification, transport bounds, credentials, enrollment, failed installs,
authorization, recovery freeze and assignment conflicts. It runs
`test/ubuntu_display_test.py` on Linux for output identity/hotplug/configuration
checks. The operator browser suite exercises the wizard at desktop/mobile sizes,
independent receiver assignments, draft retention and credential clearing.
Physical acceptance must additionally verify reboot, window placement, sustained
media, announcements/audio, network reconnection, monitor reconnect and rollback.

The 2026-10-26 pilot verified two independent 3840x2160 outputs with different
existing receiver content, output-specific captures, reboot/session recovery and
separate configured audio sinks. Restarting one screen changed only its browser
process; the other remained running. Configuration rollback restored every saved
file byte-for-byte and restarted the previous desktop, followed by successful
repair/reactivation. Audible output, physical cable removal and sustained
announcement playback still require operator acceptance on each installation.
