# Ubuntu repair completion and current records

[Finding classification and immutable source locations](finding-metadata.md#ubuntu-repair-record-ownership).

RG-LAB-022 reproduces repair success and failure replacing a computer's current
record with the snapshot captured before its installer ran. Cancelling a pending
maintenance schedule during installation is allowed, but repair completion could
restore that schedule and discard its cancellation history. A newer metadata
snapshot was also lost. Three baseline assertions fail; three identity, uncertain
delivery and persistence-failure controls pass.

The initial repair updated only `state` on the current record, for both `ready`
and `attention`. The subsequent [mapping review](ubuntu-screen-mapping-ownership.md)
also promotes configuration only after acknowledgment. The transactional identity
save, restricted
management key, installer verification, writer tracking and busy release remain
unchanged. No remote operation is retried. A primary completion-persistence
failure still fails visibly and preserves previously durable cancellation.

The six source cases use the real manager, a generated fixture SSH key and a
gated synthetic transport. No SSH connection, workstation repair or physical
display command is performed. All six cases pass after the repair. Supported
Linux qualification passes 2,226 tests with two root-only skips and all 23 Host
Recovery cases, plus syntax/controller and shell checks. Browser source is
unchanged from PR #325's 106 workspace passes per engine. Checked delivery follows.
