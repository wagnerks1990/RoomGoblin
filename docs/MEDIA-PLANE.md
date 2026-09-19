# RoomGoblin Media Plane

## Purpose

RoomGoblin separates large uploaded-media payloads from classroom control traffic so MP4 playback cannot starve controller/API/WebSocket access.

The control plane remains on the normal RoomGoblin listener (default `3000`). Uploaded video/audio is served by a dedicated media-plane process (default `3020`) running in the same validated RoomGoblin image but in a separate Node.js process and TCP listener.

## Runtime model

- Control plane: `http://<hub>:3000`
  - controller UI
  - REST API
  - scheduler
  - display WebSockets
  - receiver telemetry and media-session control
- Media plane: `http://<hub>:3020`
  - `GET`/`HEAD /media/*`
  - byte-range delivery for browser video/audio
  - no controller/API routes

`tools/start-roomgoblin.sh` supervises both processes. If either process exits, the other is terminated so Docker restarts a converged pair rather than leaving half of the appliance running.

## Asset authorization

The media plane does not create a second authentication system and does not expose the media directory anonymously.

Every `/media/*` request is first validated by issuing a bounded `HEAD` request to the existing control-plane URL. Physical receivers preserve their signed query string. Authenticated controller/browser requests may also carry the existing RoomGoblin session cookie; the media process forwards that cookie only to the loopback control-plane authorization probe and never treats it as a media-plane credential of its own. The control plane remains the sole authorization authority. Only a successful 2xx authorization response permits the media process to read the requested file.

The media process resolves requested paths beneath `data/media` and rejects traversal outside that root.

Because the browser receiver is loaded from port `3000` and the media payload is intentionally delivered from port `3020`, media responses use `Cross-Origin-Resource-Policy: cross-origin`. Authorization still occurs before any file bytes are served, so this header permits the already-authorized browser media element to embed the separate-port response; it does not make media anonymous or bypass signed-token/session checks.

## Authorization lifecycle hardening (Unreleased)

The loopback probe copies only the requested path and query into a fresh
control-plane URL. A client-supplied authority or URL username/password must not
become an upstream destination or an automatically generated Basic Authorization
header. The existing session cookie and signed query remain supported; arbitrary
Authorization and forwarding headers are not copied.

A probe has a three-second wall-clock deadline, including upstream interim
responses. A disconnected downstream response immediately aborts pending
authorization, and an abandoned request must not proceed to open its media file.
Timeouts and transport failures fail closed with HTTP 503 and `Retry-After: 1`
when the client is still connected. Explicit upstream 401/403 responses remain
401/403; other unsuccessful statuses remain 403. No error response includes media
bytes, cookies, credentials, or signed URLs.

This changes request lifecycle only. It does not change ports, upload limits,
receiver identities, persistent media controls, database schema, or stored media.
Large/resumable uploads tracked in issue #182 remain separate, unfinished work.

## Range transport

Browser MP4 playback requires efficient random access. The media plane implements:

- `Accept-Ranges: bytes`
- single-range `Range: bytes=start-end`
- suffix ranges such as `bytes=-4096`
- `206 Partial Content`
- `Content-Range`
- `416 Range Not Satisfiable`, including suffix ranges on an empty file
- streaming with `fs.createReadStream()` rather than buffering entire files
- cancellation of the file stream when the HTTP client aborts

This moves large socket send queues away from port `3000`, preserving clear/stop/controller commands while multiple displays play the same uploaded video.

## Receiver behavior

Physical RoomGoblin display pages transparently rewrite same-origin `/media/*` video/audio sources from the control-plane origin to port `3020`. The signed query string is preserved.

The rewrite is currently enabled for HTTP classroom deployments. If the media listener is unavailable, the receiver performs a one-time fallback to the original control-plane URL so existing installations fail gracefully. Persistent fallback should be treated as a media-plane health problem, not the normal operating mode.

Controller preview pages do not decode receiver video locally. The preview renderer short-circuits video before creating a `<video src>`, showing a lightweight `Video active on physical display` state instead. This prevents controller previews from issuing MP4 requests at all while still allowing authenticated image/document previews through the normal control-plane authorization check. Physical receivers remain the playback authority.

## Synchronization

Persistent receiver media sessions remain the synchronization/control mechanism. RoomGoblin can independently control:

- play/pause
- restart/stop
- seek/scrub
- clip start/end boundaries
- volume/mute
- playback rate
- receiver-native loop
- session telemetry

A future synchronized-start protocol can add a common future timestamp and drift correction without coupling media bytes back to the control plane.

## Multicast roadmap

True IP multicast is intentionally not part of the browser transport. Standard browser media elements do not provide a practical UDP/RTP multicast receive path.

For synchronized audio, prefer the existing Music Assistant/Sendspin integration rather than creating another audio transport.

For bandwidth-sensitive video, a future native RoomGoblin receiver may optionally support RTP/UDP multicast on networks where IGMP/multicast is explicitly configured. That mode must remain optional; browser receivers continue to use synchronized HTTP range delivery.

## Configuration

- `PORT` / `HUB_PORT`: control plane, default `3000`
- `MEDIA_PLANE_PORT`: media plane, default `3020`
- `MEDIA_PLANE_BIND_ADDRESS`: defaults to `BIND_ADDRESS`
- `DATA_DIR`: shared RoomGoblin data root

## Verification

After deployment:

```bash
curl -fsS http://127.0.0.1:3000/health
curl -fsS http://127.0.0.1:3020/health
ss -lntp | grep -E ':(3000|3020)\b'
```

For a signed uploaded-media URL, verify byte ranges against port `3020`:

```bash
curl -i -H 'Range: bytes=0-1048575' 'http://HUB:3020/media/FILE?SIGNED_QUERY' -o /dev/null
```

Expected status: `206 Partial Content`.

During multi-display playback, large media send queues should appear on `:3020`, while `:3000` remains responsive for `/health`, controller requests, WebSockets, and clear/stop commands.

### Isolated regression verification

From a Node.js 22 checkout:

```bash
node --check src/media-server.js
node --check test/media-plane-lifecycle.test.js
node --test test/media-plane-lifecycle.test.js
```

The eight tests launch the actual media process and a local authorization fixture.
They cover full/HEAD/suffix/open-ended/invalid ranges, empty files, signed-query
and session-cookie transport, credential/header isolation, upstream denial and
failure, pending-probe cancellation, and a wall-clock timeout despite repeated
HTTP 102 responses. Linux tests also verify that repeated full and ranged client
disconnects release file descriptors using `/proc`; other platforms skip those
two descriptor-accounting tests. This is not a full Hub authentication, browser,
Cloudflare, Docker, or physical-device test.

On 2026-09-19 these eight tests passed locally on Linux with Node.js 22.16.0.
Four defects were reproduced against the unchanged baseline before their fixes;
existing streamed-file descriptor cleanup already passed and was not a confirmed
leak. The historical live acceptance below does not validate these new changes.
Required repository CI and a controlled receiver test are still required.

The hardening needs no data migration or new environment variable. Use the
reviewed exact-image updater and its operational backup/rollback transaction;
do not deploy an unvalidated source-only change. After an authorized upgrade,
verify both health endpoints, authorized and rejected media requests, and receiver
play/pause/seek/stop while the controller remains responsive. Stop testing and use
the documented updater rollback if health, authorization, or playback regresses.

## Production acceptance — 2026-09-18

Alpha.84 was live-tested on the production classroom appliance after the media-plane, autoplay, preview, and CORP fixes.

Observed acceptance evidence:

- the control-plane health endpoint returned ready/healthy with database and scheduler checks passing;
- the media-plane health endpoint returned healthy on port `3020`;
- physical MP4 playback started successfully without the browser play-circle stall;
- live play/pause, volume, seek/scrub, restart/stop, and playback-rate controls worked without reloading the file;
- controller navigation and command handling remained responsive during playback;
- the active MP4 stream appeared on `:3020` with multi-megabyte socket backpressure isolated there;
- normal controller/API/WebSocket connections remained on `:3000` with negligible send queues;
- the browser console no longer showed the earlier media `401` or `ERR_BLOCKED_BY_RESPONSE.NotSameSite` failures;
- controller media cards no longer need to decode full MP4 files simply to display thumbnails.

This is the expected production architecture. A large `:3020` send queue during active video is not by itself a failure; it shows that media backpressure is isolated from the control plane. Investigate only if `:3000` responsiveness degrades, media health fails, or playback/control telemetry stops.

### Acceptance invariant

Do not collapse video delivery back onto port `3000` as a workaround for media issues. Fix authorization, response policy, receiver routing, or playback behavior while preserving the control/media split.

