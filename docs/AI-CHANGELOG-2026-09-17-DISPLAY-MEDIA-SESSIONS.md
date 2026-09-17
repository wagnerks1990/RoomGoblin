# Display Studio persistent media-session fix — 2026-09-17

## Problem

The persistent receiver media-session backend and controls added in `1.0.0-alpha.82` were exposed from the controller's Media Library workspace, while the operator's normal `Display studio -> Media` path still used the legacy `display.video` command helper. The Display Studio live preview could also decode the same MP4 in the controller browser while the physical receiver played it. The controller Today page additionally created one receiver-preview iframe and WebSocket per online TV.

## Fix

`public/shared/manual-media-volume.js` now augments the Display Studio media workspace with the persistent-session controls used for real receivers:

- receiver selection;
- play, pause, restart and stop/rewind;
- seek/scrub plus ±10 second controls;
- live receiver telemetry;
- volume and mute without reissuing the video command;
- playback-rate control;
- video start and end boundaries;
- receiver-native looping;
- stable per-play `sessionId` values.

The Display Studio controller no longer loads a receiver preview locally. Its preview frame is forced to `about:blank` and the legacy preview loader is replaced with a no-op. The physical RoomGoblin receiver remains the playback authority and the controller uses status/telemetry instead of decoding the media.

The controller Today page also strips background `data-overview-preview` receiver iframes and replaces them with lightweight status placeholders. This prevents the operator browser from maintaining one display WebSocket/video renderer per TV.

## Compatibility and safety

- Existing manual image and web/stream commands keep their command shape.
- Physical display receivers continue to use the existing persistent session implementation.
- Morning Announcement priority and scheduler reconciliation are unchanged.
- Receiver status polling is bounded and overlapping status requests are suppressed.
- Controller pages no longer act as background display receivers merely to show previews.
