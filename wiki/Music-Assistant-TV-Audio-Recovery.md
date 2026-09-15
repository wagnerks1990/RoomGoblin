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
