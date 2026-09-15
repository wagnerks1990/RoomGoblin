# Browser Display Audio Lifecycle

## Purpose

RoomGoblin browser displays may play Music Assistant audio through the Sendspin browser receiver. A managed Android/Google TV can still use the browser receiver inside the RoomGoblin WebView; this path is distinct from the optional native Android Sendspin player.

## Critical lifecycle invariant

A routine Android activity resume, kiosk watchdog foreground operation, or non-reload Agent launch must **not** reload the existing WebView.

A WebView navigation destroys the current JavaScript realm, including the Sendspin `AudioContext`. Chromium/WebView may then apply autoplay restrictions to the newly created context. Physical TV4 testing reproduced this sequence:

1. Sendspin connected and reported `ctx=running`.
2. The display navigated again to `/display/tv4`.
3. Sendspin reconnected and started a stream.
4. Chromium reported `The AudioContext was not allowed to start`.
5. Audio remained unavailable until a qualifying user activation.

The RoomGoblin Android display activity previously called `loadConfiguredUrl()` unconditionally from `onResume()` and from ordinary `onNewIntent()` launches. That meant normal lifecycle transitions could destroy a healthy browser audio context even though the display URL had not changed.

## Supported behavior

`MainActivity` now:

- loads the configured display URL when the WebView is first created;
- preserves the existing WebView and JavaScript/audio context during ordinary `onResume()`;
- preserves it when `MainActivity.launch(..., false)` only brings the kiosk activity to the foreground;
- performs `webView.reload()` only when the explicit Agent reload action supplies `agent_reload=true`;
- reloads the configured URL automatically only when the WebView has no current URL;
- retains `setMediaPlaybackRequiresUserGesture(false)` for managed kiosk playback.

This keeps explicit administrator reload semantics intact while preventing background lifecycle recovery from behaving like a full page reload.

## Browser Sendspin behavior

The display receiver's explicit `SendspinPlayer.unlock()` hook remains a recovery fallback for browsers that require a real user gesture after a genuine page navigation. It is not a substitute for preserving an already-running browser context.

The same-Hub ticketed Sendspin proxy remains the browser transport boundary. This change does not expose Music Assistant directly to the browser and does not change display enrollment, player IDs, Morning Announcements priority, scheduler behavior, or Background Music arbitration.

## Verification

For a managed browser display with Music Assistant actively playing:

1. Confirm the console reaches a Sendspin line containing `ctx=running`.
2. Exercise Home/Back recovery or another ordinary activity resume that brings RoomGoblin back to the foreground without requesting Reload.
3. Confirm the browser does **not** log a new `Navigated to /display/<id>` solely because the activity resumed.
4. Confirm Sendspin continues playing without a fresh `AudioContext was not allowed to start` warning.
5. Use **Reload via Agent** and confirm an explicit navigation/reload still occurs.
6. Confirm Morning Announcements and Background Music arbitration remain unchanged.

Automated regression coverage is in `test/android-tv-management.test.js` and requires ordinary resume/non-reload intent paths to use `ensureConfiguredUrlLoaded()` rather than `loadConfiguredUrl()`.