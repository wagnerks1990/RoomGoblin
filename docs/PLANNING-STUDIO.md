# Planning and Scene Studio

Unreleased development work. A draft PR and browser fixtures do not establish
production deployment or acceptance on physical receivers.

## Everyday workflow

Use **Calendar & Timetables** to choose the date, school status, cycle override
and reusable timetable. The month shows resolved cycle/group, closures and
special timetable names. Preview recalculates month badges from the draft;
changing a closure can shift subsequent calculated cycles. Previous/next month,
Today, and a bounded date-range tool reduce repeated editing. Range changes
remain drafts until Preview changes and Save reviewed plan.

Timetable rows collapse to their time and label. Open a row to change its kind,
period, exact class, cycle restriction or start/end. Regular days can retain
existing class times. Special timetables affect only assigned dates unless they
are explicitly made regular. Stable class and automation IDs remain intact.

**Classes** is a searchable library with a focused details dialog, human-readable
continuation selection, enabled state and optional active date range. Choose
Specific dates for homeroom or another special-day class. A date-only class never
falls through to weekly recurrence. When Planning supplies the selected day,
assign that class to a teaching block in its timetable. Defining a class alone
does not issue commands to receivers.

**Automations** uses cards and a dialog with When, Actions, Targets & layers, and
Timer & advanced tabs. Preview validates without dispatch. Save follows the
reviewed draft; edits invalidate the review. Run now remains an explicit live
command. Pause/Enable does not delete the record. The specialist device editor
retains compatibility with imported payload options and existing control IDs.

An automation can follow class segments, **timetable blocks**, or clock rules.
Timetable-block selection includes lunch, transitions, assemblies and homeroom;
its occurrence follows the selected block's actual times and skips days where
that block is absent. Choose classes or blocks for one automation, not both.
The resolved day warns about breaks/events with no linked display automation:
without a display action, previous content remains visible.

Clock rules retain weekdays, cycle days, alternating groups and specific dates.
Optional start/end dates, excluded dates and same-day repeats (5–720 minutes)
allow temporary routines. Repeats are clock schedules; class/block routines
follow their segments instead. Weekends/closures/remote suppression keep their
existing scheduler rules. Cross-midnight repeat windows are rejected.

Targets remain explicit. Class default targets are optional; separate action
targets support mixed device types without silently broadening a display rule
to all lighting devices. Existing action IDs, finite repeats, receiver-native
media loops, error policy, announcement priority and occurrence identity remain.

## Timers and display design

Timer overlays support the resolved class/block end, a fixed duration, or an
explicit same-day clock deadline. Use a block end or clock deadline for lunch;
a manual test does not restart a countdown to a fixed deadline. Duration timers
retain their owned deadline during display reconciliation; after restart they
reconstruct the original scheduled start plus duration. An absent override must
never coerce to Unix epoch. Independent transitions do not chain into classes.

For a freely positioned overlay, edit a Screen design action in **Scene studio**.
Add text, uploaded images, shapes or widgets. Drag/resize on the preview, adjust
percent positions, lock layers, reorder, duplicate, undo/redo or nudge with arrow
keys (Shift = 10 logical pixels). Text supports color, bold, italic, underline,
glow and fitted size. Layers support fade, slide, bounce and scroll effects;
scenes support entry transitions. Motion preview starts off and honors reduced
motion. Cancel leaves the action untouched until Use scene / reviewed save.

Widgets include date, clock, class name, cycle/group, countdown, progress and
optional weather. Class/block countdowns use resolved occurrence boundaries.
Clock/duration timer metadata is also supplied to scene countdown widgets.
Weather requires explicit coordinates and sends them only to Open-Meteo's fixed
forecast endpoint. Requests are non-blocking, limited to four seconds / 32 KiB,
and cached for 15 minutes. Disabled weather makes no request. Weather data is a
snapshot refreshed when an automation renders; a long-running untouched screen
marks old weather stale after one hour. It is not an independent live weather
feed. Date/time/countdown/progress widgets update on the receiver each second.

The shared scene model is bounded to 40 layers and 60,000 serialized characters.
Images reference uploaded PNG/JPEG/GIF/WebP/BMP filenames, not URLs, HTML or SVG.
Geometry is normalized inside a 1920×1080 canvas, including rotated bounds.
Receiver scaling uses contain/letterboxing; the editor previews 16:9, 16:10, 4:3,
ultrawide and portrait frames. Images default to contain. Cover intentionally
crops. Text uses the existing `public/display/layout.mjs` fit engine in both the
editor and receiver; no second font-fitting engine or operator CSS is loaded
into physical receivers. Turning auto-fit off is an explicit advanced choice.

## Shared layers

Shared layer rules add an announcement, logo, countdown or information strip
over matching display content without restarting native video. Scope rules by
selected/excluded automations, classes, cycle days, weekdays, date range and daily
time window. Each automation can inherit rules, select a subset, or opt out.
Rules evaluate on display-action dispatch. Save does not dispatch immediately;
preview shows matching automation names. Expired layers remove themselves, and
display clear resets them. At most 12 rules / 80 selected layers can accompany
one action. Morning Announcements remain higher priority.

## Storage, permissions and upgrade

New shared rules and optional weather use SQLite preference
`school.planning.studio.v1`. Classes and automations keep their existing
normalized stores; new windows, block links and scene payloads live in existing
JSON metadata. No replacement of old IDs, credentials, display groups, imported
source snapshots or production-specific configuration is required. No shared
rules are enabled by default. Existing plain actions remain supported.

Planning/month/class routes require `schedule.manage`; automation mutations keep
`automation.manage`. Shared-rule routes require both. Shared-rule preview hashes
include the saved configuration, classes and events. Writes reject stale reviews,
use scheduler mutation limits and remain behind the Full Recovery writer freeze.
Audit entries record rule counts, not image data or coordinates.

The trusted-LAN HTTP upload path uses the existing incremental SHA-256 fallback
when SubtleCrypto is unavailable; chunk and final-file verification remain
mandatory. This fixes the HTTP upload failure without weakening upload integrity
or the separate recovery-passphrase transport boundary.

Upgrade only through the documented guarded updater after required CI and exact
images publish. Back up first. Stop active new-format scenes/shared layers before
rolling back to a version without their renderer, and restore earlier class /
automation preferences from the operational backup if rolling back new timing
rules. Older clients must reload to receive the new shared renderer assets.
Do not deploy development source or restart live classroom services for previews.

## Validation and remaining acceptance

Regression coverage includes scoped temporary schedules, date-only classes,
timetable-bound lunch deadlines, remote/omitted blocks, stale reviews, duration
reconciliation, scene bounds and widget data, optional weather failures, HTTP
chunk hashing, drag/edit/review/save and mobile dialogs. Receiver browser tests
cover multiple resolutions/ratios and ensure shared overlays retain the existing
media DOM/session. Run Linux Node checks and the complete Chromium/Firefox browser
gate. Container builds, dependency/security scans and physical Android/TV tests
remain required before production release. Browser fixtures are not live hardware
or real-weather acceptance.
