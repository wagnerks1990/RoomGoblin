# Automation Framework

RoomGoblin automations are stored in SQLite and execute through one canonical ordered action sequence. The schedule decides **when** an automation starts; each action decides **whether it participates on each pass** through that sequence.

## Per-action dwell timing

Actions execute in canonical order. Each action's `repeatDelaySeconds` is the **stay/dwell time after that action is applied and before RoomGoblin advances to the next eligible action**. `delaySeconds` remains a pre-action wait.

For example, if Action 1 has a 3600-second dwell and Action 2 has a 60-second dwell, RoomGoblin runs Action 1, leaves it active for one hour, runs Action 2, leaves it active for one minute, then returns to Action 1 when the configured execution modes keep the sequence eligible. This applies to text, URLs, media, lighting, TV power, and other automation actions. When the class/event window ends, the sequence stops normally.

## Schema v3: scheduled automation + ordered actions

The canonical persisted model is `actionSequence[]`. There is no runtime distinction between a primary action and later actions. Every action has the same fields:

- `id`
- `action`
- `targets`
- `useEventTargets`
- `payload`
- `delaySeconds`
- `executionMode` (`once`, `repeat`, or `loop`)
- `repeatCount`
- `repeatDelaySeconds`
- `continueOnError`

Legacy `action`, `targets`, `payload`, and `actions[]` fields remain compatibility mirrors for old saved data and database projections. The runtime must execute `actionSequence[]`, not those mirrors.

## Sequence-pass execution

The runner proceeds Action 1 → Action 2 → Action 3 → … and then returns to Action 1 while any action remains eligible.

- **Run once**: execute on pass 1, then skip on later passes.
- **Loop X times**: execute on passes 1 through X, then skip.
- **Loop continually**: execute on every pass until the occurrence is cancelled, changed, disabled, superseded, or reaches its linked-class end boundary.

Each action keeps its own delay, targets, payload, and error policy. A failed action with `continueOnError=true` does not block the remaining eligible actions on that pass. With `continueOnError=false`, the sequence stops.

A continuous sequence with no configured waits is rate-limited so it cannot spin faster than one complete pass per second. Delays are cancellation-aware and class-boundary-aware.

## Scheduling and supersession

Scheduled occurrences are durably claimed before execution. When a newer scheduled occurrence starts and uses a resource already owned by an older running continuous sequence, RoomGoblin requests cancellation of the older overlapping occurrence before starting the newer one. This prevents two scheduled loops from continuously fighting for the same display, TV, or lighting target.

Editing, disabling, or deleting a running automation also invalidates its revision/configuration and causes the runner to stop at the next cancellation-aware checkpoint.

Linked-class continuous automations stop cleanly when the resolved class occurrence ends. Startup reconciliation and operator Resume also recover continuous occurrences that are still currently applicable, even when their original start time is outside the normal scheduler catch-up window.

## Manual execution

Simulation never dispatches devices.

A live draft test executes one pass when the draft contains any continuous action, so the HTTP request cannot hang indefinitely. Saved scheduled continuous occurrences use the normal background scheduler lifecycle and cancellation controls.

## Media-aware editing

The controller shows only settings that apply to the selected uploaded content:

- images: fit/preview;
- video: fit, clip start/end, volume, mute, playback rate, preview;
- PDF/presentation/document: fit, page/slide interval, preview.

Media `payload.loop` follows the action execution mode. A media action set to `loop` remains eligible on every sequence pass; the receiver may keep that media playing between later actions until another display action replaces it.

## Scheduled workspace

Saved scheduled automations are presented through selectors ordered by resolved run time. Class-linked entries sort by their earliest resolved occurrence. The editor selector uses the same order so operators can move between automations without a long card list.

## Linked classes and target domains

Class-default display targets remain a display-domain policy. They do not become lighting or TV identifiers. Each action resolves its own resource domain and may either share compatible Action 1 targets or specify explicit targets.

## Timer overlays

Timer Overlay is initialized after the first sequence pass rather than after the entire automation finishes. This allows overlays to coexist with continuous sequences. The overlay itself is not replayed on every pass.

Standalone `display.timer.class-end` remains a normal action and follows its configured per-pass execution policy.

## Morning Announcements and Background Music

Morning Announcements remain the highest-priority display/audio owner. Priority is checked before each display delivery. Locked display work is deferred while non-display actions may continue. When announcements end, RoomGoblin reconciles the current winning scheduled display state rather than restoring stale snapshots.

Background Music remains paused until display reconciliation succeeds.

## Migration

Legacy automations are interpreted as Action 1 plus legacy additional actions and normalized into schema v3. Migration is idempotent. Existing IDs, targets, class bindings, schedule fields, and payloads are preserved.

The retired browser `automation-hotfix.js` is no longer loaded; its required behavior is part of the main controller and backend.

## Regression requirements

Changes to automation/scheduler behavior must prove:

1. scheduled runs preserve school-calendar/cycle enforcement;
2. Action 1 and every later action share the same execution semantics;
3. once/repeat/continuous eligibility is correct on every sequence pass;
4. finite sequences terminate when no action remains eligible;
5. continuous sequences are cancellation-aware and rate-limited;
6. newer overlapping scheduled occurrences supersede older loops;
7. class-linked continuous runs stop at the class boundary;
8. timer overlays initialize during continuous sequences;
9. content-specific media controls remain correct;
10. Morning Announcements priority and post-announcement reconciliation remain intact;
11. Background Music priority recovery remains intact;
12. SQLite remains authoritative;
13. legacy saved automations remain migratable without duplicate actions.

### Timer Overlay coverage across action sequences

Timer Overlay is event-level. Its `coverage` setting defaults to `all-display-actions`, which means RoomGoblin reasserts the same countdown after every display-content action (text, URL, media, image/document, or clear) so replacing the base display content does not remove the timer. `action-1-only` preserves the one-time overlay behavior. Reasserting a manual-duration timer must keep the original deadline rather than restarting its duration; class-end timers continue to resolve against the same class-end deadline. Morning Announcements priority still wins.


## Manual Run Now isolation on Resume

`Run Now` and live draft tests may start managed continuous automation loops. `Resume Scheduled State` is an explicit return-to-scheduler boundary: it cancels every active manual continuous run, waits for those tasks to observe cancellation and exit, and only then reasserts current scheduled winners and recovers applicable scheduled continuous occurrences. A manual test that is not currently scheduled must never repaint displays after Resume completes.


Starting another manual automation on overlapping resources also replaces any active managed manual continuous run before the new one-shot action executes. This applies to both saved **Run Now** and live draft runs, so an older manual loop cannot wake later and overwrite the newer manual test.
