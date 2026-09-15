# Browser Display Audio AI Context

RoomGoblin's managed Android/Google TV application hosts the normal browser display receiver in a WebView. Browser Sendspin audio and native Android Sendspin are separate playback paths.

Critical invariant: do not reload or navigate an already-loaded display WebView merely because `MainActivity` resumes or is brought to the foreground. A navigation destroys the browser `AudioContext`; Chromium/WebView may then require user activation before the replacement context can run, breaking unattended classroom audio.

`MainActivity.onCreate()` loads the configured URL. Ordinary `onResume()` and non-reload `onNewIntent()` paths call `ensureConfiguredUrlLoaded()` so they only load when the WebView has no current URL. The explicit Agent reload action still calls `webView.reload()`.

Keep `WebSettings.setMediaPlaybackRequiresUserGesture(false)` enabled. Keep the receiver's explicit `SendspinPlayer.unlock()` gesture hook as fallback after genuine navigations, but do not use repeated reload/unlock loops as lifecycle recovery.

Do not change the same-Hub ticketed Sendspin proxy boundary, stable display IDs, enrollment behavior, Morning Announcements priority, scheduler reconciliation, or Background Music arbitration while working on this area.

Regression coverage: `test/android-tv-management.test.js` verifies ordinary resume/non-reload launch paths preserve the existing WebView.