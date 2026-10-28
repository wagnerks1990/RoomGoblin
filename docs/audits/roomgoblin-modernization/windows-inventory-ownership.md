# Windows lab inventory ownership and focus

Baseline: qualified Veyon dialog repair `43d2645`.

RG-LAB-003 reproduced four actual-source failures: overlapping polls, failed
reads clearing visible inventory, pre-edit responses restoring old names, and
pre-edit failures wiping the post-save view. A real-page browser reproduction
also confirmed that routine polling dropped keyboard focus.

Inventory reads now coalesce and use a metadata revision. Name/group changes
execute in accepted order, with at most 16 queued operations and captured input.
Old replies are discarded, failures release the next save without replay, and a
fresh inventory follows accepted changes. Failed reads show explicit stale or
unavailable feedback while retaining the last successful inventory. Stable
control markers restore focus after redraws alongside existing selection,
filters and open device details.

All 12 new regressions and 19 focused Node cases pass. All three new Chromium
cases pass for focus, failed reads with hidden selections, and post-edit refresh.
Full qualification passes 2,102 Linux tests, zero failures and two root-only
skips (2,104 total), plus all 23 Host Recovery tests and syntax/controller checks.
All 86 workspace and nine Veyon command-page cases pass in each browser.
Required CI and delivery remain pending. Agent credentials,
enrollment, command dispatch, screenshot/history permissions and retention are
unchanged. All API transports are fixtures; no live agent or classroom action
was performed. Other Windows monitoring and managed-display review remains open.
