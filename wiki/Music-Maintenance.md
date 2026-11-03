# Music maintenance

Open **Updates & recovery** in Background music → Outputs & connection or ESPHome
devices. Administrators can opt into stable Music Assistant updates, per-device
Apollo CAST-1 firmware updates and bounded service recovery.

Updates wait for idle playback in the System Updates maintenance window. Music
Assistant takes a cold rollback snapshot. Apollo success requires the same
enrolled device to reconnect with the selected firmware version. Unconfirmed
firmware is not replayed; service recovery is limited to three attempts per day.

See the [complete maintenance and rollback contract](../docs/MUSIC-MAINTENANCE.md)
for supported deployments, retained snapshots, recovery limits and validation.
