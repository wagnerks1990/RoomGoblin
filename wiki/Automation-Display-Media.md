# Automation Display Media

Classroom display receivers use stable direct URLs (`/display/tv1`, `/display/tv2`, and so on) without credentials by default. Display enrollment is an optional administrator-enabled security mode, not part of the normal receiver workflow.

Uploaded media is still protected. The backend issues each connected enabled display a short-lived signed asset token for `/media/*` and `/presentations/*`. A successful automation result does not by itself prove an image rendered; the receiver must also be able to fetch the protected asset.

For linked-class automations, **Use class default display targets** is a persisted event preference and must survive Save/Edit cycles even when the primary action is lighting. Explicit action-specific targets remain authoritative where selected.

## Verification

- Confirm the direct display URL is connected.
- Test a Show Media action and verify the actual receiver renders the selected file.
- Save a linked-class event with class default display targets enabled, reopen it, and verify the checkbox remains enabled.
- Verify explicit cross-domain targets are preserved.


## Test Now and linked-class behavior

`Test Now` executes every action in order and reports the exact action or timer overlay that failed. When a linked class is not scheduled today, manual testing still uses that class as a deterministic context so display text/media/targets and timer rendering can be validated. This exception applies only to manual testing; scheduled execution still requires the linked class and school cycle to match the actual date.

When **Use class default display targets** is enabled, the class display targets are authoritative for every display-domain action in the automation, including display actions added to a lighting-led event and the timer overlay. The action editor shows the effective per-class display targets read-only. Manual display selections are preserved for reuse if inheritance is disabled. TV-power and lighting targets remain separate.

Alternating-day automations inherit the configured school-cycle anchor. Phase A/B remains the stored phase identity even when the school profile gives those phases friendly labels such as Green Days or Group B Days.


## Action execution modes and persistent video sessions

Automation follow-up actions now carry an execution policy. **Run once** executes the action one time, **Repeat N times** repeats only that action with an optional delay, and **Loop media continuously** is available for `display.media`. Media looping is receiver-native: RoomGoblin does not restart the automation, so preceding TV power, routing, lighting, or setup actions are not reissued.

Uploaded video playback is a persistent media session identified by a stable `sessionId`. Reissuing the same session updates playback properties rather than replacing the `<video>` element. Operators can change volume, mute state, playback rate, play/pause state, and current position while the MP4 remains loaded.

Video actions support `startAtSeconds`, `endAtSeconds`, `volume`, `muted`, `playbackRate`, and `loop`. When an end boundary is configured, looping seeks back to the configured start boundary instead of restarting the automation. A non-looping bounded clip pauses at the end and emits the normal media-ended signal.

The Media workspace includes a live playback panel for the selected receiver with play, pause, stop/rewind, restart, ±10-second seek, scrubber, volume, playback rate, and receiver telemetry. These commands use `display.media.control` and do not call `display.media`, so they must not reload or restart the active video.

Receivers report bounded `display.media.status` telemetry containing session ID, position, duration, volume, mute, loop and playback-rate state. This telemetry is operational state only; it does not replace persisted automation configuration.

### Safety and priority invariants

- Morning Announcements remain the highest-priority display/audio owner.
- Normal automation media still participates in existing Background Music priority reconciliation.
- Arbitrary non-media actions are never allowed to run forever. A requested `loop` on a non-media action is normalized to bounded repeat behavior.
- Display clear explicitly destroys the active video session.
- Existing stable display URLs, signed media access, class-target resolution, scheduler recovery, and timer behavior remain unchanged.

## Sequence-pass execution

Scheduled automations now cycle through their ordered actions. Run once participates only on the first pass, Loop X times participates for the configured number of passes, and Loop continually participates on every pass. This applies to display, TV, and lighting actions.

The sequence returns to Action 1 after its final action only while at least two actions remain eligible, or while an explicit finite repeat still has passes remaining. If the only remaining eligible action is `Loop continually`, it is not reissued. A newer overlapping scheduled automation cancels an older continuous loop. Class-linked loops stop at the resolved class end. Timer Overlay starts after the first pass.

The controller shows media settings by content type: images do not display video controls; video exposes clip/audio/rate controls; documents and presentations expose page/slide timing.

### Per-action automation dwell timing

Automation `repeatDelaySeconds` means the dwell/stay time **after an action executes and before advancing to the next eligible action**. `delaySeconds` is a pre-action wait. After the last eligible action, the runner returns to Action 1 only while at least two actions remain eligible; if only one `Loop continually` action remains, sequence processing stops and leaves that action's current state in place. Preserve canonical ordering, class-end cancellation, Morning Announcements priority, timer overlays, recovery, and cancellation behavior.

### Timer Overlay coverage across action sequences

Timer Overlay is event-level. Its `coverage` setting defaults to `all-display-actions`, which means RoomGoblin reasserts the same countdown after every display-content action (text, URL, media, image/document, or clear) so replacing the base display content does not remove the timer. `action-1-only` preserves the one-time overlay behavior. Reasserting a manual-duration timer must keep the original deadline rather than restarting its duration; class-end timers continue to resolve against the same class-end deadline. Morning Announcements priority still wins.


### Manual test isolation

`Resume Scheduled State` cancels and drains active manual continuous Run Now/draft runs before restoring current scheduled content. This prevents a test automation from resurfacing after its dwell timer when it is not currently scheduled.

## Save & Enable conflict checks

Simulation and saving use the same conflict policy. Editing an already-enabled automation preserves exact existing overlaps (same other automation, date, time, and resource set). The editor reports those overlaps as warnings with the other automation's name, date, time, and shared targets. New normal-day overlaps still block saving; newly created or previously disabled automations must pass the normal-day check before enabling. The saved server record supplies the baseline, never a browser-provided baseline.

Checks include the next 90 days. Half-day, one-hour-delay, and two-hour-delay overlaps are separate, non-blocking warnings for every automation: new, edited, or being enabled. Special days use their own timetable and never prevent saving the normal schedule. Normal-day validation is scanned separately so a long list of special-day warnings cannot hide a normal-day conflict. No-school and remote days are suppressed. Warnings do not reschedule events or alter runtime priority.

## Uploaded PDF viewer compatibility

Uploaded PDFs and office documents converted to PDF use
`/document-viewer/?file=...`. The receiver nests its authorized media URL in
`file`; preserve that entire value, including encoded filenames, cache version
and signed access-token query parameters. The existing media authorization
boundary still applies.

PDF.js 6 requires a document initialization object. The viewer must call
`getDocument({url: file})`, not the removed bare-string overload. Passing a
string produces "getDocument - expected either data, range, or url parameter"
before a PDF fetch/parse begins. That error alone does not establish a corrupt
upload or failed automation schedule. Do not ask operators to re-upload their
PDFs merely to fix this API mismatch.

The existing `/vendor/pdfjs/` route serves the locked package's `legacy/build`
module and matching worker. The modern build also fails on Chromium 143 because
it requires `Map.getOrInsertComputed`; the upstream compatibility build supplies
its supported polyfills without downgrading PDF.js or requiring a kiosk update.
Keep the module and worker on the same build/version. This does not promise
support for every historical browser; Chromium and Firefox are exercised in CI.

The viewer binds Previous, Next and Auto/Pause explicitly by element ID.
Do not rely on implicit window properties: the old `next` function shadowed the
button named `next`, leaving the button without a click handler.

### Regression and deployment verification

- `node --test test/document-viewer.test.js` checks initialization arguments,
  signed-URL preservation, button/keyboard navigation, loop/stop behavior,
  pause/resume and loading errors with a small PDF API fixture.
- After `npm ci --ignore-scripts`, install `test/browser/requirements.txt` and
  the appropriate Playwright browser. Run
  `DISPLAY_TEST_BROWSER=chromium python -m unittest discover -s test/browser -p 'test_document_viewer.py' -v`
  and repeat with `DISPLAY_TEST_BROWSER=firefox`.
- These browser tests load the actual locked PDF.js module and worker, render a
  synthetic three-page PDF, inspect canvas pixels, and exercise manual/automatic
  navigation plus missing/unauthorized asset errors. HTTP authorization is a
  fixture; this is not production Hub, scheduler or physical-display acceptance.
- The existing Display browser regression CI gate installs the locked npm
  dependencies and runs these tests in both browsers. Evidence is under
  `test-results/documents/` in its browser artifacts.

No upload, database, receiver-identity or automation migration is required.
Deploy only the exact validated/published Hub and maintenance image pair through
the normal backed-up updater. Then re-run the existing PDF automation on a
selected receiver so it opens the updated viewer. Confirm the first page,
Previous/Next, the configured start page, automatic page timing and loop/stop
behavior. Verify the actual PDF picture; an automation marked Completed only
proves command execution. Preserve Morning Announcements priority, scheduler
recovery and Background Music behavior.
