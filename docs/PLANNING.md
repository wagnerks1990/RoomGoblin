# Planning: school calendar, cycle days and timetables

Unreleased. These changes require review, CI and physical acceptance before
production use. They do not import a real school's calendar or alter the live
appliance.

## Workspace

Planning has connected Calendar & Timetables, Classes, and Automations views.
Existing class/automation page IDs, handlers and device sessions remain intact.
Planning navigation requires `schedule.manage`; Automations also requires
`automation.manage`. Backend permissions remain authoritative.

Calendar & Timetables has three focused views:

- **Calendar** selects a date, school status, cycle override and timetable. The
  resolved day lists class segments, class-linked automation times, fixed-clock
  events and overlap warnings. The month picker shows configured date overrides.
- **Timetables** creates reusable sets of teaching, lunch/break and event blocks.
  Choose a regular timetable or keep existing class times. Assign other timetables
  to specific dates. Times determine chronological order; the editor can swap a
  block with the prior time slot. Duplicate a regular template for a special day.
- **School year & rotation** configures the year, weekdays, anchor, cycle sequence,
  named day groups and period membership using labeled controls.

Class editing emphasizes identity and period membership. Fallback times and
timer continuation remain available in a disclosure. Automations retain their
canonical action sequence, with When, Actions & targets, and Timer overlay
sections. Linked-class previews can resolve a selected date from the saved plan.

## Cycle model

Cycle letters and day colors are separate concepts. The explicit optional preset is:

| Cycle | Group | Regular periods | Bison periods |
| --- | --- | --- | --- |
| A | Green | 1, 2, 3, 4 | — |
| B | White | 5, 6, 7 | 1, 2 |
| C | Green | 1, 2, 3, 4 | — |
| D | White | 5, 6, 7 | 3, 4 |
| E | Green | 1, 2, 3, 4 | — |
| F | White | 5, 6, 7 | 5, 6 |
| G | Green | 1, 2, 3, 4 | — |
| H | White | 5, 6, 7 | 7, 8 |

The preset is a draft action, never a startup migration or replacement for site
configuration. Bison periods use existing `BISON-1` through `BISON-8` compatibility
keys. The anchor represents the first letter in the configured cycle sequence.
Groups, sequence and membership remain configurable.

No-school dates do not advance calculated rotation. Remote days do advance it,
while scheduled classroom device actions remain suppressed. Date-specific cycle
overrides apply only to that date and do not become new anchors. An official
calendar imported with explicit cycle letters therefore retains those letters
when a nearby closure changes the calculated sequence. To move the calculated
sequence, change school status or the anchor and review subsequent dates.

Year bounds and weekdays define ordinary school dates. Explicit date overrides
can reopen a weekend/closure or establish a makeup school day outside the year.
Dates queried through Planning must be within ten years of the anchor.

## Automatic import on upgrade

Planning saves use one outer SQLite transaction for profile and class membership.
Nested normalized writers use SQLite savepoints, so an inner failure rolls back
its work and an outer failure still rolls back the complete save. Failed saves
leave the live profile/classes unchanged and can be retried with a fresh preview.

On first Hub startup with this feature, RoomGoblin imports existing configuration
from authoritative SQLite state after legacy file reconciliation and class loading.
No separate export, upload or manual recreation is required.

The import preserves the actual cycle sequence, anchor, group names, period mapping,
continuation policy, class IDs and default display targets. It creates a regular
class-specific timetable, reusable exception timetables, existing special-day
patterns and date overrides for closures, remote days, half days and delays. Timing
is copied by stable class ID: a teaching class and a transition sharing a period
remain separate. Weekly opening/closing entries, disabled/custom classes and Bison
continuations are retained. Automation records, sequence settings, timer overlays,
selected targets, scheduler enabled/paused state and legacy calendar storage are
not rewritten. The Green/White preset is never substituted for saved configuration.

Imported Planning remains off so the update preserves existing scheduler behavior,
including weekend/weekly actions. The workspace is populated automatically; preview
and enable the new resolver separately when ready. Already configured Planning is
left alone, even when its resolver is off. Restarting or updating again never
recreates imported templates or overwrites later operator edits.

Import uses one SQLite transaction for the original profile/calendar snapshot,
converted profile and versioned completion record. The snapshot is retained in
`school.planning.import.v1.original`; the report is `school.planning.import.v1`.
No classes, automation records, credentials, runtime files or device state are
modified. A write failure rolls back the entire import and retains the original
in-memory scheduler; a later startup retries. Invalid/oversized source configuration
is left unchanged with a bounded review-required report, rather than a partial
conversion. Empty patterns with no class intervals remain in compatibility
settings. Fresh empty installations do not invent dates or import markers.

The Planning workspace displays import status and counts. `GET /api/v1/planning`
returns bounded report metadata, never the original snapshot. The snapshot stays
in the existing private SQLite store and normal backups; the updater's operational
backup/database rollback remains the primary way to restore a previous deployment.
No production upgrade or live database migration is implied by repository tests.

## Initial setup and reuse

1. Open Planning → Calendar & Timetables → School year & rotation. Inspect the
   existing configuration, optionally apply the A–H preset, and set the real
   school-year dates and cycle anchor.
2. Configure Classes with stable periods and cycle membership. Create each
   logical class once. Keep existing display targets and automation links.
3. In Timetables, **Copy existing class times** makes a reversible starting
   template with explicit class selections. Alternatively create a timetable by
   period. Set its regular/default status deliberately.
4. Duplicate the template for a delay, rally, testing day or other special pattern.
   Change period selections and/or times. Multiple teaching blocks can refer to
   the same class/period. Omitted classes do not occur on that timetable.
5. In Calendar, choose the date, school status and timetable, then **Add / update
   date in draft**. Use normal rules removes that date's override.
6. Set the new resolver to **On**, preview, review warnings and the next 14 days
   of changes from the selected date, and **Save reviewed plan**. Preview other
   affected dates separately when changes extend beyond that window.

Reusing a special timetable requires assigning it to another date. Regular dates
use the default timetable; if none is selected, existing class times remain the
fallback. Earlier half-day/delay/special-day rules still apply unless that date
explicitly selects a new timetable. Closure and remote suppression always apply
before classroom dispatch.

Drafts survive navigation. Reload saved plan explicitly discards a dirty draft
after confirmation. Edits made while Reload is loading are preserved; an older
reload response or error cannot replace a newer one. Saves retain exclusive
ownership of their draft and revision while pending. A CSV file still loading
when the draft is reloaded, saved or edited cannot modify that newer draft;
select the file again to apply it after review.
Calendar **Today** reads the appliance's current scheduler date each time,
including its configured time zone and test-clock date. It preserves the draft
and does not reload saved settings. A later edit, date selection, reload or Save
invalidates the pending lookup. Failed lookups keep the selected date and show
an error; use Today again to retry.
Preview and save never issue device commands, resume the
scheduler, or restart running occurrences. Already-running occurrences keep their
resolved boundaries; use the existing Pause/Resume Scheduled State controls
deliberately when changing today's plan. Announcement priority is unchanged.

## Split lunch and events

For a split class, add its first teaching segment, a lunch/break block, and its
second teaching segment. The two teaching segments share the same period and,
when selected, the same specific class. A specific-class selection overrides
generic period blocks for that class; do not mix those two policies for its
segments. Each segment gets its own class-start/end automation occurrence and
timer deadline. No duplicate class or automation records are needed. The class
is inactive during lunch; content persistence still follows existing display
rules. Ending a segment does not automatically clear a display.

Break and event blocks describe the timetable; they do not dispatch actions by
themselves. Use the existing class-linked or fixed-time automation controls for
lunch/assembly content, lighting and other device actions. Fixed-clock events
retain their configured clock times. There is no new arbitrary event-command API.

Classes still respect enabled flags, explicit excluded/include dates, weekday,
cycle and day-group constraints. A selected timetable does not force an otherwise
ineligible class onto that day. Reopening a school date does not bypass a class's
own weekday constraints for weekly classes.

## Calendar import

CSV imports stage changes locally, with no remote calendar fetch or automatic
publication. File limit: 256 KiB and 2000 rows. Exact header:

```csv
date,status,cycleDay,timetableId,note
2027-10-18,school,A,,Example published cycle
2027-10-19,no-school,,,Example closure
2027-10-20,remote,C,,Example remote day
```

These are illustrative dates, not a real calendar. Status is `school`,
`no-school`, or `remote`. Cycle and timetable are optional; a timetable reference
must already exist. Quoted CSV fields are supported. Duplicate/invalid dates,
unknown cycle letters and unknown timetable references are rejected before any
row is staged. Existing overrides for imported dates are replaced in the draft;
other dates remain intact. Inspect the import count, preview, and save.

PDF, image, ICS and calendar-provider synchronization are not implemented. Review
the actual school calendar and prepare CSV; do not infer district dates from this
repository's generic defaults.

## Storage, APIs and migration

The existing SQLite `school.schedule.profile` preference contains versioned
`planning`: enabled flag, optional year bounds, weekdays, timetable definitions,
regular timetable ID, and date overrides. Limits are 50 timetables, 200 blocks per
timetable and 2000 date overrides. Validation checks IDs, dates, cycle references,
clock intervals, removed references, and overlapping same-class segments.
Old records are imported automatically with Planning off; existing native Planning
is preserved. No identifiers or database schema change.

- `GET /api/v1/planning`: saved profile, current calendar, class inventory, optional
  cycle preset and appliance-local current date.
- `GET /api/v1/planning/day?date=YYYY-MM-DD`: saved resolved day; no dispatch.
- `POST /api/v1/planning/preview`: validate a draft profile and date, return the
  day, 14-day changes, current revision and a preview hash; no writes.
- `PUT /api/v1/planning`: require the preview hash and expected profile revision;
  atomically commit profile and compatible class-membership adjustments.

All routes require `schedule.manage` and share existing scheduler limits. Preview
hashes include saved calendar, classes and automations; stale saves return 409.
No credentials or device payloads enter audit logs. Existing application writer
freeze middleware protects these mutations during Full Recovery Export.

When a period mapping changes, classes whose cycle list exactly matched the old
mapping follow the new mapping. Explicit custom selections remain unchanged.
Recognized old group labels are adjusted to the new group containing that class's
cycle selection. Preview resolves those same adjusted records. Class and
automation IDs, targets, credentials, legacy fallback times and compatibility
stores are retained. This migration is part of the same SQLite transaction.

The existing scheduler uses the same segment resolver for active/next class,
class-linked automation occurrences and class conflicts. Occurrence identity
retains class ID plus resolved date/time, so two lunch-separated starts are
distinct and restart recovery remains governed by existing winner policies.
Legacy paths remain available while Planning is off.

## Rollback and validation

Turn Planning off, preview and save to return to legacy timing/calendar behavior.
Remove date overrides or clear the regular timetable to restore individual
fallback behavior. To undo an explicitly applied cycle/membership change, restore
the previous profile and class configuration from the normal operational backup;
turning Planning off alone does not reverse those saved membership edits.
Turn it off before rolling back source to a version that cannot read this model.

Required regression coverage includes all eight cycle/Bison combinations,
closures/remote days, date overrides, year bounds, split segments and deadlines,
normal-day restoration, stale-save refusal, transaction failure, membership
preservation, calendar import, capabilities, draft preservation and mobile layout.
Run the standard Linux validation and Chromium/Firefox operator browser gate.
Docker/image, security and physical-appliance acceptance remain separate checks.

## Planning and Scene Studio

See [Planning and Scene Studio](PLANNING-STUDIO.md) for focused editors, temporary schedules, timetable-bound break actions, shared overlays, widgets and receiver fitting. These additions retain the reviewed Planning import and existing identities.
