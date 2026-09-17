# Display Studio persistent media-session and media-plane fix — 2026-09-17

## Problems

The persistent receiver media-session backend and controls added in `1.0.0-alpha.82` were exposed from the controller's Media Library workspace, while the operator's normal `Display studio -> Media` path still used the legacy `display.video` command helper.

The controller also created receiver-style preview pages. Those previews could open extra display WebSockets and decode uploaded MP4s locally.

Production testing then exposed the deeper transport failure: multiple physical receivers streaming the same uploaded MP4 from the RoomGoblin control listener on port `3000` built multi-megabyte TCP send queues. The backend process remained healthy and responsive on loopback, but LAN controller requests began failing with `TypeError: Failed to fetch`; clear/stop commands from the GUI could not reach the same congested listener reliably.

## Persistent-session UI fix

`public/shared/manual-media-volume.js` augments the Display Studio media workspace with the persistent-session controls used for real receivers:

- receiver selection;
- play, pause, restart and stop/rewind;
- seek/scrub plus ±10 second controls;
- live receiver telemetry;
- volume and mute without reissuing the video command;
- playback-rate control;
- video start and end boundaries;
- receiver-native looping;
- stable per-play `sessionId` values.

Controller receiver previews are disabled. The controller does not decode the physical receiver's MP4 and does not maintain a bank of display-preview WebSockets in the Today workspace.

## Media-plane fix

Uploaded video/audio delivery is separated from the control plane:

- control/UI/API/WebSocket traffic remains on port `3000`;
- a second RoomGoblin Node.js process listens on `MEDIA_PLANE_PORT` (default `3020`);
- the same validated RoomGoblin image starts both processes through `tools/start-roomgoblin.sh`;
- receiver HTML media elements transparently rewrite same-origin `/media/*` sources to the media listener;
- the original signed asset query is preserved;
- the media process validates every request by making a bounded `HEAD` request to the control plane, preserving the existing signed-asset authorization contract;
- authorized files are streamed directly from `data/media` with single-range HTTP support and no whole-file buffering;
- client aborts destroy the corresponding file stream;
- if the media plane is unavailable, the receiver falls back once to the original control-plane media URL.

The media plane implements `Accept-Ranges`, `206 Partial Content`, `Content-Range`, suffix ranges, and `416 Range Not Satisfiable`.

## Synchronization and multicast direction

Persistent receiver media sessions remain the playback-control layer. A later change may add common future start timestamps and drift correction for tighter multi-display synchronization.

True UDP/RTP multicast is not introduced for browser receivers because standard browser media elements do not provide a practical multicast receive path. Music Assistant/Sendspin remains the preferred synchronized audio transport. A future native RoomGoblin receiver may optionally add LAN multicast video where IGMP/multicast is explicitly supported.

## Compatibility and safety

- Existing manual image and web/stream commands keep their command shape.
- Physical display receivers continue to use the existing persistent session implementation.
- Morning Announcement priority and scheduler reconciliation are unchanged.
- Existing protected `/media/*` authorization remains authoritative.
- The media-plane process cannot resolve files outside `data/media`.
- Receiver status polling is bounded and overlapping status requests are suppressed.
- Deployment still uses the same validated RoomGoblin application image; no third published image is required.

See `docs/MEDIA-PLANE.md` for architecture, configuration, and production verification.
