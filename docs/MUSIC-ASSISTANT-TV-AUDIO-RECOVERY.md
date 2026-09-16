# Music Assistant TV Audio Recovery

## Purpose

RoomGoblin can expose a Music Assistant player for a classroom display through either the managed Android native Sendspin path or the browser Sendspin compatibility path. A connected Sendspin transport does not by itself prove that sound is audible.

This document records the September 2026 TV-audio regression and the invariants required to prevent it from returning.

## Observed regression

A physical display reproduced this sequence after a receiver reload:

```text
Sendspin: Adopted WebSocket connected
Sendspin: Connected to server
Sendspin: Stream started { codec: 'flac', sample_rate: 48000, channels: 2 }
The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page.
```

Music Assistant therefore reported the player as connected/playing while the TV was silent. The same trace also showed initial `setVolume` and `setMuted` attempts before the Sendspin WebSocket was connected.

## Root cause

The September 9 selective dedicated-Sendspin migration kept the browser receiver and ticketed Hub relay but intentionally excluded an earlier browser audio-unlock patch. That preserved transport security and the current renderer, but it also removed the only explicit recovery path for Chromium's Web Audio user-activation requirement.

The Android kiosk already sets:

```java
settings.setMediaPlaybackRequiresUserGesture(false);
```

That setting remains required for ordinary media autoplay, but Chromium can still suspend a Web Audio `AudioContext`. Sendspin uses Web Audio in the browser player, so browser autoplay configuration alone is not sufficient.

## Unattended desktop kiosk browsers

RoomGoblin cannot synthesize a trusted browser gesture. If clicking or pressing a
key in the receiver immediately changes the log to `AudioContext resumed`,
`audio unlocked`, and `ctx=running`, the receiver hook is working and the
remaining unattended-start requirement belongs to the browser's managed policy.

For a dedicated Chrome or Edge kiosk profile, use administrator-managed autoplay
policy scoped to the RoomGoblin display origin where the browser supports an
allowlist. [Chrome documents](https://developer.chrome.com/blog/autoplay/#chrome-enterprise-policies)
`AutoplayAllowed` and `AutoplayAllowlist` for kiosk and unattended systems.
[Edge exposes](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/autoplayallowlist)
the same named mandatory policies; on
Windows they are under `SOFTWARE\Policies\Microsoft\Edge`, with numbered
`REG_SZ` values beneath `AutoplayAllowlist`. Use a generic origin pattern such
as `http://roomgoblin-host:3000` in documentation and substitute the actual
trusted local origin only during deployment.

On Linux Chrome, [machine policy JSON](https://support.google.com/chrome/a/answer/9027408)
belongs under
`/etc/opt/chrome/policies/managed/`. A dedicated kiosk policy can use:

```json
{
  "AutoplayAllowed": true,
  "AutoplayAllowlist": ["http://roomgoblin-host:3000"]
}
```

An explicitly managed kiosk launch may alternatively add
`--autoplay-policy=no-user-gesture-required`; enterprise policy is preferred
because it is visible and auditable. Do not add this flag to ordinary interactive
browsers. After a policy change, fully close and reopen every browser process,
confirm the values and `OK` status in `chrome://policy` or `edge://policy`, and
test a fresh page load without touching the receiver. Keep one unique display ID
per active host.

Policy permits unattended audio; it does not prove speaker output, volume, route,
or Music Assistant transport health. If the context still reports `suspended`,
the policy did not apply to that executable/profile/origin. Do not add synthetic
clicks, reconnect loops, or repeated page reloads as a workaround.

## Maintained browser fallback contract

`public/display/index.html` directly owns the fallback behavior. Do not replace it with deployment-time patch scripts.

Required invariants:

1. `window.roomGoblinUnlockMusicAssistantAudio()` remains available for diagnostics.
2. `pointerdown`, `touchstart`, and `keydown` invoke the current Sendspin player's `unlock()` while audio is locked.
3. A newly attached/reconnected browser player begins with `audioLocked: true` until unlock succeeds.
4. Receiver status carries `audioLocked` and `audioUnlocked`; transport state alone must never be treated as proof of audible playback.
5. Desired volume and mute state are applied only after `maSendspinPlayer.connect()` resolves. Do not send player state immediately after construction because the socket may not yet be open.
6. Closing/replacing the browser player resets its unlock state.

Regression coverage lives in `test/music-assistant-browser-audio-unlock.test.js` and the display browser suite.

## Preferred managed Android path

For RoomGoblin-managed Android/Google TV hardware, Native Sendspin is the preferred long-term audio path after physical validation:

```text
Music Assistant :8927/sendspin
  -> Android AgentService
  -> sendspin-jvm
  -> AndroidPcmSendspinPlayer
  -> AudioTrack
  -> HDMI / TV audio
```

Native playback is deliberately independent of WebView reloads, kiosk navigation, renderer refreshes, and browser AudioContext policy. See `docs/ANDROID-TV-NATIVE-SENDSPIN.md`.

The browser player must remain functional as a fallback until native Sendspin has been physically validated and fleet migration is complete. Do not remove the browser unlock guard merely because native playback exists.

## Diagnostic interpretation

### Connected + stream started + AudioContext warning

This is a browser audio-lock problem. The transport is working. Trigger the receiver's audio unlock with a real pointer/touch/key interaction, or migrate the managed endpoint to validated Native Sendspin.

### `Cannot send message, WebSocket not connected`

State was sent before Sendspin connection readiness. Current code prevents desired volume/mute from being applied until `connect()` resolves. Treat recurrence as a regression.

### Frequent WebSocket disconnect/reconnect

Investigate Music Assistant, the dedicated Sendspin listener, Wi-Fi/network stability, and buffer diagnostics separately. Audio unlock does not fix network loss.

### Player reports playing but native output is silent

For a managed Android endpoint, inspect Agent v2 Native Sendspin status: `connected`, `playing`, `bufferedChunks`, `droppedChunks`, `lateChunks`, `droppedDecodeFrames`, and `lastError`. Then verify HDMI/device audio independently.

## Release verification

Before merging or releasing a change that touches display audio, Sendspin, the receiver renderer, Android kiosk setup, or Music Assistant routing:

1. Run `npm run check`.
2. Run `npm test`, including `test/music-assistant-browser-audio-unlock.test.js`.
3. Run the Display browser regression workflow.
4. Run Android agent validation when managed-display code changes.
5. On a physical TV, attach the browser fallback, reload the display, and verify audio-lock status is visible and a real user gesture restores sound when Chromium requires one.
6. On a native-enabled managed TV, reload/exit/recover the WebView while music plays and verify native audio continues.
7. Verify Morning Announcements still pause Background Music and that scheduler reconciliation resumes it only after the priority source ends.

## Historical warning

Do not repeat the selective-migration mistake of treating browser audio unlock as an unrelated convenience. If the browser Sendspin path remains supported, audio activation is part of its functional contract. Any change that removes or bypasses the unlock behavior must provide an equivalent tested mechanism first.
