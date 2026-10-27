# Class offsets, recovery and timer dates

Baseline: locally qualified editor commit
`511f9d0fea971dba1972f03146121645fb2d203a`. Its scheduler source is unchanged
from checked main `3978311`. The qualified patch and companion identity fixes
are integrated unchanged onto checked main `955195a` after PR #290.

## RG-SCHED-027: Recovery lost valid class offsets across dates

| Field | Assessment |
| --- | --- |
| Subsystem / category | Planning and scheduler / Occurrence date resolution |
| Priority / confidence | P1 / Reproduced with actual selectors and occurrence resolution |
| Baseline locations | `src/server.js:974-997,5785-5801,5872-5883,5914-5924,8691-8707` |
| Complexity / compatibility risk | Medium / Shares the existing live-tick resolution policy |
| Expected benefit | Recover the same applicable preparation actions the live tick can start |
| State | Implemented; focused qualification passed |

The tick searched neighboring source dates, but diagnostics and recovery resolved
only the current date. A Tuesday 00:30 class scheduled 60 minutes early could run
Monday at 23:30, then disappear after restart. Recovery also rechecked the source
class's weekdays against dispatch day and barred pre-class display/continuous
recovery even for same-day negative offsets.

One shared scheduled-occurrence resolver now retains the existing bounded
neighbor-date search and exact scheduled-date filter. Diagnostics, live tick,
display/non-display winner selection and continuous recovery use it. Resolved
source eligibility is retained while current school suppression remains enforced.
Pre-class recovery starts at the offset time; the existing class-end stop remains.
No ledger identity, stored rule, cancellation or priority policy changes.

## RG-SCHED-028: Recovery projected actions the class cutoff would prevent

| Field | Assessment |
| --- | --- |
| Subsystem / category | TV and lighting state recovery / Class-end eligibility |
| Priority / confidence | P1 / Actual runner and selector disagree in fixtures |
| Baseline locations | `src/server.js:1863-1867,5796-5821` |
| Complexity / compatibility risk | Small / Preserves already-due state after class end |
| Expected benefit | Do not apply a never-eligible late action during restart/Resume |
| State | Implemented; focused qualification passed |

The normal runner stops at class end. Recovery could nevertheless project a
positive offset after that end, or a later first-pass action beyond a preceding
dwell/pre-delay. It now excludes such starts and projected actions. A prior
action that was due before class end remains eligible as persistent state. The
full-scope ownership view remains conservative for pending continuous runs.
Later loop phase and adapter execution latency are still explicit projection
limits; this patch does not claim to reconstruct their history.

## RG-SCHED-029: Timers used dispatch day instead of the resolved class date

| Field | Assessment |
| --- | --- |
| Subsystem / category | Class timers / Source-date deadline and continuation |
| Priority / confidence | P2 / Reproduced in real single-action and overlay handlers |
| Baseline locations | `src/server.js:1565-1572,1671-1727,1769-1777,2656-2663` |
| Complexity / compatibility risk | Small / Resolved private occurrence metadata only |
| Expected benefit | Keep next-day class/block deadlines and deliberate continuations |
| State | Implemented; focused qualification passed |

Pre-midnight class timers rejected a next-day class; block timers could fall back
to an already-ended deadline on the dispatch date. The resolved class start now
supplies the reference date for class eligibility, deadline and continuation
selection. Unresolved timers still validate against their current date. Tests
preserve same-day behavior, explicit continuation only and terminal blocks.

## Evidence and remaining scope

The final 19-case suite passes five controls and fails 14 cases against the exact
baseline server source. All 19 pass with the patch. The expanded focused suite
passes 303 tests with zero failures/skips. Four earlier VM fixtures now load the
actual shared resolver, and the timer fixture loads the actual reference-date
helper; behavioral assertions were retained. One source assertion follows the
new guarded call. An intermediate broad run had 228 passes and 23 failures: 22
missing-helper fixture failures and one existing Windows-only POSIX mode check.
The mode assertion remains unchanged and is included in native qualification.

Native active-worktree qualification passes 1,254 tests, zero failures and two
root-only ownership skips (1,256 total), plus all 23 Host Recovery tests and
Node/controller/Python/Bash checks. This patch is retained unchanged on the
qualified PR #290 editor head `c0c36c9`; the only integration conflict reconciled
the audit status text. Final integration onto checked main `955195a` preserved
the qualified source and tests exactly. Required CI, image publication and
backed-up delivery remain pending. No physical command,
receiver reload, live calendar edit or production fault injection was used.

The companion [block identity and class-reference patch](planning-block-identities.md)
addresses RG-PLAN-004/005, including missing-class validation on Planning preview
and save. Offset dates in operator previews remain under review. Later-loop
phase remains a scheduler follow-up. The overall roadmap is not complete.

Delivery through PR #291 is verified at `407be9e`; see the [shared runtime receipt](planning-block-identities.md).
