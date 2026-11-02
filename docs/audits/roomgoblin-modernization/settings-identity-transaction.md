# Administrative settings and credential transactions

[Finding classification and immutable source locations](finding-metadata.md#settings-identity-transaction).

RG-API-001 reproduces seven failures using the actual administrative handlers
and isolated encrypted SQLite storage. Update policy survived failed token
replacement/deletion or COMMIT. Integration connections could replace an MQTT
password before rejecting an invalid Veyon key, or retain changed credentials
after another secret, metadata or COMMIT failure. Four success controls pass on
the baseline.

Update policy and its requested optional GitHub token change now commit in one
transaction. Integration input validation precedes writes; connection metadata,
MQTT password and Veyon key commit together. Runtime invalidation, connection
application, cache clearing, reconnect and audit happen only after storage
commit. Omitted credentials retain their existing values. Authorization, endpoint
validation, update admission, encryption and secret-redaction rules are unchanged.

All 37 targeted settings/announcement/music cases pass, including 11 new cases
for rollback, successful retry, explicit clearing, omission and post-commit
activation. The supported Linux worktree snapshot passes 2,464 tests, zero
failures and two root-only skips, plus all 23 Host Recovery cases and the
syntax/controller checks. All 55 Android JVM cases pass; the Kotlin runners
require the explicit CI-pinned Gradle home in this local environment. Browser
code retains the qualified Weather/Sports coverage. No production credentials,
integration reconnects or update-policy changes were exercised. Checked delivery
remains pending.
