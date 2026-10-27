# Planning draft ownership

Baseline: checked main `3978311d9a6c0348db5947c974c98079a16814b8`, alpha.85.
The working branch includes the separately qualified automation save follow-up
`d2dc8ab` (PR #288); checked-main integration will be recorded before submission.
Status: implemented and locally qualified; checked-main integration and CI remain.

## RG-PLAN-001: Reload responses overwrote newer drafts

| Field | Assessment |
| --- | --- |
| Subsystem / category | Calendar and timetables / Asynchronous draft ownership |
| Priority / confidence | P2 / Confirmed by held-response browser cases |
| Baseline locations | `public/controller/planning.js:126-144` |
| Complexity / compatibility risk | Small / Browser state only; existing save/revision API retained |
| Expected benefit | New edits and the latest reload retain ownership of the workspace |
| State | Reproduced, implemented and locally qualified |

The dirty check ran only before the GET. A response arriving after an edit
replaced that edit and cleared dirty state. Two concurrent loads also allowed
the older response to replace the newer one. An obsolete failed GET could
replace current status, and a load started during Save could replace its draft
and revision context.

Loads now capture their generation and edit revision before awaiting the GET.
Only the current generation with unchanged edits may adopt the returned plan.
A confirmed reload still discards the draft that existed when requested; edits
made afterward survive. Saves block new loads and invalidate already-pending
loads. Obsolete failures do not replace current status. The existing confirmation,
preview queue, backend preview hash and expected revision remain authoritative.

## RG-PLAN-002: Delayed CSV imports mutated a replacement draft

| Field | Assessment |
| --- | --- |
| Subsystem / category | Calendar import / Local asynchronous file read |
| Priority / confidence | P2 / Confirmed after reloading during a held file read |
| Baseline locations | `public/controller/planning.js:169-181` |
| Complexity / compatibility risk | Small / Existing size, row, date and reference validation retained |
| Expected benefit | A selected file cannot silently replace newer date edits |
| State | Reproduced, implemented and locally qualified |

CSV parsing awaited file text, then accessed whichever draft happened to be
current. A file selected before Reload could therefore add old date overrides
to the replacement draft. Edits made during the read could also be overwritten.

The import captures its draft identity, edit revision and generation. A replaced
or saved draft rejects the older read; newer edits require importing again.
A later file selection supersedes an earlier one, and cleanup only clears the
file input when it still contains that same file. Import remains local until
the existing explicit preview/save workflow commits it.

## Evidence and boundaries

The initial two load probes both reproduced data loss after correcting a fixture
callback-order assumption. The delayed-file probe reproduced an old closure
appearing in the replacement plan. Its first fixture attempt returned a function
from Playwright evaluation and hung; that test process was interrupted, the
fixture was corrected to return normally, and no production process was touched.

Seven tracked browser cases cover the failures, explicit confirmed reload,
obsolete errors, load admission during Save, and a successful import after newer
edits were preserved. Against the exact main script, **six fail and the confirmed
reload control passes**. The corrected code passes all **seven in Chromium and
seven in Firefox**, with no failures or skips. All **56 workspace Chromium tests**,
**35 focused Node tests** and controller/Python checks pass. The native
active-worktree Linux snapshot passed **1,235 tests, zero failures and two
root-only ownership skips** (1,237 total), plus **23 Host Recovery tests** and
Node/controller/Python/Bash checks. Docker/Compose, platform and security checks
remain with required CI; Docker is unavailable locally. Checked-main integration
and required CI remain.
No server API, SQLite schema, saved IDs, scheduler dispatch, device command or
production calendar data is changed by this patch.

Class-editor save ownership has separate reproductions and remains the next
review in this unit. Cross-date/class-end scheduling semantics and calendar Today
date refresh remain under review; the automation editor's Today-only fix does
not establish coverage for the separate calendar control. This is not completion
of the planning unit or the modernization roadmap.
