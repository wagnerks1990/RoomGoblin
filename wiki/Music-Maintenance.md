# Music maintenance

Open **Updates & recovery** in Background music → Outputs & connection or ESPHome
devices. Administrators can opt into stable Music Assistant updates, per-device
Apollo CAST-1 firmware updates and bounded service recovery.

Select each Apollo's **Playback health output** to enable physical speaker-state
checks. Cached Music Assistant position timestamps are never treated as stalled
audio. The link is explicit and tied to the enrolled device and server identity.

A changed enrollment invalidates the previous link. **Now playing** and
**Updates & recovery** report when relinking is required. Use **Check stable
updates**, verify the **Playback health output**, then **Save maintenance policy**.
Polling never adopts a changed identity. Offline or stale reports remain waiting.

After sustained physical idle contradicts Music Assistant's playing state,
recovery reloads the owned source directly instead of sending an ineffective
Play command. Existing queues, volume, retry backoff and announcement priority
remain protected. If both systems still report playing, these readings alone
cannot establish silence.

Updates wait for idle playback in the System Updates maintenance window. Music
Assistant takes a cold rollback snapshot. Apollo success requires the same
enrolled device to reconnect with the selected firmware version. Unconfirmed
firmware is not replayed; service recovery is limited to three attempts per day.

See the [complete maintenance and rollback contract](../docs/MUSIC-MAINTENANCE.md)
for supported deployments, retained snapshots, recovery limits and validation.
