# Morning Announcements Stability and Diagnostics

## Purpose

Morning Announcements is a priority live-stream workflow. The Hub probes the configured Ant Media HLS stream during the school-day watch window, starts the announcement when the stream becomes live, keeps the active player stable through transient probe/media failures, and releases displays only after the configured sustained-offline threshold.

This document is the operational contract for diagnosing stream start, playback, buffering, reconnect, proxy, receiver WebSocket, and stream-end behavior. Future monitoring implementations should preserve these observable lifecycle states even if the underlying Ant Media/HLS probe is replaced.

## Stability contract

An already-playing announcement must not be cleared and recreated merely because another health probe succeeds. Reasserting the same `display.web` takeover every 30 seconds caused visible feed interruptions because the receiver was explicitly blanked and the HLS player was rebuilt.

The intended lifecycle is:

```text
IDLE
  -> probe confirms live
  -> STARTING
  -> PLAYING

PLAYING
  -> successful probe: keep current player untouched
  -> transient probe failure: keep current player untouched
  -> HLS network/media error: recover in-place when possible
  -> sustained confirmed offline state: RELEASE

RELEASE
  -> clear announcement content once
  -> restore applicable scheduled display content
  -> reconcile Background Music priority
```

The deployment target is a 15-second probe interval with six consecutive confirmed-offline results before release (about 90 seconds). Unknown/time-out/proxy errors are diagnostic conditions, not authoritative proof that publishing ended.

Unknown results and probe errors reset the consecutive-offline streak. Manual
**Check** requests show diagnostics but cannot advance the automatic release
threshold; live or unknown diagnostic evidence resets the streak. If settings
change while a check is pending, its obsolete response is rejected and you can
check again. Saving settings retains one periodic watcher even when a previous
probe or lifecycle operation is still pending.

Settings are committed with the encrypted stream URL before the watcher or live
volume control uses them. A storage failure preserves the previous active and
saved settings; correct the error and retry the save. Clearing a stream URL uses
the same transaction. A successful save does not by itself confirm receiver
playback or a successful live volume command.

Live Watch keeps newer edits when a read or earlier save finishes. Save is
unavailable while that settings submission is pending; inputs remain editable,
and newer edits are labeled unsaved. Volume changes are ordered with settings
saves and settle on the latest slider value. A failed save retains the draft
for retry. Save, volume and stream-check feedback are shown separately.

Starting a replacement announcement retires the previous session's delayed
audio retries, including when both sessions use the same displays.

Announcement audio priority remains held through failed display reconciliation,
including independent hallway displays. Once recovery succeeds, restored audible
video or an existing manual takeover retains its own music-priority policy.
A media-ended notification cannot release an active announcement hold.

If deferred-occurrence bookkeeping cannot be saved, its queued records and
previous execution markers remain available for retry. Release recovery saves
those markers before reconciling current display winners or releasing music;
it does not replay the old deferred commands.

Failed release clears remain pending. A retry clears only content still owned
by that release; newer content and its audio priority are preserved. If another
announcement starts first, its later release also finishes the older pending
work before music can resume. Removed receivers retire their pending records.
A selected receiver mapped to the shared legacy broadcast topic fails closed
instead of clearing unrelated receivers. These are command-ownership checks,
not proof of physical playback or audible silence.

If a start fails after changing display state, its owned content remains pending
for cleanup and current-schedule reconciliation before music priority is released.
Older pending recovery remains held too. The original start error is reported;
unchanged or newer content is excluded from that failed attempt's cleanup.

An empty or unresolved explicit start selection reports an error instead of
using other configured displays. When replacement fails before changing content,
an unchanged existing announcement retains its active lifecycle and audio hold.

## HLS player recovery

`public/antmedia-player/index.html` is the same-origin player used for Morning Announcements. For the current HTTP deployment it runs HLS.js on the main thread (`enableWorker:false`) because the application Content Security Policy intentionally does not permit arbitrary blob workers. This avoids the repeated CSP worker rejection observed in browser diagnostics without broadly weakening the application CSP.

The player uses bounded HLS retry/recovery behavior:

- manifest, level, and fragment load timeouts;
- bounded manifest/level/fragment retries;
- `startLoad()` recovery for HLS network failures;
- `recoverMediaError()` for HLS media/decode failures;
- fallback between the standard and `_adaptive.m3u8` candidates;
- a playback-progress watchdog that attempts in-place HLS recovery after prolonged buffering.

A player error should not cause the Hub to clear the receiver unless the server-side live monitor independently confirms the stream has ended for the configured grace period.

HLS probe deadlines cover the full playlist body, including a server that sends
headers and then stalls. Each primary/adaptive attempt is bounded to 3.5 seconds
and 512 KiB. A timeout or oversized response is reported as unknown availability
and does not count toward the offline release threshold.

## Receiver diagnostics

Each physical display exposes:

```js
window.ClassroomStreamDiagnostics()
```

The result contains the current Morning Announcements receiver state plus a bounded recent event ring. Useful fields include:

- `active` — whether the receiver believes it currently owns a Morning Announcements session;
- `state` — starting, playing, buffering, released, etc.;
- `reassertionsSuppressed` — duplicate identical stream commands suppressed instead of rebuilding the player;
- `takeoverClearsSuppressed` — duplicate takeover clears suppressed while the same announcement is active;
- `lastError` — most recent player/recovery error;
- `player` — latest HLS/media telemetry snapshot;
- `events` — recent receiver/player state changes.

The receiver also adds a bounded stream snapshot to normal display heartbeat metadata. The Hub therefore exposes current per-display stream telemetry through the existing authenticated device/diagnostic views instead of creating a second unauthenticated monitoring channel.

## Player telemetry

The integrated Ant Media player sends same-origin telemetry to its parent receiver. Telemetry includes:

- event and state;
- current playback time;
- seconds buffered ahead;
- HTML media `readyState` and `networkState`;
- selected HLS candidate;
- HLS manifest/level/fragment progress counters;
- network/media/other HLS error counters;
- stall count;
- recovery count;
- last URL and source URL;
- fatal/nonfatal HLS error details and HTTP response code when available;
- browser online/offline transitions;
- watchdog recovery events.

Browser console prefixes are intentionally stable for field troubleshooting:

```text
[ClassroomHub MorningStream]
[ClassroomHub AntMedia]
```

These logs must not include display credentials, Hub session cookies, setup tokens, maintenance tokens, or other secrets.
Stream URL fields in player telemetry, receiver events, and display heartbeat
metadata contain only the origin and pathname. Query parameters and fragments are
removed because Ant Media URLs can carry subscriber credentials. The receiver's
private full-URL comparison key is not sent in heartbeat metadata.

## Hub-side diagnostics

The existing API surfaces should be used while troubleshooting:

```text
GET /api/v1/automations/morning-announcements
GET /api/v1/devices
GET /api/v1/diagnostics
GET /api/v1/diagnostics/events
```

The Morning Announcements endpoint reports the saved watch configuration and runtime probe state. Display status includes heartbeat metadata, including the latest receiver stream telemetry when available. Diagnostics events contain display connect/disconnect and automation lifecycle events.

From the Ubuntu appliance, follow relevant application logs with:

```bash
cd /opt/classroom-hub
sudo docker compose logs -f classroom-hub \
  | grep -Ei 'Morning Announcements|MorningStream|AntMedia|display\.connected|display\.disconnected|stream|probe'
```

For a broader capture during a failure window:

```bash
sudo docker compose logs --since=15m classroom-hub > /tmp/classroom-hub-stream.log
```

Do not publish exported logs without reviewing them for deployment-specific URLs, addresses, or other environment details.

## What to record during a physical failure

For each observed interruption, capture:

1. wall-clock time to the second;
2. affected display ID(s);
3. whether picture, audio, or both stopped;
4. how long the interruption lasted;
5. `window.ClassroomStreamDiagnostics()` from the affected receiver/preview if available;
6. Morning Announcements runtime from the controller;
7. Hub logs for approximately one minute before and after the event;
8. whether other displays experienced the same interruption at the same time.

If every TV fails at the same instant, prioritize upstream/proxy/probe investigation. If one receiver fails while others remain healthy, prioritize that receiver's HLS/media/WebSocket telemetry.

## Managed Display Gateway relationship

Morning Announcements may reach Ant Media through the Managed Display Gateway. The gateway solves routing/DNS reachability; it is not itself the stream-liveness authority. A gateway timeout or temporary fetch failure is not equivalent to a confirmed stream end.

For site-specific mappings, continue to use protected runtime `.env` configuration. Do not commit production hostnames or IP addresses to public defaults.

Both gateway variables must reach the `classroom-hub` container. `docker-compose.yml`
passes `DISPLAY_GATEWAY_OVERRIDES` and `DISPLAY_GATEWAY_ALLOWED_HOSTS` from the
protected deployment `.env`; after changing either value, force-recreate the Hub
container. A configured host value that exists only on the Docker host is not enough.

## Future monitoring replacement

A future implementation may use Ant Media's management API, publisher webhook/events, a dedicated health endpoint, WebRTC signaling, or another authoritative source instead of HLS manifest probing. The replacement should preserve these invariants:

- START once on a confirmed live transition;
- never rebuild a healthy active player on periodic success checks;
- distinguish OFFLINE from UNKNOWN/UNREACHABLE;
- debounce stream-end release;
- preserve receiver-level playback telemetry;
- preserve server-side lifecycle/audit events;
- keep the announcement higher priority than ordinary classroom automation;
- restore the correct current automation state after release.

## Acceptance test

A physical deployment is considered stable only after an actual managed TV has played a live Morning Announcements stream continuously for at least 10 minutes with no periodic 30-second player teardown. During the test, verify that successful probes do not cause iframe/player replacement and that temporary recoverable HLS errors are visible in diagnostics without blanking the display.

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
