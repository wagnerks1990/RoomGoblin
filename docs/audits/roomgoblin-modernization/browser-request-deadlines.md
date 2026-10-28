# Operator request deadlines

[Finding classification and immutable source locations](finding-metadata.md#browser-request-deadlines).

RG-PERF-REQUEST-001 closes the browser-request follow-up from the Ubuntu inventory
review. Controller, Veyon, Android and Ubuntu API wrappers could wait forever either
before response headers or while reading the body, retaining pending UI ownership.
All eight stalled-header/body probes fail against the preceding committed wrappers.

The shared request owner covers fetch and body consumption with one deadline,
keeps caller cancellation active, and removes timers/listeners on every outcome.
It rejects even a retired transport promise that ignores abort, so late success
cannot replace the timeout. Interrupted writes are never automatically replayed.
Existing authentication handling, Android lifecycle error payloads, Ubuntu
inventory generations and post-write read reconciliation remain intact.

Read and Ubuntu budgets are one minute; ordinary mutations and Android management
allow ten minutes. Maintenance mutations and long backup/diagnostic reads allow
45 minutes: the existing archive path alone has two sequential 15-minute stages
plus finalization, and must not inherit a routine short read timeout. These are
browser wait limits, not a claim that server work was cancelled. Durable install,
maintenance and recovery jobs retain server ownership. Uncertain outcomes require
status inspection before any operator retry. Explicit caller aborts remain earlier
limits. Direct downloads, media uploads and physical receiver traffic are unchanged.

The initial three-wrapper batch passes 29 focused Node cases, including a real HTTP stalled-body socket abort,
caller cancellation, listener/timer cleanup, unconfirmed writes and compatibility
with inventory ownership. Four actual browser regressions pass in each of
Chromium and Firefox: controller late success, Ubuntu command admission, stale
inventory preservation and Android enrollment draft/credential handling.
The first browser fixture incorrectly declared ADB unavailable; that admission
correctly blocked enrollment. The fixture now models available ADB and disposes
held responses after checking retirement. That combined snapshot passes 2,565
Node tests, zero failures and two root-only skips, all 23 Host Recovery and
55 Android JVM cases, plus 134 workspace cases in each browser. Follow-up review
found the same two stalls in Veyon's separate wrapper. It now shares the same
owner while preserving existing shorter command/poll aborts. Veyon's final
combined qualification passes all 36 focused Node cases, all 19 Veyon/request
browser cases in each engine, and the full supported Linux snapshot: 2,572 Node
passes, zero failures, two root-only skips (2,574 total), all 23 Host Recovery and
55 Android JVM cases, plus Node/controller/Python/Bash checks. This development
snapshot includes the separately queued diagnostics, retention and publication
batches. Exact PR gates and backed-up delivery remain required. The real HTTP fixture now starts its abort
only after headers are observed, avoiding a machine-speed race in body coverage.

No live device was commanded, enrolled or captured. This change does not impose
a backend cancellation policy or infer whether an uncertain physical command ran.

## Final integration

The request batch integrates onto checked publication main `8d9e79f`. Comparing
the complete tree with qualified snapshot `06779f7` finds documentation changes
only: runtime, workflows and tests remain byte-identical to that snapshot's 2,581
Node passes, zero failures and two root-only skips (2,583 total), all 23 Host
Recovery and 55 Android JVM passes. The earlier 36 focused Node and 19-per-engine
Veyon/request browser results apply to the unchanged request implementation.
The Wiki mirrors the request and diagnostic contracts. Exact-head CI is still
required, and deployment joins the remaining modernization batch after final
main image publication.
