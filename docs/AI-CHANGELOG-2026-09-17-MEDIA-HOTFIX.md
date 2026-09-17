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
