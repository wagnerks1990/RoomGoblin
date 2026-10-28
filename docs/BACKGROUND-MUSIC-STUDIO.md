# Background Music Studio

Unreleased development work. UI/browser fixtures and player-reported progress
do not establish audible playback on a physical receiver.

## Everyday listening

Open **Background music**. **Now playing** shows the selected output, current
title, transport, listening volume, quick favorite stations, queue and sleep
timer. Select a physical player or a Music Assistant group. Selecting an output
does not start it; choose a source or press Play. Starting managed music on a
different output stops the previously owned session first. RoomGoblin manages
one output/group at a time; use Music Assistant groups for synchronized rooms.

**Find music** filters provider search to songs, stations, albums, artists or
playlists. Results can play now, play next in the current queue, or become a
favorite. A radio URL can be saved explicitly through the expandable stream
form. URLs must use HTTP(S), without embedded credentials. Provider media URIs
remain supported. Search depends on the configured providers and their catalog;
RoomGoblin does not supply or bypass a music subscription.

**Favorites** keeps source IDs and schedule references. Choosing **Use in
schedule** stages a selection; save the Schedule tab to apply it. Removing a
favorite does not abruptly stop music already playing.

The queue shows up to 50 upcoming items, with previous/next, shuffle, repeat and
play-item controls. A seek control appears for finite-duration queue items.
Live radio or dynamic queues may have no upcoming list or may reject shuffle,
repeat or seek. Supporting Music Assistant queue APIs are required; an upstream
rejection remains visible instead of being reported as success.

Sleep stops the managed session after the chosen interval. Explicit Pause/Stop
and sleep expiry suppress watchdog recovery until the operator resumes or the
next scheduled window begins. Sleep and manual playback intent are process-local;
they are not restored across Hub restart. The saved schedule remains persistent.

## Scheduling and priority

The Schedule tab retains enabled state, weekdays, school days, overnight start /
end times, output, favorite, starting volume and the existing priority setting.
Calendar closures and remote-day suppression remain unchanged. Polling does not
overwrite unsaved schedule edits, connection edits or a focused volume field.

Manual song/station selections now enter the same managed recovery path as the
schedule, including outside scheduled hours. A manual selection remains active
until stopped, replaced, its sleep deadline, or normal finite-track completion;
this intentionally differs from the old untracked direct search command. It
does not automatically replace itself with the scheduled favorite on each poll.

Morning Announcements and an operator classroom-media takeover still have audio
priority. Recovery and queue playback cannot start music while priority owns
the room. Music resumes only after the existing display reconciliation releases
priority. Ordinary silent visuals do not interrupt music. A priority takeover or
operator Stop that arrives while a play request is pending is reasserted after
its late acknowledgement.

### Independent hallway displays

In **Displays & AV → Receiver names, mappings & groups**, set a receiver's
**Audio priority** to **Independent (hallway)** and save. The Display content
configuration editor exposes the same setting. Ordinary Sports, video, web,
voice and sound-effect audio on that receiver no longer pauses classroom
Background Music. A manual command aimed only at independent receivers also
leaves the classroom scheduler and other Music Assistant players running.
Mixed classroom/hallway commands still take over the classroom normally.

Morning Announcements remain mandatory priority, including when their targets
are independent. An already active manual classroom takeover is released with
Resume Scheduled State; changing receiver scope does not silently cancel it.
Changes to scope apply to current audible scenes on the next music tick without
reloading displays. The music status includes `priority.independentTargets`
separately from targets that actually hold classroom priority.

This is audio-priority isolation, not physical AV routing or automatic removal
from schedules, receiver groups or Music Assistant groups. Use a hallway name,
tag/group and explicit automation targets for hallway signage; keep independent
receivers out of the classroom music output group. Existing receivers default
to shared classroom audio. The optional `devices[id].audioScope` value is `room`
or `independent`; omitted fields on older editor saves preserve the saved value.
No migration or restart is needed for configuration changes on a supporting
release. Older releases ignore this field and restore shared audio behavior.

Announcement holds are tracked separately from ordinary audible content.
Finishing an announcement cannot discard a restored video's priority, and an
ordinary media-ended event cannot end the mandatory announcement hold. Failed
release reconciliation retains that hold for independent hallway targets too.

## Recovery model

An accepted play command is **starting**, not proof of playback. The Hub observes
Music Assistant's player state and timestamped playback position. A missing or
unavailable player is marked waiting and receives no volume/play mutations.
Player reads are single-flight and retain a short cache.

After unexpected idle/paused state, allow an eight-second grace period, then try
resuming the existing queue before reloading the owned source. Allow twenty
seconds for a submitted play to confirm. Failed recovery attempts back off at
15, 30, 60, 120, 240 and at most 300 seconds. Sustained healthy reported playback
resets that backoff after thirty seconds. An uncertain command timeout receives
an observation grace period; mutations are never blindly replayed over HTTP.
Read-only queue/status/search calls may use the existing HTTP fallback.

Music Assistant can retain an unchanged `elapsed_time` plus
`elapsed_time_last_updated` anchor throughout healthy playback. While the player
reports playing, RoomGoblin estimates its current position as the elapsed value
plus time since that timestamp, matching Music Assistant's position contract.
An unchanged anchor must not trigger a recovery restart every two minutes.
Clock-based estimates do not advance the diagnostic **Last progress** timestamp
or count as newly reported progress; the status explicitly identifies estimation.

When position telemetry is supplied, unchanged effective progress for the
configured 60–600 seconds (default 120) is a suspected stall. Fresh timestamped
reports of the same frozen position still qualify, as do unchanged raw positions
from players without a valid numeric timestamp. Missing elapsed telemetry alone
is not a stall. Paused/idle states are never extrapolated and retain the normal
resume-before-reload recovery path. A normally completed finite manual track is not restarted
as though it were a broken radio station. Recovery reloads retain the listener's
current volume/mute; explicit starts apply saved start volume and unmute.

The Schedule tab can disable automatic recovery. **Recover playback** is an
explicit operator request to reload the currently owned source, retaining
volume/mute and honoring priority audio. It does not reboot hardware, reset
providers or reload receiver pages.

**Recovery & listening details** distinguishes reported playback, confirmed
progress, waiting, suspected stall, retry timing, errors and sleep deadline.
It cannot prove that speakers are audible. Device/network buffering, provider
outages and stale upstream telemetry can still require physical investigation.

## Transport, security and compatibility

Keep the existing dedicated Sendspin endpoint, one-use same-Hub tickets,
per-display identities, SDK 3.2.1 pin, managed WebView lifecycle and autoplay
policies. This change neither upgrades Music Assistant nor recreates adopted
containers. Native Apollo/ESPHome players continue through Music Assistant;
browser displays retain their existing bridge and persistent renderer.

Existing favorites and schedule preference keys remain authoritative. Added
`autoRecover` and `stallSeconds` fields normalize on reads/writes; no DDL,
credential rotation or destructive import is required. New media references are
bounded provider/HTTP(S) URIs; script/data/file URIs and URL credentials are
rejected. The queue response projects at most 50 safe metadata rows and omits
stream details/credentials. Classroom control remains required for music;
connection writes retain administrator authorization. Polling and mutations use
the existing distinct appliance-wide Music Assistant rate budgets, registered
directly before authorization on each route, and writer freeze. Audit entries contain command names, not playback URI payloads.

## Validation and deployment

Targeted tests execute the real tick/start and HTTP queue/command handlers, plus
the recovery monitor: unavailable players, command confirmation/backoff, raw
timestamp anchors across multiple stall windows, frozen-position reports,
progress stalls, track completion, manual Stop, priority races, sleep and safe
queue projections. Browser fixtures cover search/play identity, sleep, responsive
layout, unsaved drafts and stable focused controls. Run the active-worktree Linux
runner and the Chromium/Firefox browser gate before release.

Physical acceptance must include Apollo Cast and managed browser display audio,
a deliberate player reconnect, a provider interruption, station/song changes,
manual Stop, sleep and announcement takeover/release. No fixture establishes
this physical acceptance. If server-reported progress continues while a device
is silent, diagnose the native player/network/provider; avoid restart loops or
fabricated browser activation.

Deploy only the merged commit's exact published images through the guarded
updater with its operational backup. Preserve the current Music Assistant
deployment, data, credentials, networking and LAN-selection compatibility shim.
Rollback uses the updater's previous source/images and matching backup. Older
versions ignore new optional recovery settings; process-local manual/sleep
state is deliberately not carried into a downgrade.
