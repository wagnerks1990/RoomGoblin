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
