# Backup retention and rollback authority

RG-DOC-001 is confirmed: earlier paragraphs in the update and AI guides still
claimed ten safety archives, contradicting their later 3/1/3 policy and the
implemented updater/maintenance defaults. Those paragraphs now agree with three
automatic operational ZIPs, one pre-* ZIP and three migration snapshots. A
rollback pin occupies a place inside its applicable limit; manual exports and
encrypted Full Recovery bundles remain excluded.

The recovery review also reproduced seven cleanup failures. An unavailable Host
Agent, unreadable journal, absent response, incomplete rollback state, missing
pin name/archive or invalid pin path could all reach deletion without a usable
rollback authority. Retention now returns 503 before scanning/deleting archives
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
