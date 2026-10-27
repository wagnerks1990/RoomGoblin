# Planning preview dispatch dates

Baseline: `aced546c91bb18a8b903835752423f292f5fee4f` (PR #291).

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
Node/controller/Python/Bash checks. Checked integration, required CI, exact
image publication and backed-up appliance delivery remain pending. No live calendar edits or
physical commands were issued. Later-loop phase remains separate scheduler work.
