# Calendar current-day navigation

Baseline: locally qualified class-save commit
`86345c06570d5850b795559badea6bf12ed59077`, following checked main `3978311`.
Checked integration uses main `dd23fb4491a930b82f6ea17a03a4d5e318df337d`
(PR #289), combined with the qualified class-save changes. A final range-dialog
ownership case was added during integration and is documented below.

## RG-PLAN-003: Today reused the first loaded date

| Field | Assessment |
| --- | --- |
| Subsystem / category | Planning calendar / Current date and async navigation |
| Priority / confidence | P2 / Confirmed in the real browser fixture |
| Exact baseline locations | `public/controller/planning.js:169-170`; existing date API `src/server.js:5682-5685` |
| Complexity / compatibility risk | Small / Existing authorized read API and draft preview retained |
| Expected benefit | An overnight-open calendar returns to the current appliance date |
| State | Reproduced, implemented and locally qualified |

Today selected `source.today`, captured by the original plan load. A long-lived
tab could return to yesterday even when the appliance scheduler had advanced.
It now reads the existing Planning day endpoint without a date argument. The
server resolves the current scheduler date, including configured time zone and
test-clock behavior; browser local time is not substituted.

Only the latest lookup for the same draft may select its returned valid date.
Manual date input, month/grid navigation, opening the range dialog, edits, adopted reloads and Save
invalidate it. Late errors do not replace newer work or status. Today does not
change the draft or reload saved settings. It leaves save control ownership
untouched, so a finishing lookup cannot unlock a pending write or strand Today
disabled after Save. A current read failure preserves the selection and permits
retry. Existing schedule permissions and backend validation are unchanged.

## Evidence and remaining scope

All six new Chromium cases fail against the unchanged baseline. With the patch,
all six pass in Chromium and Firefox: fresh date with dirty draft retained,
later manual selection, edits/obsolete errors, failure/retry, out-of-order reads
and pending Save ownership. All 68 workspace Chromium tests pass. Native
active-worktree Linux qualification passes 1,235 tests, zero failures and two
root-only ownership skips (1,237 total), plus 23 Host Recovery tests, controller
validation and Python/Bash syntax checks. This combined snapshot includes the
qualified class-save changes. Required CI remains; CI
owns Docker, platform, security and exact image publication checks.

The final range-dialog case reproduced one additional race in the initial fix:
a pending Today reply could change the background date/status/note after opening
the date-range dialog. Opening that dialog now invalidates the lookup. The
combined checked-main qualification, including this case, passes all 69 workspace
Chromium tests, all seven focused Today cases in Chromium and Firefox, and
1,235 native Linux tests, zero failures, two root-only skips (1,237 total), plus
23 Host Recovery tests and Node/controller/Python/Bash checks.

No live calendar edits, physical commands, receiver reloads or fault injection
were used. Cross-date/class-end scheduler semantics remain under review. This
patch does not close the planning unit or the complete modernization roadmap.
