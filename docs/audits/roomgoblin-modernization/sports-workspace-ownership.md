# Sports workspace save and scene ownership

[Finding classification and immutable source locations](finding-metadata.md#sports-workspace-ownership).

RG-SPORTS-002 reproduces four browser failures: newer draft edits disappear after
a save response, an edit/tab redraw re-enables a pending save, and delayed scene
responses dispatch after either an edit or leaving the originating board view.
A failed-save preservation case passes before and after repair.

A pending save now owns admission and disabled state across redraws. Completion
replaces only its unchanged originating draft; newer edits retain their fields
and receive the acknowledged server revision for a subsequent checked save.
Retired workspace objects are not replaced. Failure retains the draft and releases
retry. Scene requests capture their draft and view, reject overlapping generation,
and verify ownership before rendering, scheduling or sending.

All 15 Sports browser cases pass in Chromium and Firefox. Existing receiver
playback/roster continuity, explicit targets, read/control-only profiles and
source-status recovery remain covered. The final supported Linux snapshot passes
2,438 tests, zero failures, two expected root-only skips, all 23 Host Recovery
cases and all 55 JVM cases, plus syntax/controller/shell checks. Fixtures issue no
physical commands. Source refresh/undo/import response
ownership and remaining Sports review continue separately.
