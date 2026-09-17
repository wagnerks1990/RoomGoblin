# AI Change Context — Automation Schema v2

Date: 2026-09-17

## Why this exists

The historical automation editor had two incompatible concepts: a special primary action (`event.action`, `event.targets`, `event.payload`) and `event.actions[]` for Action 2+. Only additional actions had a complete execution-policy editor, while only the primary media action had complete video payload controls. This produced inconsistent behavior and made future automation changes risky.

## Canonical model

Treat an automation as schedule metadata plus one ordered `actionSequence[]`. Do not add new features only to a special Action 1 path.

Each canonical action contains:

- stable `id`;
- `action`;
- `targets`;
- `useEventTargets` compatibility flag;
- `payload`;
- `delaySeconds`;
- `executionMode` (`once`, `repeat`, or media-only `loop`);
- `repeatCount`;
- `repeatDelaySeconds`;
- `continueOnError`.

Every `display.media` action must preserve `storedName`, `fit`, `autoAdvanceMs`, `startAtSeconds`, `endAtSeconds`, `volume`, `playbackRate`, and `muted`. Receiver-native continuous looping is represented by `executionMode=loop` and compiled to the media payload as required by the legacy runtime.

## Migration

`src/automation-schema.js` defines the v1 -> v2 conversion. Legacy primary fields become sequence element 0, then legacy additional actions are appended in order. Legacy `payload.loop=true` is interpreted as media `executionMode=loop`. Missing execution metadata defaults to `once`.

The converter is idempotent. Never append the primary action again when a v2 `actionSequence` already exists.

During the transition release, legacy runtime fields are compiled from the canonical sequence. The old runtime always executes its primary action once, so a repeated Action 1 is represented by its first execution in the legacy primary plus a private `.__primary-repeat-tail` compatibility step for the remaining executions. That private step is filtered when reconstructing the canonical editor sequence.

## Safety invariants

- Morning Announcements remain the highest-priority display takeover.
- Background Music remains paused until post-priority display reconciliation succeeds.
- Timer continuation still requires an explicitly valid same-class/period continuation.
- Display, lighting, TV-power, and other target domains must not leak targets into one another.
- `loop` is unbounded only for `display.media`. Non-media actions must use bounded repeats.
- Existing saved schedules must remain editable and executable after migration.
- SQLite remains authoritative; stale JSON files are not the source of truth.

## Controller rule

`public/controller/automation-v2.js` is the unified editor. The legacy primary widgets remain present only as a transition compatibility surface for existing controller functions and are hidden from operators. Do not restore a separate Action 1 UI. New action types and payload fields must be implemented once in the unified renderer so Action 1 and later actions remain equivalent.

## Removal plan

After the backend/runtime is fully native to `actionSequence[]` and deployed through a compatibility window, remove the legacy compiler, hidden primary widgets, and private repeat-tail representation. Do not remove them before migrated production records have been verified.

## Validation hardening

The unified editor must not interpolate runtime identifiers directly into inline event-handler JavaScript. Target IDs are encoded through the existing `inlineJsArg()` boundary before entering generated handlers. This preserves the controller's browser-action security contract while keeping the v2 editor data-driven.

Release `1.0.0-alpha.83` is the first compatibility release for this schema migration. Existing v1 records are converted in memory and compiled back to the legacy runtime representation during the transition; opening an old automation does not silently discard its original action order or payload.
