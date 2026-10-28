# Final modernization integration and acceptance

The audit index maps all 32 requested subsystems to the 17 sequential review
units and their scoped findings. This integration preserves every earlier
finding and intermediate failure in the progress history. It separates source
review, test qualification and production evidence instead of treating them as
interchangeable completion claims.

The [metadata reconciliation](finding-metadata.md) classifies 99 findings across
79 condensed notes. Every cited source range was checked against its immutable
Git file object. Those are repair locations, not invented original-failure
baselines or a claim that every line in each file was audited. Existing detailed
findings retain their original classification and evidence.

## Qualified implementation

The final runtime, workflow and test sources match qualified snapshot `06779f7`;
the remaining differences are Markdown documentation. That snapshot passed
2,581 Node tests, zero failures and two root-only skips (2,583 total), all 23
Host Recovery and 55 Android JVM cases, and Node/controller/Python/Bash checks.
It includes receiver identity, diagnostic evidence, retention authority and
concurrency, publication retries and the shared browser request deadline.

The isolated retention integration passed 2,547 Node cases with zero failures
and two root-only skips, plus the same recovery/JVM checks. Publication policy
passed 31 focused native cases. Request ownership passed 36 focused Node cases,
and all 19 Veyon/request browser cases passed in each of Chromium and Firefox.
The earlier integrated workspace run passed 134 cases per engine. Those browser
counts describe their recorded scopes, not a whole-browser-suite total.

The two root-required content/backup permission cases subsequently passed in an
isolated native WSL checkout as root: two tests, zero failures and zero skips.
They exercised the real installer ownership fragment and streaming ZIP writer
against temporary fixtures, including a reader with a different UID in the
shared group. The ordinary full-run total above retains its original two skips;
this separate result closes their local qualification gap without rewriting it.

Required PR/main CI supplies the complete browser suites, native artifacts,
Compose smoke tests, runtime image builds and vulnerability scans. Local Docker
was unavailable; local Node/native results do not substitute for those gates.
The final delivery receipt must identify the exact checked commit and published
image pair, rather than relying on the unchanged alpha.85 version text.

## Delivery record

[Diagnostics PR #342](diagnostics-delivery.md) is the last standalone verified
deployment. The remaining retention, publication, request and documentation
changes use one final backed-up update. The pull request that merges this final
audit records its current CI and deployment status and, after acceptance, the
exact commit, backup checksum and rollback identity. A merged source commit
alone is not a claim of production delivery.

Acceptance checks clean main, component convergence, control/media/maintenance/
Host Agent health, canonical SQLite and encrypted-secret integrity, database/ADB
modes, authorization boundaries, served assets, native executable manifests and
the persisted Android signing identity. The operational archive must match the
journal checksum, pass ZIP CRC and contain only the canonical SQLite snapshot;
its extracted database must pass quick_check. Retained rollback images must match
the previous component revisions. These checks are read-only after the normal
updater completes; no physical device command is needed for them.

The separately approved Music Assistant update is operational work outside the
repository's managed-image policy. Final acceptance rechecks Apple provider
authentication and preserves the existing external container, data and LAN shim.
Provider availability does not claim an audible playback test.

## Preserved boundaries

Later-loop scheduler phase reconstruction remains an explicitly documented
[compatibility limit](scheduler-recovery-boundary.md). Current-winner recovery,
saved Stop, complete-resource ownership, cross-date class resolution and
announcement/audio priority remain covered by their existing regressions.

Browser timeout means the UI stopped waiting. It neither cancels an accepted
server job nor proves a physical command failed, and it never automatically
replays an uncertain write. Retention preserves new/replaced archives during an
authority read, so concurrent arrivals may temporarily exceed the configured
quota. Publication exhaustion or candidate identity drift remains a visible
failure; validation and exact-image trust are not bypassed.

Physical classroom behavior, optional unconfigured services and a literal
line-by-line audit of every repository file are not asserted by these results.
Full versus targeted review is recorded in each subsystem's evidence. No new
framework, root command surface, compatibility-identifier migration, production
fault injection or site-specific public configuration is introduced.
