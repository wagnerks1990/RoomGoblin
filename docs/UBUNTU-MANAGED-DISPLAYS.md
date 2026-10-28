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
Closing the wizard discards its activation target and ignores its late replies;
the installation continues on the Hub without changing a later wizard session.

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
agents. Protocol 1 computers need **Repair / update agent** with administrator
SSH once to install protocol 2. Afterwards **Software & updates / Manage updates**
uses the existing restricted enrollment without asking for administrator credentials.
An unavailable management key or broken bootstrap still requires administrator repair.

## Monitoring and daily administration

The inventory separates computer connectivity, kiosk heartbeat, each browser process
and each receiver connection. A running browser is not proof that the physical panel
is on or that audio is audible. Four bounded SSH workers poll every 30 seconds; a
second pass cannot overlap the first. Status older than 90 seconds is unconfirmed.
Monitoring continues when no browser is open, and polling pauses during Full Recovery.

Cards show CPU utilization between samples, available memory, disk space, uptime,
Ubuntu/kernel and Chromium versions, and the installed agent package digest compared
with the Hub. Low disk (<10%), low available memory (<8%), missing sessions/receivers,
reboot requirements and failed maintenance are explicit alerts. Last-seen information
and the latest 50 health/action events per computer survive Hub restart in SQLite;
remote maintenance retains 20 job results. No screenshots or raw process output are
saved in this history. This is bounded operational history, not a long-term metrics
or external notification service.

**Edit computer** manages name, location, notes and SSH address/port. An address change
must authenticate the original pinned host key and return the original device and
machine identity before it is saved. Names never change receiver IDs. Filters and
open sections survive refreshes; dialogs keep unsaved drafts. Screen assignment can
pause an output without deleting its identity, retain unavailable audio sinks muted,
and choose automatic hardware acceleration or software compatibility. Existing
assignments keep their software mode until explicitly changed; verify GPU/video
behavior on the actual computer before changing modes.

## Software maintenance and scheduling

All operations require administrator access and explicit confirmation. Computer
operations affect every screen. Disruptive dispatch is blocked while Morning
Announcements own any assigned receiver. A job already running cannot be safely
interrupted by a later announcement; schedule maintenance outside teaching hours.

| Operation | Behavior and recovery |
| --- | --- |
| Check updates | Refresh configured Ubuntu package sources, simulate non-removing upgrades, and check Chromium Snap availability. Report package candidates and security-source counts. No packages are installed. |
| Install Ubuntu updates | Run the native non-removing apt upgrade, keep existing configuration files and save a private pre-update package inventory. No distribution upgrade, removal, autoremove or automatic reboot. APT/dpkg history supports diagnosis; this is not a complete OS snapshot or automatic package downgrade. |
| Update Chromium | Stop the managed graphical session, refresh only Chromium, then restart the session even if refresh fails. Use Restore previous Chromium revision when Snap retains a suitable revision. |
| Update RoomGoblin agent | Fetch only the fixed five-file package from the fixed RoomGoblin repository's trusted main commit over HTTPS. Its normalized SHA-256 package digest must exactly match the package in the running Hub. No caller-supplied source, URL, repository, shell command or arbitrary revision is accepted. Preserve identity, profiles and assignments; restart the active kiosk after success. |
| Restore previous agent | Verify and restore the retained package/identity, then restart the active kiosk. Does not revert screen assignments or browser profiles. |

Agent updates preflight imports, retain a verified previous package and journal before
replacing files. Failed post-install checks restore those files and identity. A separate
root-owned recovery copy runs at boot before LightDM, so a torn installed module does
not prevent rollback. Failure or interruption is surfaced; package operations are never
blindly repeated. Original pre-enrollment desktop rollback remains separate and intact.

The restricted helper starts only the fixed root-owned
`roomgoblin-display-maintenance.service`. A computer-wide file lock serializes
configuration, lifecycle commands and the maintenance worker. Jobs run independently
of the browser/SSH request, persist under `/var/lib/roomgoblin-display`, have a bounded
45-minute unit timeout, and report accepted/running/completed/failed/interrupted states.
Completion means the package operation returned successfully; live screen status is
separate acceptance evidence. Raw package output and credentials are never returned.
Fresh or unloaded one-shot services start directly; only a failed service has its
failure state reset. If a proxy returns an HTML error instead of JSON, the wizard
reports the HTTP status and asks the operator to refresh device status before retrying
because delivery may be uncertain. It never automatically resubmits the operation.

**Schedule once** stores a confirmed operation up to 30 days ahead. The browser's local
time is converted to an absolute timestamp. The Hub waits up to one hour for a reachable
computer and for announcements to finish; after that the job expires. A saved claim
precedes dispatch, preventing replay after a Hub crash or uncertain delivery. The
computer also retains up to 2048 request receipts for 32 days, rejecting additional
jobs at that limit rather than forgetting unexpired receipts; restoring an older
Hub backup cannot repeat an already accepted request. Cancel
pending jobs explicitly. Cancellation remains effective while a screen-assignment
save is awaiting the computer: that save updates only configuration and preserves
the latest schedule, history and other metadata. The Hub must be running and connected to dispatch; if it was
unavailable beyond the grace period, nothing runs later without a new request. Recurring
automatic installation policies are not enabled by this feature. Ubuntu's own unattended
upgrade and Snap refresh policies remain in force; RoomGoblin does not silently disable
their security updates or claim exclusive ownership of OS updates.

Native helper package downloads require public GitHub access. Package updates use the
computer's configured authenticated apt sources and Snap store. Repository management,
OS reinstall, BIOS/firmware and arbitrary remote shells are outside this fixed helper.
The GUI never treats an update check as evidence an update has been installed.

## Limits and validation

Repair reserves the existing computer before its initial probe, so polling or
another command cannot share that operation. Failed admission releases only the
repair's own reservation. Installation checks announcement locks for both prior
and proposed screen targets; it checks again before final configuration. If
announcements or Full Recovery admission begin while installation is running,
the job needs attention and does not send a new configuration write. Accepted
installer work is not automatically undone or repeated.

The wizard retires probe and fingerprint replies after relevant inputs or trust
choices change. Key-file failures are visible and late reads cannot overwrite a
newer pasted key. One wizard submission remains pending across close/reopen;
completion cannot advance or close a newer draft. Accepted installation clears
unchanged submitted credentials while preserving newer values. An unconfirmed
reply requires a status refresh before an explicit retry; no write is replayed.

Installation and repair completion update their owned readiness state and
acknowledged screen configuration.
Cancellation and history saved while the installer is pending remain intact on
both success and failure. A failed completion save remains visible; it never
repeats the installer or restores an older scheduled job.

Repair retains the last confirmed screen configuration until the computer
acknowledges its replacement. Before repair or assignment dispatch, RoomGoblin
persists the union of previous, proposed and still-uncertain receiver targets.
Announcement checks keep protecting those targets across failures, restart and
later repairs. Acknowledged configuration atomically promotes the new mapping
and clears that protection. Unconfirmed mappings remain visible in health and
are never automatically replayed. This tracks new operations; it cannot
reconstruct mappings already lost by older releases.

The inventory has one shared refresh owner. A write invalidates older reads and
queues a fresh read after outstanding writes settle; uncertain writes are not
automatically repeated. Assignment editing uses the refreshed configuration.
Computer commands, metadata saves and maintenance submissions retain per-computer
admission and feedback across polling and filtering. Newer dialog drafts remain
unsaved and visible after an older submission finishes. Closed-dialog failures
remain on the original computer's card. Preview captures have their own lifetime:
closing or requesting another capture retires the old result and clears its image.

An accepted command or maintenance job is not reported as failed solely because
its computer-history append fails. The response retains its outcome and job ID
with a visible warning; the shared audit owner still receives the event and its
history-persistence status. Saved metadata, schedules and cancellations use the
same distinction. Primary persistence, pre-dispatch claims and uncertain SSH
delivery still fail visibly. No operation is automatically repeated. A failed
per-computer history entry is not reconstructed or claimed as persisted.

This release supports the dedicated Xorg kiosk on Ubuntu LTS x86-64. Windows,
ARM, Wayland kiosk sessions, Wake-on-LAN, per-monitor hardware power, recurring automatic OS upgrades and offline content caching are not
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
independent receiver assignments, update/schedule controls, filtered health views,
draft retention and credential clearing. Native regressions cover fixed update operations,
source/digest verification, concurrency, interrupted jobs and failed-update rollback.
Physical acceptance must additionally verify reboot, window placement, sustained
media, announcements/audio, network reconnection, monitor reconnect and rollback.

The 2026-10-26 pilot verified two independent 3840x2160 outputs with different
existing receiver content, output-specific captures, reboot/session recovery and
separate configured audio sinks. Restarting one screen changed only its browser
process; the other remained running. Configuration rollback restored every saved
file byte-for-byte and restarted the previous desktop, followed by successful
repair/reactivation. Audible output, physical cable removal and sustained
announcement playback still require operator acceptance on each installation.
