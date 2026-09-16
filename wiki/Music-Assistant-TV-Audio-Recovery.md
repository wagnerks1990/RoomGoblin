# Music Assistant TV Audio Recovery

RoomGoblin supports Music Assistant playback on classroom displays through managed Android Native Sendspin and a browser Sendspin compatibility path. A player can be connected and report **playing** while the TV is silent if Chromium blocks the browser Web Audio `AudioContext`.

## September 2026 regression

Physical TV testing reproduced:

```text
Sendspin: Connected to server
Sendspin: Stream started
The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page.
```

The September 9 selective dedicated-Sendspin migration retained the browser receiver but intentionally omitted the previous browser audio-unlock hook. That omission caused the regression after receiver reload/navigation.

## Required fallback behavior

The maintained receiver now owns the unlock behavior directly in `public/display/index.html`:

- a current Sendspin player can be unlocked with `window.roomGoblinUnlockMusicAssistantAudio()` for diagnostics;
- real `pointerdown`, `touchstart`, or `keydown` gestures invoke `SendspinPlayer.unlock()` while audio is locked;
- status reports `audioLocked` / `audioUnlocked` rather than treating transport activity as proof of sound;
- desired volume and mute are sent only after the Sendspin connection promise resolves, preventing startup `WebSocket not connected` state-send errors;
- reconnecting/replacing the browser player resets unlock state.

`agents/android-tv/.../MainActivity.java` must also retain `setMediaPlaybackRequiresUserGesture(false)` for ordinary media autoplay, but that WebView setting does not replace the Web Audio unlock fallback.

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

## Preferred managed-TV architecture

Once physically validated for the target hardware, use Native Sendspin for managed Android/Google TV devices:

```text
Music Assistant
  -> :8927/sendspin
  -> RoomGoblin AgentService
  -> sendspin-jvm
  -> Android AudioTrack
  -> HDMI / TV audio
```

Native audio is intentionally independent of WebView reloads, kiosk recovery, page navigation, and Chromium autoplay policy. The browser path remains a supported fallback and must not be broken while it is still exposed.

## Troubleshooting

- **Stream starts + AudioContext warning + silence:** browser audio is locked; use a real TV input gesture or validate/migrate Native Sendspin.
- **`Cannot send message, WebSocket not connected`:** volume/mute was sent too early; recurrence is a regression.
- **Frequent disconnects or stuttering:** investigate Wi-Fi/network stability, Music Assistant's Sendspin listener, and buffer diagnostics separately.
- **Native player silent:** inspect Agent Native Sendspin `connected`, `playing`, `bufferedChunks`, `droppedChunks`, `lateChunks`, `droppedDecodeFrames`, and `lastError`, then verify HDMI/device audio.

## Regression protection

Keep `test/music-assistant-browser-audio-unlock.test.js`, the display browser regression suite, and Android agent validation passing. Also preserve Morning Announcements priority and Background Music pause/reconcile/resume behavior when changing any audio path.

Detailed engineering notes: `docs/MUSIC-ASSISTANT-TV-AUDIO-RECOVERY.md` and `docs/AI-MUSIC-ASSISTANT-ROUTING.md`.
