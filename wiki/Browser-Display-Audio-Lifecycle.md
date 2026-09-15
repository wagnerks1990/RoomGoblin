# Browser Display Audio Lifecycle

RoomGoblin managed Android/Google TV devices can use the browser display receiver for Music Assistant / Sendspin audio. The browser path must preserve its WebView across ordinary activity resume and kiosk recovery operations.

## Why

A normal Android activity resume previously called `loadConfiguredUrl()` again. That navigated the WebView even when the display was already loaded. A navigation destroys the current Sendspin Web Audio context; Chromium/WebView can then block the replacement `AudioContext` until a real user gesture occurs.

Physical TV4 testing showed the exact sequence: working Sendspin with `ctx=running`, a new navigation to `/display/tv4`, then `The AudioContext was not allowed to start`.

## Current contract

- Initial activity creation loads the configured display URL.
- Ordinary `onResume()` does not reload an already-loaded WebView.
- Bringing the kiosk activity forward without an explicit reload does not reload it.
- **Reload via Agent** remains an explicit reload and uses `webView.reload()`.
- The managed WebView retains `setMediaPlaybackRequiresUserGesture(false)`.
- The browser receiver retains its explicit gesture-based `SendspinPlayer.unlock()` fallback for genuine navigations where the platform still requires activation.
- The browser continues to use RoomGoblin's same-Hub ticketed Sendspin proxy; Music Assistant is not exposed directly to the display.

See `docs/BROWSER-DISPLAY-AUDIO-LIFECYCLE.md` for validation and maintainer details.