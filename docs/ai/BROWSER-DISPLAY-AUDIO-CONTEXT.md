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

## Close evidence and display identity

Every active host must use a unique receiver ID: simultaneous hosts using the same
ID share a Sendspin player identity and can replace one another. Do not infer a
relay bug solely from adopted-socket reconnect logs. Preserve the fixed Hub
`.closed`/`.rejected` diagnostics, per-relay correlation, original vs forwarded
close codes and browser `lastProxyClose`. Stale generation callbacks may log but
must not mutate the current session. Never log ticket-bearing proxy URLs, raw
frames or arbitrary upstream reason text. Read the diagnostics section of
`../MUSIC-ASSISTANT-SENDSPIN.md` before changing reconnect behavior.

The gesture hook calls `unlock()` before other awaited work. Automatic attachment
may encounter browser autoplay restrictions; a later `ctx=running` is evidence
of context recovery, not proof of audible playback. Keep managed autoplay policy
and WebView resume preservation. Diagnostics alone do not change those policies.

Unattended desktop Chrome/Edge is an administrator policy concern, not a page
JavaScript workaround. Prefer an origin-scoped enterprise autoplay allowlist for
the RoomGoblin display origin, applied to the dedicated kiosk profile. A broad
`AutoplayAllowed` policy or `--autoplay-policy=no-user-gesture-required` launch
flag is acceptable only for a locked-down, single-purpose kiosk after local risk
review. Verify active policy in `chrome://policy` or `edge://policy`, fully close
and reopen the browser, then test from a fresh profile without touching the page.
