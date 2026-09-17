# Display Studio persistent media-session fix — 2026-09-17

## Problem

The persistent receiver media-session backend and controls added in `1.0.0-alpha.82` were exposed from the controller's Media Library workspace, while the operator's normal `Display studio -> Media` path still used the legacy `display.video` command helper. The Display Studio live preview could also decode the same MP4 in the controller browser while the physical receiver played it.

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

When a manual video is started, the controller's local live-preview iframe is suspended to `about:blank`. This prevents the controller browser from decoding a second copy of the MP4. The physical RoomGoblin receiver remains the playback authority.

## Compatibility and safety

- Existing manual image and web/stream commands keep their command shape.
- Physical display receivers continue to use the existing persistent session implementation.
- Morning Announcement priority and scheduler reconciliation are unchanged.
- The controller polls receiver media status at a bounded interval and suppresses overlapping status requests.
