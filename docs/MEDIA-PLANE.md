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

## Range transport

Browser MP4 playback requires efficient random access. The media plane implements:

- `Accept-Ranges: bytes`
- single-range `Range: bytes=start-end`
- suffix ranges such as `bytes=-4096`
- `206 Partial Content`
- `Content-Range`
- `416 Range Not Satisfiable`
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
