# Reusable special-day schedules

For the rebuilt workflow with native split teaching segments, use
[Planning](PLANNING.md). This page documents the retained earlier compatibility editor.

Unreleased: RoomGoblin can store named special timetables for pep rallies,
assemblies, testing days and other reordered or shortened days. This is source
functionality, not a claim of deployment or physical-device acceptance.

## Operator workflow

1. In **Classes**, configure the classes that automations already reference.
   Keep those class IDs; there is no need to duplicate ordinary automations.
2. Open **Automation → School Calendar Rules → Reusable special-day schedules**.
3. Choose **New timetable**, name it, and check each class that takes place.
   Set its special start/end times. Unchecked classes are omitted on assigned dates.
4. Assign dates as `YYYY-MM-DD`, one per line. Leave dates blank to retain a
   template for future use. A date can belong to only one special timetable.
5. Use the calendar's **Save School Calendar Rules** button to persist the complete
   draft. New/remove/select operations in the template editor do not save by themselves.
6. Inspect the resolved automation times and use **Simulation / Troubleshooting**
   with **Dry run only** for the intended date before relying on the timetable.

Reusing a timetable means selecting it and adding another date. Remove a date to
return that date to normal calendar rules. Removing a template removes its date
assignments when saved. Classes and automations themselves are preserved.

Included classes still obey enabled, weekday, cycle-day, include-date and excluded-date
rules. A timetable changes times; it does not force a class onto a different cycle day
or enable a disabled class. Check both cycle groups if both use the same special times.

Class-linked automations follow special start/end times, including configured offsets
and class-end timer deadlines. Fixed-clock automations retain their clock times;
link them to classes if they should move. Unmapped classes are skipped, including
continuation and transition blocks. Explicitly include every block needed that day.
Normal days continue to use the original class times.

Priority is **No-School → Remote → Special timetable → Half Day → 2-Hour Delay →
1-Hour Delay → Normal**. Special days remain school days in the existing rotation.
Morning Announcements, manual takeover and Background Music priorities are unchanged.
Saving does not dispatch devices or automatically Resume Scheduled State. Schedule
changes made while an occurrence is running do not replace that already-running
occurrence; plan ahead and use the existing pause/simulation/resume controls when
changing the current day.

## Reordered periods and lunch

Enter times against the existing class, rather than renaming periods to match their
chronological order. A day can put Period 4 before Period 3 without changing their IDs.

Lunch variants are classroom-specific. Select the variant appropriate for the room;
do not enable all lunch variants as competing classes on the same target.
A split lunch requires separate before-lunch and after-lunch class blocks, with both
linked to the desired automation. Each block has its own timer and occurrence;
RoomGoblin does not infer lunch breaks inside a single start/end interval.

For special-only blocks (homeroom, assembly, or a split class), create classes with
specific-date scheduling and matching include dates. Add those same dates when
reusing the timetable, so these blocks never appear on ordinary days. Omit the
unsplit regular class on that template. Link both split blocks to the automation
once; do not configure timer continuation across the lunch break.
Configure any desired lunch display as its own class-linked automation; ending a
class occurrence does not promise to clear every display's persistent content.

## Storage and compatibility

`scheduleProfile.specialDaySchedules[]` is stored in the existing SQLite
`school.schedule.profile` preference through the authenticated, `schedule.manage`
protected calendar endpoint. Each template has an `id`, `name`, `dates[]`, and
`classTimes` keyed by stable class ID, each containing `startTime`/`endTime`.
There is no database schema or class/automation identifier migration.

Validation rejects duplicate IDs, ambiguous date assignments, invalid dates,
invalid/reversed/empty time intervals, oversized templates, and assigning an empty
timetable. Existing profiles default to no special timetables; older callers that
omit the field retain it. Existing exception-time JSON retains its behavior.
Limits are 50 templates, 366 dates per template, and 500 class intervals per template.

Special timetable overlaps appear as non-blocking special-day warnings during
automation validation, separately from normal-day blockers, within the existing
90-day diagnostics horizon. Operators must inspect conflicts; templates do not
change resource winner or dispatch priority rules.

Rollback: remove date assignments and save to restore existing calendar resolution.
For a source rollback to a version without this feature, remove assignments first;
older versions cannot apply special timetables. Normal operational backups retain
the profile with the rest of SQLite configuration. No production configuration,
school-specific timetable or date is bundled into defaults.
