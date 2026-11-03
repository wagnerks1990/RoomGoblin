# Music updates and recovery

Administrators open **Updates & recovery** in Background music → Outputs &
connection or ESPHome devices. Automatic updates and service recovery are
independent, opt-in policies. Select each enrolled Apollo CAST-1 separately.
Use **Check stable updates** and **Update now** for an explicit installation.

Automatic upgrades use the System Updates maintenance window in the appliance
time zone and wait for announcements, priority audio and every Music Assistant
player to be idle. A paused queue is retained. Music commands managed by
Background Music wait while integration maintenance is active. Updates do not
change the selected source, volume, provider credentials or device encryption.

## Music Assistant

The Host Agent only accepts the current official stable `music-assistant/server`
2.x release. A new major version needs a compatibility review. It pulls the fixed
official image, resolves its immutable digest, and takes a cold data snapshot
before changing the existing Compose image line. It preserves the deployment's
service/project identity, data directory, environment and LAN compatibility gate.

Supported existing Compose roots are `/opt/music-assistant` and
`/opt/services/music-assistant`, with one explicit Compose file, a matching
`data:/data` bind and host networking. Arbitrary Docker containers, multiple-file
Compose deployments, YAML image interpolation and missing compatibility gates
fail closed. Adoption alone does not permit upgrades: enabling this policy or
requesting Update now explicitly authorizes recreation of that existing service.
New managed deployments still use the separate reviewed deployment image policy.
Before enabling service maintenance, Check stable updates verifies that the Hub
and native updater see the same Music Assistant server identity. Changing the
Hub connection suspends the policy until the local identity is checked again.

The native worker holds the appliance mutation lock, journals each phase under
`/var/lib/classroom-hub/music-updates`, preserves a cold SQLite-checked snapshot,
and verifies the running image identity and reported server version. Failure or
interruption restores the previous image with its matching data, retaining the
migrated data separately for investigation. It never downgrades a migrated
database in place. Host Agent startup serves health before recovery. An unresolved
rollback keeps host mutations locked and reports `rollback-required`.
Snapshot completion and deployment mutation claims are persisted separately from
error status. Interrupted copies never replace live data, even if restarting the
original service also fails and recovery must continue after a host restart.
Integrity probes explicitly close every SQLite connection before copying data
or starting the service. Ending a Python connection context alone does not
release its WAL reader locks; update and rollback must not depend on garbage
collection to make the restored database usable.

Snapshots remain on the appliance for administrator recovery. They include
credentials and are private to root. Insufficient space fails before the service
stops. Do not remove the most recent snapshot or failed-data directory until the
update has been accepted. A successful server health check does not prove that
each external music provider can authenticate or that speakers are audible.

## Apollo firmware

The enrolled native API must report project `ApolloAutomation.CAST-1`, model
`esp32-s3`, the Stable channel, and an update version matching the official
Apollo CAST-1 GitHub release. Firmware updates use the device's existing vendor
update entity. RoomGoblin does not accept a firmware URL, compile custom code,
erase flash, change Wi-Fi settings or replace encryption keys.

The claim is persisted before dispatch. Only reconnection of the same pinned MAC
and enrollment generation reporting the exact expected project version marks an
update successful. A timeout or interrupted response remains unconfirmed and is
never blindly replayed. Review the device locally if delivery is unconfirmed.
Firmware rollback is not automatic: a device that cannot reconnect may need the
vendor's recovery/USB procedure and the previous official OTA image. Full Recovery
preserves RoomGoblin enrollment but does not restore an ESP32 flash image.

ESPHome entity IDs include their native domain, subdevice and key. This keeps a
firmware button and firmware update entity with the same key distinct. Apollo's
legacy update button is read-only; use the journaled update control instead.

## Recovery and limits

The existing ESPHome worker reconnects with bounded backoff, pins the device MAC,
and restarts after worker failure. It never replays a hardware command. Automatic
device power cycling or factory reset is not part of recovery.

Music Assistant caches position anchors, including Sendspin anchors, during
healthy playback. An old timestamp cannot establish an audio stall. In Updates &
recovery, explicitly select the **Playback health output** connected to each
Apollo. RoomGoblin pins this link to the Music Assistant server and native
enrollment identity; it never guesses matching MAC addresses or friendly names.
The physical Apollo speaker must report idle continuously for the configured
stall interval while Music Assistant reports playing before this evidence can
trigger recovery. Offline, stale, replaced or ambiguous native observations are
ignored. This reports device playback state, not proof of audible sound.

Recover playback can reopen the
current queue item after a stream fails while its group still says playing. It
preserves the queue, repeat/shuffle and volume, and uses Music Assistant's
estimated finite-track queue position (radio restarts at its live edge). An idle/completed existing queue is
not automatically replayed. Repair uses the selected output, including a queue
observed after Hub restart, and preserves announcement priority and bounded retry.
If Music Assistant has already marked the item unavailable, repair reports that
condition without skipping the queue. Start the station again from Favorites or
choose another source after the provider is available. During a reload, Music
Assistant retains its own fallback behavior for newly discovered unplayable media.

Optional service recovery requires three failed Music Assistant reads, no active
announcement/priority audio, and an independent failed host-local health check.
It never starts an intentionally stopped service. The root-owned restart ledger
limits recovery to one attempt per 30 minutes and three per day across Hub/host
restarts. Provider login errors with a healthy service require provider repair;
restarting the service is not a substitute for authentication.

Validation must distinguish isolated regression tests, deployed identity checks,
device reconnection/version reports, and physical audible playback.
