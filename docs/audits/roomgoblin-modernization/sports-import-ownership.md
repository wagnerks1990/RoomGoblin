# Sports import review ownership

[Finding classification and immutable source locations](finding-metadata.md#sports-import-ownership).

RG-SPORTS-004 reproduces six browser failures: a roster read accepts changed team
context or changed CSV input, a hidden review survives a tab redraw, changed event
text can apply an old review, a workspace import replaces newer edits, and a
pending read remains available for duplicate submission.

Imports now capture the originating draft, view and submitted text/file. A retired
response cannot populate review or replace the workspace. Apply verifies the same
ownership again. Roster reviews live in their visible view, input changes clear
review, and each read remains disabled until completion or failure. CSV, PDF and
workspace imports still require review and an explicit save; they issue no display
commands. Existing capability gates remain in place.

All 28 Sports browser cases pass in Chromium and Firefox, including controls for
current CSV/PDF application, unchanged workspace imports and changed PDF identity.
The supported Linux snapshot passes 2,438 tests, zero failures, two expected
root-only skips, all 23 Host Recovery cases and all 55 JVM cases, plus
syntax/controller/shell checks. Atomic save/undo
persistence and preview-cache ownership remain separate Sports review items.
