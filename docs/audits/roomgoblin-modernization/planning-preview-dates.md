# Planning preview dispatch dates

Baseline: `aced546c91bb18a8b903835752423f292f5fee4f` (PR #291).
The qualified tree is integrated unchanged onto checked main
`407be9eb2ce6495721164cf6dc00a68c2a111bc1`. A complete tree comparison against
`9ae4496` passed before adding this integration and PR #290 delivery receipt.

## RG-PLAN-006: Offset previews displayed the source day as dispatch day

| Field | Assessment |
| --- | --- |
| Subsystem / category | Planning and automation editor / Preview accuracy |
| Priority / confidence | P2 / Reproduced in real Chromium scripts and day resolver |
| Baseline locations | `public/controller/planning.js:227`; `src/planning.js:161` |
| Complexity / compatibility risk | Small / Labels and additive day-offset projection |
| Expected benefit | Show the same dated occurrence the scheduler resolves |
| State | Implemented; final local qualification passed |

A class at 00:30 with a -60 minute offset previewed 23:30 beside the class date,
although dispatch belongs to the previous day. The same problem crossed year
and leap-day boundaries. The editor now shifts the API's source calendar date
using UTC calendar arithmetic, displays the actual dispatch date and retains
the segment's source date when different. Existing stale-response protection,
suppression messages and no-occurrence handling remain intact.

Resolved break/event rows omitted the `dayOffset` already supplied for class
actions. They now derive it from the actual block occurrence's scheduled date
using calendar dates, so the existing row renderer shows the previous/next-day
indicator. This adds a projection field; it does not alter timing, identities,
dispatch, persistence or physical receivers.

The baseline fails all five new block-projection cases. One browser test with
six scenarios reproduces four incorrect cross-date labels while its two same-day
controls pass. Cases include previous day, year rollover, leap day and a daylight
saving boundary. With the patch, all 79 focused Node tests pass. All six scenarios pass in
Chromium and Firefox, and all 70 workspace Chromium tests pass. The five date
projection cases also pass under `America/New_York` and `Pacific/Auckland`.
The final native active-worktree snapshot passes 1,288 tests with zero failures
and two root-only skips (1,290 total), plus all 23 Host Recovery tests and
Node/controller/Python/Bash checks. Required CI, exact
image publication and backed-up appliance delivery remain pending. No live calendar edits or
physical commands were issued. Later-loop phase remains separate scheduler work.

## Verified delivery

PR #292 passed all 14 checks and merged at
`fe8b68a05a966e237f8485f172a2c2e2cfdb436d`. All five main workflows passed,
including exact image publication and Wiki synchronization. The normal update
completed on 2026-10-27 at 12:05:04 UTC. The Hub runs that exact revision with
zero restarts; the unchanged maintenance container remains healthy.

Final verification confirms clean main, healthy control/media/maintenance/Host
Agent, SQLite integrity, all eight encrypted secrets, database and ADB modes,
authorization boundaries, served asset hashes and an empty selective update
plan. The rollback commit `407be9e` and its images remain available.

Operational backup `auto-operational-2026-10-27T12-04-51-449Z.zip` is 128,661,202
bytes, mode 0600, SHA-256
`990694a8a1b79232872cfb25a259aeeda2178733e70ddb473fabfb12956517cf`.
Archive CRC, canonical database-only membership and extracted SQLite integrity
passed. No physical commands, receiver reloads or live calendar edits were used.
