# Android inventory and status ownership

RG-LAB-028 reproduces six inventory queue/volatile-state failures, six stale
status/agent-probe failures and three recovery failures on the reviewed source.
An older inventory read could replace a newer result, mark a healthy bridge
unavailable or restore an obsolete recovery flag. Late background probes could
redraw replaced cards and lose focus. Recovery completion/failure could clear
only a detached record, leaving the current card recovering indefinitely.

Inventory reads now serialize and coalesce overlapping requests into a fresh
read. Superseded replies cannot render or change bridge health. Inventory applies
current volatile state at completion, and background status/agent probes honor
its generation. Recovery resolves the current display before applying success
or clearing failure; a removed display is never recreated. The dedicated agent
status endpoint and existing recovery admission remain intact. No remote work
is cancelled or automatically repeated by this change.

All 16 targeted cases and three browser scenarios pass. The browser probe test
initially inspected its route list before the fixture callback ran; waiting for
the next browser paint corrected that setup. All 116 workspace cases pass in
Chromium and Firefox. The first full Linux run found an outdated source-pattern
assertion requiring inline inventory assignment; it now recognizes the shared
apply helper, while the behavioral degraded-inventory case verifies its result.
The final full Linux run passes 2,296 tests with zero failures and two root-only
skips, all 23 Host Recovery cases and syntax/controller/shell checks. No physical
display or enrollment was changed.
