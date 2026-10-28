# AI Context — Morning Announcements

This file is implementation context for AI coding/review agents changing the Morning Announcements pipeline.

## Non-negotiable lifecycle rule

A periodic successful live probe must **not** re-send the active announcement takeover. Do not clear/recreate the current player merely to prove that the stream is still live. The historical `lastAssertAt > 30000` behavior caused an intentional `display.clear` followed by `display.web` every ~30 seconds and produced visible stream interruptions.

The lifecycle contract is transition-oriented:

```text
confirmed offline -> confirmed live : start once
confirmed live -> confirmed live    : observe only
live -> temporary failure/unknown   : observe/recover, do not release
live -> sustained confirmed offline : release once
```

Current deployment intent is 15-second health checks and about 90 seconds of sustained confirmed-offline evidence before release. Unknown/time-out errors must remain distinguishable from authoritative offline results.

Only periodic watcher observations advance the consecutive-offline count.
Unknown results and probe errors break that streak; manual diagnostic checks
cannot accelerate automatic release. Manual live/unknown results also reset the
streak. A settings replacement retires earlier automatic/diagnostic results;
obsolete diagnostics return 409 and must be checked again. Each watcher restart
owns one generation, so a retired callback queued behind a lifecycle operation
cannot probe or create another timer chain. Preserve normal interval bounds,
shutdown drain and manual announcement ownership.

## Configuration persistence

Save normalized configuration and its encrypted stream URL in one SQLite
transaction before replacing the live configuration or restarting the watcher.
The same rule applies to explicit URL deletion. A failed legacy-file scrub must
roll back the database writes and leave live settings unchanged; clean up only
the exclusively created staging file. Startup still scrubs legacy plaintext.
SQLite remains authoritative: a commit failure after legacy-file replacement may
leave that migration remnant redacted, but cannot commit partial database state.
Live volume dispatch follows persistence and has its own observable outcome.

Delayed audio retries belong to the exact takeover target-array identity. A new
takeover replaces that identity even when receiver IDs are unchanged. Retired
retries must not send volume/unmute commands into a successor session. Current
retries retain the latest saved volume and existing freeze/shutdown guards.

## Receiver-side safety net

`public/shared/attribution.js` installs a narrow receiver guard before the display module's WebSocket handler is assigned. During rollout it suppresses duplicate identical Morning Announcements `display.web` assertions and duplicate `morning-announcements-takeover` clears while the same session is already active. It must always allow an explicit `morning-announcements-release` clear.

This is a defense-in-depth guard, not permission to keep a server-side periodic reassert forever. Prefer fixing the lifecycle owner rather than expanding interception to unrelated commands.

Mandatory announcement audio holds have their own target set, separate from
ordinary media and manual takeover ownership. Media-ended observations and
replacement commands may update ordinary priority while the mandatory hold
remains. Release removes only the announcement hold after reconciliation;
restored audible content keeps its own priority. Pending reconciliation retains
mandatory hallway priority even after active runtime targets have cleared.

The server owns the hard priority boundary. It serializes announcement start/stop transitions and rechecks the lock at every automation display delivery, including work that already passed an earlier check and then awaited a delay or network operation. Only display targets owned by the active announcement are deferred; lighting and other non-display work continues. If post-release display reconciliation fails, retain the Background Music priority hold and retry before resuming.

Consume deferred occurrences only after their execution markers persist. On
failure, retain the queue and restore the previous in-memory markers, including
absent fields and existing event identities. Release retries must persist that
bookkeeping before display reconciliation or music release; do not replay the
deferred commands themselves.

The Live Watch announcement-volume slider is a live control as well as persisted configuration. While an announcement owns targets, a volume update must send `display.web.audio` to those runtime-owned targets with `reload:false`; it must not clear, reload, or recreate the player. When no announcement is active, the value is saved for the next takeover.

An operator can deliberately clear or reload display content while the announcement lifecycle still owns its targets. **Resume Schedule** / **Resume Scheduled State** is the explicit recovery action: when Morning Announcements remain active, it must reassert that priority takeover on the runtime-owned targets instead of returning only a deferred result. This operator-triggered repair is distinct from periodic live probes, which must remain observe-only while active.

## HLS player

`public/antmedia-player/index.html` is the integrated Morning Announcements player. It emits same-origin telemetry to the parent receiver and performs bounded in-place recovery for network/media failures.

For the current HTTP/CSP deployment, HLS.js runs with `enableWorker:false`. Do not globally add `blob:` worker execution just to silence HLS.js warnings unless the full CSP/security impact is reviewed. The player is sufficiently lightweight for the managed TV use case and main-thread HLS avoids the known CSP worker rejection.

## Diagnostics contract

Preserve these observable surfaces:

- `window.ClassroomStreamDiagnostics()` on a receiver;
- `[ClassroomHub MorningStream]` receiver console events;
- `[ClassroomHub AntMedia]` player console events;
- bounded player/stream telemetry in normal display heartbeat `meta.stream`;
- server-side Morning Announcements runtime through the authenticated automation API;
- display connect/disconnect audit events;
- Morning Announcements start/stop/probe-transition events when server lifecycle code is changed.

Telemetry should include enough information to distinguish upstream liveness, gateway/network failure, HLS playlist/segment failure, decode/media failure, receiver WebSocket loss, player stall, and recovery. Never include credentials, cookies, access tokens, enrollment tokens, or secrets.
Player and receiver telemetry may retain only the URL origin and pathname. Strip
the query string and fragment before `postMessage`, diagnostics events, or display
heartbeat metadata, and never expose the receiver's internal full-URL comparison
key. The manual display controller must load the saved stream URL without writing
configuration during page initialization and must fail closed when no URL exists.

## Bounded HLS probes

Each primary/adaptive request has one 3.5-second deadline covering redirects,
headers and complete body consumption. Successful playlists are bounded to
512 KiB of declared and streamed bytes. Cancel redirect/error bodies, preserve
allowlist validation for every redirect and abort the transport on all outcomes.
Timeouts and oversized playlists are UNKNOWN, never authoritative offline
evidence. Buffered response data remains usable after transport cleanup.

## Future replacement monitoring

A later monitor may use an Ant Media API/webhook or another authoritative publisher signal. Preserve transition semantics and diagnostics even when the probe mechanism changes. Monitoring and playback are separate concerns: the monitor decides when a session should begin/end; the receiver/player decides how to survive transient playback/network errors while the session remains active.

See `docs/MORNING-ANNOUNCEMENTS-DIAGNOSTICS.md` for the operator-facing diagnostic procedure.

Playback watchdogs must track media time and, where available, decoded video
frames independently of network callbacks. Full-buffer/paused freezes require
bounded resume, live seek, decoder recovery and player-local reattachment. A
watchdog seek must not reset escalation as apparent playback progress. Retired
callbacks/retry timers cannot mutate successor HLS sessions. Browser autoplay
denial must be diagnosed separately and may fall back to muted video; never
claim JavaScript can manufacture activation or release announcement priority
because a receiver stalls. See the playback safeguards and physical acceptance
limits in `docs/MORNING-ANNOUNCEMENTS-DIAGNOSTICS.md`.
