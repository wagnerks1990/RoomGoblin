# Class editor save ownership

Baseline: checked main `3978311d9a6c0348db5947c974c98079a16814b8`, alpha.85.
The qualified class and calendar Today changes are integrated on checked main
`dd23fb4491a930b82f6ea17a03a4d5e318df337d` (PR #289). Runtime/tests were retained
unchanged during integration; the sole conflict reconciled audit status text.
Status: deployed and verified in PR #290; see the delivery receipt below.

## RG-CLASS-001: Repeated or uncertain saves created duplicate classes

| Field | Assessment |
| --- | --- |
| Subsystem / category | Classes / Pending writes and draft identity |
| Priority / confidence | P2 / Confirmed in real-browser fixture flows |
| Baseline locations | `public/controller/app.js:975-1013`; `public/controller/class-studio.js:25-26`; create guard `src/server.js:5751` |
| Complexity / compatibility risk | Small / Existing ID normalization and duplicate rejection retained |
| Expected benefit | One intended new class keeps one identity across retries |
| State | Deployed and verified at `955195a` |

Save remained active during a pending POST. Two clicks sent two creates. A lost
response after an accepted create could also be retried without an ID, allocating
another record. New drafts now have one stable ID, retained across recurrence
changes and retries. The blank existing-record field still selects POST; edits
use PUT and preserve the stored ID. The existing server duplicate guard remains
unchanged and the browser directs an uncertain retry to check its earlier save.

The dialog tracks pending saves by draft owner. Its body is inert and Save is
disabled while that owner is pending. Validation/request failures restore editing.
Opening another draft after Close gives that new draft its own owner.

## RG-CLASS-002: An older completion cleared or closed a newer draft

| Field | Assessment |
| --- | --- |
| Subsystem / category | Classes / Async editor completion |
| Priority / confidence | P2 / Confirmed by delayed completion and modal observation |
| Baseline locations | `public/controller/app.js:1012-1013`; `public/controller/class-studio.js:23-26` |
| Complexity / compatibility risk | Small / Accepted writes still finish and refresh inventory |
| Expected benefit | New unsaved work and intentional dialog closure survive an earlier save |
| State | Deployed and verified at `955195a` |

After the request and inventory refresh, Save unconditionally reset the shared
form and its wrapper closed the dialog. Closing the first dialog and opening a
new class before that completion lost the newer work. Even without a new draft,
the completion reopened an intentionally closed dialog before closing it again.

Save now captures its draft owner and only updates/resets that same owner.
Stale errors cannot replace a newer draft's status. Accepted writes still refresh
the inventory. The reset after success explicitly does not open the dialog;
ordinary New actions continue to open and focus it. Close does not cancel an
accepted server write, and no save dispatches device commands.

## Evidence and remaining review

Six tracked browser cases cover repeated admission, stale completion, lost reply
retry, separate IDs across recurrence modes, existing PUT identity and a closed
dialog. Against the exact baseline scripts, five fail and the existing PUT
control passes. Both Chromium and Firefox pass all six with the changes.
Fixture responses model the existing API; no live class records were modified.
Controller syntax/runtime-symbol and Python compilation checks pass.
All 62 workspace Chromium tests pass. Native active-worktree Linux qualification
passes 1,235 tests, zero failures and two root-only ownership skips (1,237 total),
plus all 23 Host Recovery tests. The Linux run includes Node/controller, Python
and tracked Bash syntax checks. Docker, platform qualification and required
security gates remain CI responsibilities; checked integration and CI remain.

Final combined qualification on checked main `dd23fb4` includes Calendar Today
and its range-dialog guard: all 69 workspace Chromium tests pass, alongside
1,235 native Linux passes, zero failures, two root-only skips and 23 Host Recovery
passes. Syntax/controller checks pass. Required CI and delivery passed; see the receipt below.

Calendar Today is included in this combined editor patch. Cross-date/class-end
scheduler semantics remain separate. This patch does not close the unit or the
overall modernization roadmap.

## Delivery receipt

Delivery verified 2026-10-27 UTC at `955195af5a0077e823f075def12440a81db4f141` after all 14 PR checks, checked squash merge, main gates and exact image publication. The normal updater completed at 2026-10-27T11:22:26.120365+00:00. Clean main, the exact Hub revision and served operator assets (including class-studio.js), both service health endpoints, canonical SQLite integrity and eight encrypted secret rows passed. Maintenance retained its verified container at `20f8c501916f34e17bee2c643434e7cce0c919e6`; both containers report zero restarts. Backup `auto-operational-2026-10-27T11-22-12-639Z.zip` is 128607010 bytes, mode 0600, SHA-256 `0a052807c62c7adfa506c53605e7389767555be3428c0c96f11d513ca3eb5d11`; journal checksum, archive CRC, canonical-database-only contents and extracted SQLite integrity passed. Previous deployment `dd23fb4491a930b82f6ea17a03a4d5e318df337d` and its images remain available for rollback. No physical commands, receiver reloads or live class/calendar edits were used.
