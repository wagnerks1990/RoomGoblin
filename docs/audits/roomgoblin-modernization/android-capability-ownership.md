# Android capability cache and card ownership

[Finding classification and immutable source locations](finding-metadata.md#android-capability-ownership).

RG-LAB-036 reproduces four failures: overlapping same-display readers duplicate
transport, replacement enrollment inherits a cached result, retired completion
overwrites a newer cache, and a removed enrollment can still serve cached data.
Independent displays are a passing baseline control.

Each capability cache entry now owns its enrollment/endpoint/Agent configuration
identity and pending promise. Ordinary card redraws share that promise; replacement
identity starts an independent current read. Only the current entry can cache a
reply or evict a failed request. Completed entries expire after 30 monotonic
seconds, and inventory scans prune retired identities. Rendering requires the
same current enrollment and a card still attached to the inventory. Existing
command admission and capability restrictions remain authoritative.

All 12 targeted cases and 37 related cases pass. Supported Linux qualification
passes 2,399 tests with zero failures and two root-only skips, all 23 Host Recovery
cases and syntax/controller/shell checks. Both Chromium and Firefox pass all 126
workspace cases. The new mobile case refreshes a pending read, replaces enrollment,
answers newer then older requests, and verifies retained capabilities, focus and
cache reuse on a subsequent redraw. Its screenshot was inspected without overflow.

These are simulated transport and browser tests. They send no physical device
commands and add no request deadline or cancellation promise. Required CI,
checked merge, exact images and backed-up appliance verification remain separate
delivery gates.
