# Veyon information-dialog ownership

Baseline: qualified inventory repair `bc1c5c5`.

RG-LAB-002 reproduced a late feature reply overwriting another computer's details
and a late error refilling a closed dialog. Catalog and connection-pool reads now
retain the dialog generation that accepted them. Closing or replacing the dialog
invalidates old replies and old pool-action handlers.

An accepted pool-close request remains tracked, but its completion cannot close
a newer dialog or replace its feedback. The button admits one pending close and
preserves explicit confirmation; current errors permit an explicit retry. The
existing inventory refresh still follows successful connection cleanup. Classroom
feature jobs, credentials, preview authentication and keyboard focus handling are
unchanged.

All 12 new regressions and 37 focused Node cases pass. Two real-page Chromium
cases pass for Escape/focus with a stale catalog response and a pending pool-close
completion after another dialog opens. Full qualification passes 2,090 Linux
tests, zero failures and two root-only skips (2,092 total), plus all 23 Host
Recovery tests and syntax/controller checks. All 83 workspace and nine Veyon
command-page tests pass in both Chromium and Firefox. Required CI and delivery
remain pending. All transports use fixtures; no physical discovery, connection cleanup
or classroom commands were performed.
