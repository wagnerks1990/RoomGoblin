# Ubuntu wizard input and request ownership

[Finding classification and immutable source locations](finding-metadata.md#ubuntu-wizard-ownership).

RG-LAB-023 reproduces six failures: changed connection or withdrawn host trust
still advances an old probe; duplicate submissions send two probes; old endpoint
errors replace current feedback; older fingerprint replies replace the newer
accepted fingerprint; and a completed screen save closes a newer draft.

Probe completion now checks the submitted draft and wizard lifetime. Fingerprint
requests and key-file reads have independent generations and input snapshots.
File failures report a fixed message without raw private diagnostics. One pending
submission survives closing/reopening and releases controls when it settles.
Accepted screen saves retain newer drafts. Installation replies retain their
accepted outcome, clear unchanged submitted credentials, and leave newer values
alone. Incomplete replies remain visible without a retry. Backend authentication,
SSH identity, announcement ownership and installer contracts are unchanged.

All 15 source cases pass. Twelve focused Ubuntu browser cases pass, including
three new cases for mobile stale probes/fingerprints, duplicate screen saves with
newer drafts, and key-file failure/paste/close behavior. The first browser run had
one fixture setup error: Playwright invoked an assignment expression that returned
the replacement function. Wrapping installation of that synthetic function in a
block fixed the fixture; the page's failure handler then passed without page
errors. No real SSH key, connection, installation or display command was used.

Full qualification passes 2,241 Linux tests with two root-only skips, all 23 Host
Recovery cases, and all 109 workspace cases in each browser. The mobile stale
probe screenshot was inspected. Pending fetches
still rely on the existing transport; this change claims neither cancellation
nor a request deadline. Shared browser transport budgets remain later roadmap work.
