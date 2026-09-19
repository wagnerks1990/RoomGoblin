# Media Plane and Live Video Playback

RoomGoblin separates uploaded video delivery from classroom control traffic.

## Architecture

| Port | Responsibility |
| --- | --- |
| `3000` | Controller, REST API, scheduler, display WebSockets, telemetry, media-session commands |
| `3020` | Authorized uploaded-media `GET/HEAD`, HTTP byte ranges, MP4/audio payloads |

This prevents a large or slow MP4 transfer from blocking Clear, Stop, navigation, telemetry, or other classroom commands.

## Authorization

The media listener is not public. Each request is authorized through the normal RoomGoblin control plane before the media process reads the file.

Physical displays use short-lived signed asset tokens. Authenticated controller requests can use the existing RoomGoblin browser session for the internal authorization check.

Because the browser page runs on port 3000 while video bytes come from port 3020, authorized media responses use `Cross-Origin-Resource-Policy: cross-origin`. This allows the already-authorized browser player to consume the separate-port response; it does not bypass authentication.

## Request lifecycle hardening (Unreleased)

Pending media authorization now cancels when the client disconnects and has a
three-second absolute timeout even if the upstream sends interim responses.
The probe copies only the resource path/query into its fixed loopback URL, so
client URL credentials cannot become an unintended Basic Authorization header.
Existing signed URLs, session cookies, 401/403 denials, and fail-closed 503
transport errors remain supported. Empty-file range requests return 416 rather
than an invalid 206 response; a normal empty-file request still returns 200.

Eight isolated HTTP regression tests passed locally on Linux/Node 22.16.0 on
2026-09-19. They use the actual media process with an authorization fixture,
not the full Hub or physical receivers. The earlier live acceptance below does
not cover this unreleased hardening. Required CI and controlled receiver testing
remain necessary. No migration, new port, upload-limit increase, or resumable
upload implementation is included; issue #182 remains open.

Run `node --test test/media-plane-lifecycle.test.js` from the repository for the
focused suite. See `docs/MEDIA-PLANE.md` for coverage, upgrade and rollback gates.
This Git-tracked page is published only when the existing Sync Wiki workflow
successfully pushes it; a prepared PR is not proof of Wiki publication.

## Video controls

RoomGoblin keeps the receiver's MP4 as a persistent media session. The operator can change playback without reloading the file:

- Play / Pause
- Restart / Stop
- Seek / scrub
- Volume / mute
- Playback rate
- Clip start/end boundaries
- Receiver-native loop
- Live session telemetry

Commanded video starts in an autoplay-safe muted state and applies the requested audio state after playback begins. If the browser blocks audible autoplay, RoomGoblin continues playback muted rather than leaving the player stopped.

## Controller previews

Physical displays are the playback authority.

- Today preview tiles remain live for receiver state but do not decode the active MP4.
- A video preview shows a lightweight **Video active on physical display** state.
- Display Studio / Media Library video cards use lightweight VIDEO placeholders instead of loading entire MP4 files as thumbnails.

## Production acceptance — 2026-09-18

Alpha.84 passed live production testing:

- control-plane health was ready with database and scheduler checks passing;
- media-plane health was green;
- physical MP4 playback started successfully;
- play, pause, volume, seek, restart/stop and playback-rate controls worked;
- the controller remained responsive during playback;
- sustained MP4 traffic/backpressure appeared on port 3020;
- normal control connections remained responsive on port 3000;
- the earlier `401 Unauthorized` and Chromium `ERR_BLOCKED_BY_RESPONSE.NotSameSite` media failures were no longer present.

A large send queue on port 3020 during video playback is expected when the client/network is consuming a large stream. It is a concern only if port 3000 becomes sluggish, media health fails, or playback/session telemetry stops.

## Verification

On the RoomGoblin host:

```bash
curl -fsS http://127.0.0.1:3000/health
curl -fsS http://127.0.0.1:3020/health
ss -tnp | grep -E ':(3000|3020)\b'
```

During active video, the MP4 connection should be on `:3020`; controller/API/WebSocket connections should remain on `:3000`.

## Recovery guidance

Do not move MP4 delivery back to port 3000 to work around playback errors. Check:

1. signed/session authorization;
2. port 3020 health/listener;
3. browser CORP response policy;
4. receiver media URL rewrite;
5. autoplay/session telemetry;
6. HTTP Range responses.

See the canonical technical document: `docs/MEDIA-PLANE.md`.
