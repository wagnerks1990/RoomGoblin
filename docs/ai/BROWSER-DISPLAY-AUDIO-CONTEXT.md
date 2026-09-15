# Browser Display Audio AI Context

RoomGoblin's managed Android/Google TV application hosts the normal browser display receiver in a WebView. Browser Sendspin audio and native Android Sendspin are separate playback paths.

Critical invariant: do not reload or navigate an already-loaded display WebView merely because `MainActivity` resumes or is brought to the foreground. A navigation destroys the browser `AudioContext`; Chromium/WebView may then require user activation before the replacement context can run, breaking unattended classroom audio.

`MainActivity.onCreate()` loads the configured URL. Ordinary `onResume()` and non-reload `onNewIntent()` paths call `ensureConfiguredUrlLoaded()` so they only load when the WebView has no current URL. The explicit Agent reload action still calls `webView.reload()`.

Keep `WebSettings.setMediaPlaybackRequiresUserGesture(false)` enabled. Keep the receiver's explicit `SendspinPlayer.unlock()` gesture hook as fallback after genuine navigations, but do not use repeated reload/unlock loops as lifecycle recovery.

Keep the browser SDK on the reviewed Sendspin 3.x contract unless a dedicated
major-version migration also handles the newer cryptographic client identity,
Noise/pairing lifecycle, Music Assistant compatibility, registration mapping,
physical-TV validation, and rollback. Do not accept a major Dependabot bump
based only on bundle compilation or mocked browser tests.

The current reviewed package is 3.2.1. Patch/minor updates must retain the 3.x
identity and pairing contract, pass browser audio/unlock/reconnect coverage, and
keep an explicit physical-TV playback limitation and rollback note in the
operator documentation.

Do not change the same-Hub ticketed Sendspin proxy boundary, stable display IDs, enrollment behavior, Morning Announcements priority, scheduler reconciliation, or Background Music arbitration while working on this area.

Regression coverage: `test/android-tv-management.test.js` verifies ordinary resume/non-reload launch paths preserve the existing WebView.

The existing gesture hook requires the SDK `unlock()` API supplied in 3.2.1.
Test the actual bundled dependency export, not only the call site, and keep
runtime SDK version diagnostics aligned with the locked package.
