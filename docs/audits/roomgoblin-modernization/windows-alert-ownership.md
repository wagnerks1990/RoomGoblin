# Windows alert ownership and hidden captures

Baseline: Windows inventory/monitoring PR #318 head `3d7a50e`.

RG-LAB-005 reproduced five actual-source failures: stale filtered alert replies,
stale filter errors, replies refilling closed alerts, stale summary errors, and
late capture responses scheduling a closed-view refresh. RG-LAB-006 reproduced
capture dispatch while either the browser document or embedded workspace was
hidden.

Alert reads retain their current dialog and request generation, including input
changes before debounce. Closing clears sensitive content and delayed timers.
Summary reads retain independent latest-request ownership. One accepted alert
action blocks further actions until it finishes, invalidates old reads and
reports current failures without replay. Changed/reopened views receive fresh
results without inheriting old action feedback. Captures check document and
embedded visibility before dispatch and before loading image bytes; ordinary
polling resumes on its existing interval without extra timers.

All 24 new Node regressions and 63 focused cases pass. Three new Chromium cases
cover current filters/Escape, failed actions with pending admission, and hidden
screen polling. Before the separate PR review fixes, full qualification passed
2,146 Linux tests with two root-only skips, all 23 Host Recovery tests and 101
browser cases per engine. Final combined qualification with the PR review fixes
passes 2,149 Linux tests, zero failures, two root-only skips, all 23 Host Recovery
tests, syntax/controller checks and 103 browser cases in each engine. All data and transports are
fixtures; no live history, screenshot, classroom action or native service change
was used. Agent enrollment, permissions and retention remain unchanged.

The separate native process review reproduced a child remaining alive after
caller cancellation using the actual extracted process helper and an isolated
local test child. The fixture cleaned up its child; that repair, agent lifecycle
and managed-device review remain open.
