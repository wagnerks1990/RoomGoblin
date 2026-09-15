# AI Context — Music Assistant Player Routing

This file is a focused AI/contributor context for RoomGoblin's Music Assistant player identity and TV audio rules.

## Invariant

One physical device may appear in Music Assistant as a Universal Player plus one or more protocol-specific player records. Do not treat every `players/all` item as a separate physical speaker.

Use Music Assistant's explicit `output_protocols[].output_protocol_id` relationship to correlate protocol children with their canonical parent. Do not deduplicate by display name, MAC-looking IDs, or a guessed `up<mac>` naming convention.

## Controller behavior

- Keep linked protocol children available for diagnostics.
- Show the canonical parent once in normal player controls.
- Route `player_id` and `queue_id` commands to the canonical parent when a child alias is known.
- Background Music queue ownership belongs to the canonical player, not necessarily the active output protocol child.
- Preserve upstream queue-empty errors as queue-state errors; do not classify them as network failures.

## Managed TV audio invariant

Managed Android/Google TV devices should use the native Android Sendspin player when it has been configured and validated on that device family. Native playback is owned by `AgentService` and must remain independent of WebView reloads, kiosk recovery, page navigation, and Chromium autoplay policy.

The browser Sendspin receiver remains a compatibility fallback for browser-only/unmanaged displays. Do not remove its explicit audio-unlock behavior. Chromium can allow the Sendspin WebSocket and stream to start while still suspending the Web Audio `AudioContext`; in that state Music Assistant can report **playing** while the TV is silent.

The maintained browser fallback must therefore preserve all of these behaviors:

- `public/display/index.html` exposes `window.roomGoblinUnlockMusicAssistantAudio` for diagnostics;
- `pointerdown`, `touchstart`, and `keydown` user gestures call the Sendspin player's `unlock()` method while audio is locked;
- status reports `audioLocked` / `audioUnlocked` instead of claiming audible playback merely because transport is active;
- desired volume/mute are not sent until the Sendspin connection promise has resolved, avoiding `Cannot send message, WebSocket not connected` startup errors;
- `agents/android-tv/.../MainActivity.java` keeps `setMediaPlaybackRequiresUserGesture(false)` for ordinary autoplay-capable media, but that setting is not a substitute for the Sendspin Web Audio unlock fallback.

Historical context: the September 9, 2026 selective dedicated-Sendspin migration intentionally excluded the earlier browser audio-unlock patch while retaining the browser transport. Physical testing later reproduced the regression: the stream connected and started, then Chromium logged `The AudioContext was not allowed to start` and the TV remained silent. The maintained source now owns the unlock logic directly; do not reintroduce one-off patch scripts.

## ESPHome boundary

ESPHome entities named `Sendspin Player` and `Player` can both legitimately exist inside one CAST-1. They are native ESPHome entities and are not evidence of duplicate ESPHome device discovery. Do not merge ESPHome entities using Music Assistant player rules.

## Regression

Keep these checks passing together with the full repository suite:

- `test/music-assistant-universal-player.test.js`
- `test/music-assistant-browser-audio-unlock.test.js`
- display browser regression tests
- Android agent validation

See `docs/MUSIC-ASSISTANT-PLAYER-ROUTING.md`, `docs/MUSIC-ASSISTANT-SENDSPIN.md`, and `docs/ANDROID-TV-NATIVE-SENDSPIN.md` for the detailed operator/developer contracts.
