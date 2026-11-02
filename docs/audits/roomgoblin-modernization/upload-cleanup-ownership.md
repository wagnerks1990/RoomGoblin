# Resumable upload expiry ownership

Baseline: `98f3b063ea4edf88743efbc78bf7336a1c95e628`.

## RG-MEDIA-002: Expiry deleted a session with an accepted writer

A native Linux reproduction fails: while a real chunk stream is pending,
expiry cleanup removes its session and metadata. The cleanup path ran outside
the existing per-session operation queue. A long-running accepted write, or a
queued assembly/cancel, could therefore lose its inputs when another upload
creation or housekeeping pass reclaimed apparently old metadata. This is P1
for accepted upload continuity.

Skip sessions still owned by that existing lock map. Ownership includes queued
operations until the final promise settles. Idle expired sessions remain eligible,
including malformed metadata via the existing age fallback. Failed writers release
their ownership normally; explicit cancellation keeps its place after the writer.
Preserve owner isolation, quotas, exact sizes, SHA-256, file signature inspection,
atomic publication, shared permissions and writer-drain behavior. No retry or
filesystem deletion scope is broadened.

## Qualification and delivery boundary

All eight new real-store regressions and all 17 upload checks pass under WSL
Linux. They exercise active chunks, queued chunks, active assembly, failures,
other owners, explicit cancel, create-triggered cleanup and corrupt metadata.
The first Windows baseline could not reach its assertion because native directory
permissions require Linux; the supported Linux reproduction confirmed the failure.
The supported Linux snapshot passes 1,666 tests, zero failures and two root-only
skips (1,668 total), plus all 23 Host Recovery tests and Node/controller/Python/Bash
checks. Checked delivery remains pending. No production files, uploads or
classroom devices were changed by these tests.

A separate actual-route/real-store reproduction confirms that registration
failure after assembly discards all verified upload bytes. Publication and
registration ownership need a separate fix; this expiry change does not close it.
