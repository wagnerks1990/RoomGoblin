# Lighting configuration write ordering

Baseline: PR #312 head `98595a6`.

RG-LIGHTS-005 has three actual-source reproductions: overlapping discovery
preferences persisted an earlier choice last; overlapping device saves persisted
the earlier name last; a pre-cleanup inventory response restored a removed device
in the controller. The baseline failed all three cases, including after the read
fixture was refined to allow fresh subsequent requests.

Configuration API writes now share a controller-local queue, with values captured
at acceptance. The queue covers metadata, automatic enrollment and reconciliation
and releases after failure. Refresh is outside the write queue, avoiding a wait
on its own completion. A configuration revision prevents older inventory replies
from publishing; reads admitted during writes wait for the accepted queue first.

Discovery checkbox drafts retain the latest accepted choice. Configuration
feedback uses the existing action-message owner, so late outcomes cannot erase a
newer physical command error. Save/cleanup success with refresh failure is stated
separately. Failed writes are not automatically retried. This is per-controller
ordering, not cross-browser or database transaction isolation.

Seventeen new Node regressions and all 28 existing ownership/workspace cases pass.
An older failed-save fixture initially held its newly required fresh GET forever;
the fixture now resolves that read and retains its error/draft assertions, adding
an assertion for the fresh inventory. All five focused Chromium lighting cases
pass, including two new actual-page cases for queued checkbox state and cleanup
read ownership. Final supported Linux qualification passes 1,936 tests, zero
failures and two root-only skips (1,938 total), plus all 23 Host Recovery tests
and Node/controller/Python/Bash checks. All 80 workspace cases pass in Chromium
(89.123 seconds) and Firefox (119.008 seconds). Required CI remains pending.

No physical lighting or production fault injection was used. Backend registry
persistence/device identity and ESPHome remain under review. This follow-up's
checked delivery follows PR #312.

This retains the controller's existing fetch lifetime. Shared browser API request
budgets remain part of the backend/API review; this queue does not claim that a
browser disconnect or timeout cancels a server-side write.
