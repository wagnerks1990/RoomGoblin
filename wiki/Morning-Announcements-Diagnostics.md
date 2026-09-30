# Morning Announcements Diagnostics

Morning Announcements is a priority live-stream workflow. A confirmed live transition starts the player once. Periodic successful probes must not clear/restart an already-playing stream. Transient failures are observed and recovered without blanking the TVs; release occurs only after a sustained confirmed-offline window.

## Intended monitoring behavior

```text
OFFLINE -> confirmed LIVE -> START once
PLAYING + successful probe -> no player change
PLAYING + transient failure -> keep playing/recover
PLAYING + sustained confirmed OFFLINE -> RELEASE once
```

The current deployment target is a 15-second probe cadence and six consecutive confirmed-offline results, approximately 90 seconds, before release.

## Receiver diagnostics

On a display receiver:

```js
window.ClassroomStreamDiagnostics()
```

This reports active/session state, latest HLS/media status, recent events, errors, recovery counts, duplicate reassertions suppressed, and duplicate takeover clears suppressed.

Stable console prefixes:

```text
[ClassroomHub MorningStream]
[ClassroomHub AntMedia]
```

The integrated HLS player records manifest/level/fragment progress, stalls, network/media errors, buffer-ahead duration, playback time, media ready/network state, browser online/offline events, and recovery attempts. A bounded snapshot is attached to normal display heartbeat metadata so the controller's existing device/diagnostic APIs can expose it.

## Appliance logs

```bash
cd /opt/classroom-hub
sudo docker compose logs -f classroom-hub \
  | grep -Ei 'Morning Announcements|MorningStream|AntMedia|display\.connected|display\.disconnected|stream|probe'
```

For a failure capture:

```bash
sudo docker compose logs --since=15m classroom-hub > /tmp/classroom-hub-stream.log
```

Record the exact failure time, affected display IDs, whether audio/video/both stopped, duration, receiver diagnostics, Morning Announcements runtime, and whether every TV failed simultaneously.

## HLS recovery

The same-origin Ant Media player runs HLS.js without a blob Web Worker under the current application CSP. Network failures are recovered with HLS reload attempts; media/decode failures use HLS media recovery; playlist variants can fall back between standard and adaptive manifests. A playback-progress watchdog detects prolonged buffering.

## Managed Display Gateway

The gateway solves display routing/DNS reachability but is not the stream-end authority. Temporary gateway/proxy failures should be distinguishable from a confirmed publisher shutdown.

Both gateway variables must reach the `classroom-hub` container. The Compose
deployment passes `DISPLAY_GATEWAY_OVERRIDES` and `DISPLAY_GATEWAY_ALLOWED_HOSTS`
from the protected `.env`; force-recreate the Hub container after changing them.
A value present only on the Docker host does not configure the running Hub.

## Future monitoring

Ant Media API/webhooks or another authoritative publisher signal can replace HLS manifest probing later. The replacement must preserve transition-based start/end behavior, UNKNOWN versus OFFLINE distinction, receiver telemetry, and server lifecycle logging.

Player/receiver telemetry reports only a stream URL's origin and pathname. Query
parameters, fragments, and the receiver's private full-URL comparison key are not
included in heartbeat metadata because stream URLs may carry subscriber
credentials. The manual display controller reads the saved stream URL without
rewriting its configuration and refuses to start when no URL is configured.

See the repository document `docs/MORNING-ANNOUNCEMENTS-DIAGNOSTICS.md` for the full diagnostic and acceptance-test contract.

## Playback freeze safeguards

The player samples playback every five seconds. Playlist/segment downloads and
`playing` events do not reset its progress clock. Fifteen seconds without media
time progress, or decoded-frame progress when supported on a video track, is
reported as `stalled`, even if the buffer is full. Audio-only/native browsers
without frame counters use media time.

Recovery escalates at most once every fifteen seconds: resume/start loading,
seek to the current live position, recover the HLS decoder, then rebuild this
player session with the alternate playlist. A recovery seek is not evidence of
playback. Genuine time/frame progress resets escalation; playlist callbacks do
not. Rebuilds preserve the Hub announcement priority and never reload the whole
receiver or release the scheduler/Background Music lock. Retired HLS callbacks
and pending retry timers cannot act on a replacement session.

`NotAllowedError` is reported separately as `autoplay-blocked`. The player tries
muted video and shows an audio-blocked message; repeated unmute commands cannot
force browser permission. Allow autoplay for the display origin through the
managed Chrome/Edge policy described in `MUSIC-ASSISTANT-SENDSPIN.md`, or click
the player to retry the requested audio in a user gesture. This fallback can
preserve picture, but announcements are incomplete without audible audio.

Diagnostics add `playbackStagnantMs`, `frameStagnantMs`, `decodedFrames`,
`recoveryStage`, `audioBlocked`, `requestedVolume`, `muted` and play rejection
`errorName`. Live Watch's controller PLAYING status remains the Hub takeover
state; inspect each receiver's telemetry for actual playback health.

Regression tests simulate a full-buffer freeze with continuing downloads,
a progressing audio clock with frozen video frames, healthy playback, native
HLS/paused recovery, autoplay rejection and retired callbacks. Physical PC/TV
acceptance still requires a live stream test: verify continuous picture/audio,
interrupt/recover networking, confirm current live playback resumes, and confirm
release restores the current scheduled state. No physical acceptance is claimed
by these simulated tests. Roll back through the backed-up previous published
image/source pair if receiver behavior regresses.
