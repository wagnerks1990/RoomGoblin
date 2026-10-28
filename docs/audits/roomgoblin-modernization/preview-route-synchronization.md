# Automation preview route synchronization

[Finding classification and immutable source locations](finding-metadata.md#preview-route-synchronization).

Main `2f795675ef0baac86b99b18253574e8d052a639a` passed its PR gates, but the
subsequent Firefox run failed one of 200 tests: automation obsolete-preview
coverage asserted two held routes while the second request's route callback had
not yet run (job `122585479671`, run `40618174486`, 2026-10-28 UTC). Main image
publication stopped, leaving the appliance on verified `4a41f00` at that point.

The request event and route callback are separate Playwright events. Wait up to
five seconds for the second route to be captured, using the existing bounded
polling pattern, before delivering the deliberately reversed responses. Keep the
exact route count, ready-to-save state, obsolete-failure exclusion and saved-draft
assertions. No product code, required check or assertion is weakened.

The targeted Firefox test and all 70 workspace tests in both Firefox and Chromium
pass. This fixture-only change does not alter the qualified Node/runtime tree.
The correction merged in PR #300. Its exact main gates and images passed, and
the normal backed-up update delivered PRs #299 and #300 together at `336a71d`.
See the [verified receipt](announcement-active-targets.md#verified-combined-appliance-delivery).
