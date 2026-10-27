# Automation editor save ownership

Baseline: `84d981be83cfe9cb9dd11970cd16644f290c4ab4` (PR #287 date/preview patch,
based on checked main `065e32e`), alpha.85. Final integration uses checked main
`3978311d9a6c0348db5947c974c98079a16814b8`; its tree is identical to the qualified
PR #287 head. Owned work was preserved and applied without conflicts.
Status: implemented and locally qualified on checked main; required CI and
delivery remain.

## RG-AUTO-EDIT-003: Repeated or uncertain create requests duplicated routines

| Field | Assessment |
| --- | --- |
| Subsystem / category | Automation editor / Mutation ownership and retry identity |
| Priority / confidence | P2 / Confirmed by two browser reproductions |
| Baseline locations | `public/controller/automation-studio.js:70,130`; `src/server.js:6136-6143` |
| Complexity / compatibility risk | Small / Uses existing caller-supplied ID and duplicate-ID guard |
| Expected benefit | One intended new routine retains one identity across save retries |
| State | Reproduced, implemented and locally qualified |

A pending create disabled Save but left Preview active. Another preview enabled
Save and dispatched a second POST while the first was outstanding. Separately,
a create whose accepted response was lost could be retried without an ID; each
POST could acquire a new server-generated ID. Both reproductions failed against
the exact baseline script: two requests or two logical records instead of one.

New dialogs now allocate one draft ID, retained across previews and retries.
Creation still uses POST; existing records keep their IDs and use PUT. A duplicate
opens a distinct new draft. Existing backend normalization, conflict checks and
the synchronous duplicate-ID rejection remain unchanged. A duplicate-ID response
instructs the operator to close/reload and check the earlier save; it does not
claim success, silently overwrite a record or retry automatically.

## RG-AUTO-EDIT-004: Editor mutations did not hold exclusive dialog ownership

| Field | Assessment |
| --- | --- |
| Subsystem / category | Automation/shared-layer editors / Pending mutation controls |
| Priority / confidence | P2 / Confirmed with held-response browser cases |
| Baseline locations | `public/controller/automation-studio.js:130,134,198,200` |
| Complexity / compatibility risk | Small / Existing confirmations, preview hashes and APIs retained |
| Expected benefit | Pending writes cannot overlap through controls in the same dialog |
| State | Reproduced, implemented and locally qualified |

Shared-layer Save admitted another PUT immediately. Automation Delete left a
previously reviewed Save available while deletion was pending, and retained that
review after an error. Both cases failed against the unchanged baseline after
the fixture's default confirmation dismiss handler was explicitly removed.
The initial double-handler fixture error is not counted as a product regression.

Automation and shared-layer Save/Delete/Remove now hold dialog-local mutation
ownership, disable footer actions and make the draft body inert with a busy
state. Preview generations advance when a mutation starts, so pending preview
responses cannot release that ownership. Failures restore editing while requiring
a fresh review. Close remains available; closing does not cancel an accepted
server write. This is a per-dialog boundary, not a cross-user transaction lock.

## Evidence and remaining work

Seven executable browser cases cover pending saves, accepted-create/lost-response
retry identity, separate new drafts, existing PUT versus duplicate POST,
shared-layer hash/identity preservation, deletion admission and a late date lookup
during deletion. The four original defect cases fail against the exact baseline
script. The six initial focused Chromium cases and the additional date/deletion
case pass, as do all seven cases in Firefox and all **49 workspace Chromium tests**.
The first Firefox retry fixture observed the request before its route callback;
the corrected fixture handles and awaits the response explicitly.
All **37 focused Node tests** and controller/Python checks pass.
Transport fixtures model the existing API responses; no production data or
physical devices were modified. The first native snapshot passed **1,235 tests,
zero failures and two root-only ownership skips** (1,237 total), plus **23 Host
Recovery tests**. The final native snapshot includes the late date/deletion guard
and passed the same **1,235 / 0 / 2** counts, plus **23 Host Recovery tests** and
Node/controller/Python/Bash checks. Docker/Compose, platform and security checks
remain with required CI because Docker is unavailable locally. This does not
close the whole scheduler/editor review.
