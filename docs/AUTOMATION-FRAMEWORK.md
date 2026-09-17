# Automation Framework

RoomGoblin automations are stored in SQLite and execute through a shared framework regardless of whether an action controls displays, TV power, lighting, media, or a class-end timer.

## Schema v2: one ordered action sequence

Automation schema v2 removes the historical distinction between a special primary action and additional actions. The canonical editor model is an ordered `actionSequence[]`. Every action uses the same shape:

- `id`
- `action`
- `targets`
- `useEventTargets`
- `payload`
- `delaySeconds`
- `executionMode` (`once`, `repeat`, or media-only `loop`)
- `repeatCount`
- `repeatDelaySeconds`
- `continueOnError`

Action 1 has the same execution controls and payload editor as Action 2, Action 3, and later actions. Every `display.media` action exposes the complete media payload: uploaded item, fit, page/slide interval, clip start/end, volume, playback rate, mute, and receiver-native looping.

### Migration and compatibility

`src/automation-schema.js` contains the idempotent v1 → v2 converter. A legacy event is interpreted as:

1. legacy `action` + `targets` + `payload` → `actionSequence[0]`;
2. legacy `actions[]` → subsequent sequence entries;
3. legacy media `payload.loop=true` → `executionMode=loop`;
4. missing per-action execution metadata → `once`.

For the transition release RoomGoblin also compiles a legacy compatibility view (`action`, `targets`, `payload`, and additional `actions[]`) from the canonical sequence. This lets the existing scheduler/runtime execute migrated records while the controller and future persistence use one coherent schema. A repeated Action 1 is compiled into a private repeat-tail step because the legacy runtime always executes its primary action once. That compatibility step is never presented as a user action and is collapsed when old data is read back.

The conversion is designed to be idempotent: running it against an already-normalized v2 event does not create additional actions or change their order.

## Persistence

SQLite is authoritative. Compatibility helpers may continue to refer to historical JSON filenames such as `automations.json`, but data-directory reads and writes are redirected through `ClassroomHubStorage`. A stale physical JSON file must never be treated as current state when `LEGACY_JSON_MIRROR=false`.

## Linked classes and targets

An automation can link to one or more class schedules. Normal scheduled execution resolves each matching class independently, using that class's effective start/end times and school-cycle rules. Date, cycle, exclusion, and class-enabled checks remain strict for real scheduled runs.

`Test Now` validates execution rather than today's calendar eligibility. If no linked class is active or scheduled today, the first enabled linked class becomes a deterministic manual-test context.

Class-default display targets remain a display-domain policy. Actions in another resource domain never inherit display IDs as lighting or TV identifiers. Later actions may explicitly use the same compatible targets as Action 1 or select their own targets.

## Execution policy

Every action persists an execution policy.

- `once`: execute one time.
- `repeat`: execute 1–100 times with an optional bounded delay between attempts.
- `loop`: valid only for `display.media`; looping is performed inside the receiver's active media element so preceding TV, lighting, routing, and setup actions are not rerun.

A non-media request for an unbounded loop is normalized to bounded repeat semantics. RoomGoblin must never create an infinite power, lighting, routing, or other side-effecting command generator.

## Timer behavior

Scheduled class-end timers require the class to be scheduled on the actual execution date. Manual `Test Now` runs may bypass only that calendar-eligibility check; they still resolve the configured class and its effective end time. Both standalone `display.timer.class-end` actions and the Timer Overlay addon follow this contract.

## Announcement priority during execution

Morning Announcements reserve only their target displays. The scheduler may continue non-display actions while recording locked display work for the post-announcement winner resync. Priority is checked before every display delivery; a delayed or multi-step automation cannot overwrite an announcement takeover that began after the automation started.

Background Music remains paused until display reconciliation succeeds.

## Existing-conflict edit compatibility

Conflict validation must not turn an already-saved automation into an uneditable record after an upgrade. Existing exact date/time/resource conflicts may be grandfathered for an edit; newly introduced conflicts are still rejected.

## Regression requirements

Changes to the scheduler or controller must preserve these invariants:

1. Real scheduled runs retain strict school-calendar and cycle enforcement.
2. Manual tests can use a linked class even when it is not scheduled today.
3. Class-default display targets work across cross-domain action sequences.
4. Every action, including Action 1, has the same execution-policy model.
5. Every media action has the complete media payload editor.
6. v1 → v2 migration is ordered, lossless for supported fields, and idempotent.
7. Media loop never restarts preceding actions.
8. Non-media unbounded loops are rejected/normalized.
9. Timer and action failures expose actionable details.
10. SQLite remains authoritative.

Core regression coverage includes `test/automation-schema-v2.test.js`, `test/automation-editor-v2.test.js`, `test/automation-media-sessions.test.js`, and the existing scheduler stabilization suites.
