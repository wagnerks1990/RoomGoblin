# AI Media Plane Context

## Scope

This file is the machine/assistant handoff for RoomGoblin uploaded-media transport and persistent receiver video sessions. Read it with `AGENTS.md`, `docs/AI-CONTEXT.md`, and `docs/MEDIA-PLANE.md` before changing media delivery or receiver playback.

## Port ownership

- `3000`: controller UI, REST API, scheduler, display WebSockets, telemetry, clear/stop/control commands.
- `3020`: authorized `GET/HEAD /media/*` byte-range delivery only.

Do not merge these responsibilities back together. The split exists so slow/large MP4 sends cannot starve control traffic.

## Authorization

The media plane does not create a separate public asset surface.

1. The receiver/controller requests a protected media URL.
2. The media sidecar validates that request through a bounded loopback `HEAD` probe to the control plane.
3. Physical receivers normally carry short-lived signed asset tokens.
4. Authenticated controller/browser requests may carry the existing RoomGoblin session cookie to the loopback authorization probe.
5. Only a successful control-plane authorization permits file streaming.

Never weaken this into anonymous media access merely to solve playback errors.

## Authorization lifecycle invariants (Unreleased)

Build the upstream URL from the fixed loopback control origin plus the validated
request path/query only. Never inherit URL userinfo, which Node would otherwise
turn into a Basic Authorization header. Forward only the existing allowed cookie
alongside fixed probe headers, not arbitrary client Authorization/forwarding
headers. This is header-boundary hardening, not a demonstrated authentication bypass.

Use a three-second absolute deadline rather than a socket-idle timeout: interim
HTTP responses must not extend the authorization budget. Bind a pending probe to
response-close cancellation with an AbortSignal, remove its listener when the
probe finishes, and check for a destroyed response before file access after awaits.
Preserve fail-closed 401/403 and transport-error 503 behavior without secret logging.
An empty file with any byte range is unsatisfiable (416); an ordinary empty GET/HEAD
remains a valid zero-length 200 response.

`node --test test/media-plane-lifecycle.test.js` exercises the real media process
against a local authorization fixture. Eight tests passed on Linux/Node 22.16.0
on 2026-09-19; four failures were reproduced against the original source. Full and
ranged file-descriptor cleanup already passed the baseline. Do not describe the
fixture as real Hub authentication or the historical 2026-09-18 acceptance as a
live test of these changes. Full CI, image publication, and receiver verification
remain separate gates. No database migration, upload-limit change, public exposure,
or media-session change is part of this patch; issue #182 remains unresolved.

## Cross-port browser policy

The receiver page is served from port `3000` and MP4 bytes from port `3020`. Authorized media responses therefore use:

`Cross-Origin-Resource-Policy: cross-origin`

This header is a browser embedding permission, not an authorization bypass. Keep the signed-token/session validation before file access.

## Receiver playback rules

- Physical receivers are the playback authority.
- Controller Today previews must short-circuit video before creating a `<video src>`.
- Display Studio/media-library cards must use lightweight VIDEO placeholders instead of opening the real MP4.
- Programmatic video start must be autoplay-safe: begin muted, call `play()`, then apply requested volume/mute state after playback starts.
- If audible autoplay is blocked, continue muted playback rather than leaving the player stopped.
- Preserve a persistent active media session.
- Play/pause/seek/volume/mute/rate/restart controls mutate that active session.
- Do not resend the original media command for control-only changes because that restarts playback.
- Session replay must not overwrite the operator's latest live volume/mute/rate state.

## Transport behavior

Browser video requires HTTP Range support. Preserve:

- `Accept-Ranges: bytes`
- single byte ranges
- suffix ranges
- `206 Partial Content`
- `Content-Range`
- `416 Range Not Satisfiable`
- streaming from disk without full-file buffering
- abort-aware stream cleanup

The receiver's same-origin media shim changes only the port from 3000 to 3020 and preserves the signed query string. A one-time fallback to the control-plane URL may be used if the media listener is unavailable, but persistent fallback is a fault.

## Production acceptance — 2026-09-18

Alpha.84 was physically/live accepted on the production classroom appliance.

Observed:

- backend health ready with database and scheduler checks passing;
- media-plane health passing;
- MP4 started automatically;
- play, pause, restart/stop, seek/scrub, volume, mute and playback-rate controls worked;
- controller remained responsive during playback;
- sustained video backpressure appeared on port `3020`;
- normal controller/API/WebSocket traffic stayed on port `3000` with negligible send queues;
- earlier media `401` and Chromium `ERR_BLOCKED_BY_RESPONSE.NotSameSite` failures were absent.

Interpretation: a large `:3020` send queue during active playback can be healthy. The failure condition is degraded `:3000` responsiveness, media health failure, authorization failure, playback failure or lost session telemetry.

## Regression requirements

Any future change to this path should preserve or extend tests for:

- signed media authorization;
- controller-session authorization;
- CORP header behavior;
- range transport;
- receiver port rewrite/fallback;
- no preview video decoding;
- no controller MP4 thumbnails;
- persistent media-session controls;
- release/version convergence when receiver code changes.

## Do not

- do not make `/media/*` anonymous;
- do not route sustained video back through port 3000 as a workaround;
- do not create extra video decoders in controller previews;
- do not silently swallow play/media failures;
- do not force receiver audio state before autoplay succeeds;
- do not restart the whole automation occurrence to loop one video.
