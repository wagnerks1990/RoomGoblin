# 2026-09-17 media-session hotfix

This hotfix follows the media-plane split introduced in PR #138.

## Production findings

After deployment, the control plane remained responsive during video playback and Clear Selected / Clear Classroom worked, confirming that separating media payload delivery from port 3000 corrected the original controller starvation problem.

Two follow-up issues remained:

1. physical display renderers could remain on the previous JavaScript because the prior media-plane deployment kept the release version at `1.0.0-alpha.82`; the server therefore had no version mismatch with which to force receiver reload/convergence;
2. the Today workspace had removed its read-only display preview iframes entirely, which removed useful operator visibility.

## Changes

- bump the release to `1.0.0-alpha.83` so every physical receiver reloads and receives the persistent media-session implementation;
- restore Today-page read-only display preview iframes for live text/image/timer/state observation;
- prevent controller preview tiles from locally decoding receiver video. When a preview renderer creates a `<video>`, the parent controller immediately pauses it, removes its source, and shows `Video active on physical display` instead;
- retain the Display Studio rule that its local receiver preview is suspended while using persistent video controls;
- keep media payload traffic isolated on port 3020 and controller/API/WebSocket traffic on port 3000.

## Expected behavior after deployment

- play/pause/restart/stop, seek/scrub, volume/mute, and playback-rate commands operate the active physical receiver video without reloading the MP4;
- receiver `display.media.status` telemetry populates the Media Library and Display Studio live-playback panels;
- Today previews again show live receiver state but do not become additional MP4 decoders;
- video traffic remains on the media plane while control traffic remains responsive.

## Release convergence correction

All independently deployed release surfaces are converged on `1.0.0-alpha.83`, including the controller bundle, root and maintenance package metadata, package locks, and native Host Agent wrapper. This is required so receiver build/version comparison can force stale display renderers to reload after the media-session hotfix.

## Preview authorization follow-up

Production alpha.83 testing showed repeated `3020 /media/*.mp4 -> 401` requests in the controller while Today live previews were open. These requests came from preview receivers, which intentionally do not hold physical-display asset tokens, briefly creating a video source before the parent controller removed it.

The preview renderer now short-circuits `video` state before URL authorization or `<video src>` creation and renders a lightweight `Video active on physical display` placeholder instead. The media plane also forwards an authenticated controller browser's existing session cookie only to its loopback `3000` HEAD authorization probe so protected image/document previews remain available. Physical receivers continue to authorize with signed asset tokens.

## Alpha.84 playback follow-up

Production testing after the preview authorization hotfix exposed two additional playback defects:

1. Display Studio still created a real `<video src="/media/...">` for every uploaded MP4 card, causing the controller to open large video files merely to draw thumbnails.
2. The physical receiver's `canplay` handler unmuted `forceAudio` video before calling `play()`. Chromium/Android may reject that audible programmatic autoplay and show a play affordance instead of starting the commanded video.

Alpha.84 removes MP4 elements from controller media cards and uses lightweight VIDEO placeholders. Receiver playback now starts in an autoplay-safe muted state, then applies the requested audio state after playback begins. If audible autoplay remains blocked, playback falls back to muted instead of stopping. Play failures and media errors are surfaced through receiver telemetry/badge state rather than being silently swallowed.

Persistent media-session replay no longer forces an already-running session back to muted, and volume/mute/rate controls update the canonical active-session state so later Play/Restart operations preserve the operator's latest settings.

The version bump to `1.0.0-alpha.84` is required to force every physical receiver to reload the corrected renderer.

## Separate-port CORP follow-up

Production testing exposed Chromium `ERR_BLOCKED_BY_RESPONSE.NotSameSite` on correctly signed `:3020/media/*` requests. The media response still carried `Cross-Origin-Resource-Policy: same-site`; with the receiver on port 3000 and media on port 3020, Chromium blocked the response before playback.

The media plane now returns `Cross-Origin-Resource-Policy: cross-origin` for authorized media responses. This does not relax RoomGoblin's asset authorization: the signed display token or authenticated controller session is still validated by the control plane before any bytes are served. The header only permits the already-authorized media element to consume the intentionally separate-port response.
