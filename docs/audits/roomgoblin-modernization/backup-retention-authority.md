# Backup retention and rollback authority

[Finding classification and immutable source locations](finding-metadata.md#backup-retention-authority).

RG-DOC-001 is confirmed: earlier paragraphs in the update and AI guides still
claimed ten safety archives, contradicting their later 3/1/3 policy and the
implemented updater/maintenance defaults. Those paragraphs now agree with three
automatic operational ZIPs, one pre-* ZIP and three migration snapshots. A
rollback pin occupies a place inside its applicable limit; manual exports and
encrypted Full Recovery bundles remain excluded.

The recovery review also reproduced seven cleanup failures. An unavailable Host
Agent, unreadable journal, absent response, incomplete rollback state, missing
pin name/archive or invalid pin path could all reach deletion without a usable
rollback authority. Retention now returns 503 before deleting archives
in those cases. Verified pins and confirmed no-rollback/idle states retain the
existing bounded cleanup behavior. Updaters already treat cleanup failures as
warnings after successful deployment, so this does not roll back a healthy update.

The ten direct retention cases pass after repair. The first broader attempt ran
from the Windows checkout under WSL and encountered CRLF shell failures and
maintenance startup timeouts; it is not native qualification. The supported native
snapshot passes 2,537 cases, zero failures and two root-only skips (2,539 total),
all 23 Host Recovery and 55 Android JVM cases, and syntax/controller checks.
It includes the actual recovery-export and updater fixtures. Failure injection uses temporary fixture
archives only; no production backup was removed for validation.

Follow-up concurrency review reproduces six additional failures: a new update
backup or a replaced archive could be deleted after the status read, and cleanup
could proceed during incomplete update phases. Candidates and filesystem
identities are now captured before awaiting Host Agent status. New archives are
outside that candidate set; changed identities are skipped before deletion.
Returned counts reflect the directory after cleanup, including preserved arrivals.
The configured limit may therefore be exceeded temporarily when archives arrive
concurrently; a later cleanup reconciles them against fresh rollback authority.

Ordinary cleanup accepts settled idle/completed/failed status only when the
application update service is not running. The existing native updater can still
clean up during its final verifying phase after publishing the selected active
commit and rollback pin, or after explicitly clearing a completed revert's spent
pin. This preserves its already-held appliance lock without acquiring a second
lock that would block every normal update. No new host API or mutation permission
is introduced. All 19 focused retention cases pass. The final combined native
snapshot passes 2,581 Node cases, zero failures and two root-only skips (2,583
total), all 23 Host Recovery and 55 Android JVM cases, and syntax/controller
checks. This snapshot also includes the separately queued diagnostics,
publication-retry and browser-request-deadline batches; it is not an isolated
retention PR result. Production backups were not modified by these tests.

## Exact retention integration

PR #343 integrates the retention repair on checked diagnostics main `ea924b8`.
Its native snapshot at `d8a8fe5` passes 2,547 Node tests, zero failures and two
root-only skips (2,549 total), all 23 Host Recovery and 55 Android JVM cases,
and Node/controller/Python/Bash checks. Later changes only record this evidence
and align the Wiki retention guidance. Publication retry and browser request
changes are excluded from this PR. Required CI and backed-up delivery remain
separate release gates.
