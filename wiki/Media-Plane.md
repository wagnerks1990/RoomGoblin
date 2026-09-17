# Media Plane

RoomGoblin keeps classroom control traffic separate from large uploaded video/audio payloads.

## Ports

- `3000` — controller, API, scheduler, display WebSocket control and telemetry
- `3020` — uploaded `/media/*` delivery (`MEDIA_PLANE_PORT`)

Both listeners run from the same validated RoomGoblin image but in separate Node.js processes supervised by `tools/start-roomgoblin.sh`.

## Why

Production testing with multiple displays playing the same MP4 showed multi-megabyte TCP send queues on port `3000`. The backend remained healthy, but browser controller requests and clear/stop commands could fail because video payload traffic shared the control listener.

Moving media bytes to `3020` keeps port `3000` responsive even when several receivers are reading the same file.

## Security

The media plane is not an anonymous static-file server. Every `/media/*` request is authorized by a bounded `HEAD` request to the existing control-plane URL using the original signed query. The existing RoomGoblin protected-asset policy stays authoritative.

Filesystem resolution is restricted to `data/media`.

## Video delivery

The media process supports browser byte-range playback:

- `Accept-Ranges: bytes`
- `206 Partial Content`
- `Content-Range`
- suffix ranges
- `416` for invalid ranges
- streamed file reads instead of whole-file buffering

Physical display pages automatically move same-origin uploaded video/audio sources to the media-plane port. If that listener cannot load the file, the receiver performs one fallback to the original URL.

## Controller previews

The operator controller does not load physical receiver video locally and the Today page does not keep receiver-preview WebSockets alive. Physical displays are the playback authority; the controller consumes telemetry and sends controls.

## Synchronization

RoomGoblin's persistent media-session control handles play/pause, seek, loop, volume, playback rate and clip boundaries. Tighter multi-screen synchronization can later use a common future start time and drift correction.

Music Assistant/Sendspin remains the synchronized audio path. True LAN multicast video is reserved for a future optional native receiver because ordinary browser media elements do not provide a practical UDP/RTP multicast receive path.

## Verification

```bash
curl -fsS http://127.0.0.1:3000/health
curl -fsS http://127.0.0.1:3020/health
ss -lntp | grep -E ':(3000|3020)\b'
```

During video playback, large media send queues should be on `3020`, not `3000`.
