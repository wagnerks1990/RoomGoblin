# Sports source status identity

[Finding classification and immutable source locations](finding-metadata.md#sports-source-identity).

RG-SPORTS-001 reproduces nine failures in service and loopback HTTP tests. Changed
URLs, sport/category/level/season mappings and removed sources exposed retired
status before refresh; late work and restart could also expose it. Save/undo
responses omitted the snapshot needed to refresh the operator's source health.

Status reads now compare the existing persisted fingerprint with current mappings.
Refresh results and fair-queue ordering use the same identity check. Save/undo
responses include current source status. Friendly-name edits preserve valid
history; refresh admission, bounds, saved results and source authorization stay
unchanged. Retired persisted status cannot become current merely after restart.

All ten new cases and 31 related Sports cases pass, including real loopback save
and undo responses. The supported Linux snapshot passes 2,438 tests, zero
failures, two root-only skips, all 23 Host Recovery cases and all 55 JVM cases,
plus syntax/controller/shell checks. Existing Sports browser cases pass 10 per
engine. Fixtures use
fictional in-memory source data and do not contact providers or school systems.
Sports workspace asynchronous draft/preview ownership and remaining review remain
open.
