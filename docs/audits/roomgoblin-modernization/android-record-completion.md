# Android asynchronous record completion

[Finding classification and immutable source locations](finding-metadata.md#android-record-completion).

RG-LAB-032 reproduces three Agent v2 configuration failures: completion overwrites
newer metadata, re-enables a concurrently disabled enrollment and recreates a
removed enrollment. An unchanged configuration is the passing baseline control.

Existing-device updates now reload the current record and apply only the fields
owned by that operation. They require the same enrollment creation identity,
endpoint and saved Android identity. Missing/replaced records fail visibly without
insertion or replay. Delayed legacy deletion also checks its original enrollment.
Enrollment remains the explicit insertion path; synchronous metadata saves retain
their existing behavior.

The guarded patch path covers Agent v2/legacy configuration, status success and
failure, mDNS recovery, reboot feedback, persistent ADB and APK completion. APK
configuration restoration receives current metadata. No credentials, device IDs,
signing identities, confirmation rules or policy settings are migrated.

The initial four-case reproduction now passes. Targeted source fixtures exercise
configuration, status, persistent ADB and APK completion with the real JSON store,
including deletion/replacement, newer metadata, disabled state and disk errors.
Broader Windows checks hit two environment limitations: CRLF-sensitive Compose
matching and POSIX file modes. Supported Linux qualification follows; neither
test was weakened. The first Linux run reported two APK fixture extraction errors
and an outdated lifecycle source assertion expecting unguarded deletion. The
fixture now extracts only the target function; the assertion requires the guarded
delete, with behavioral replacement-enrollment cases for all three lifecycle
actions. All 20 targeted cases pass. Corrected Linux qualification passes 2,348
tests with zero failures and two root-only skips, all 23 Host Recovery cases and
syntax/controller/shell checks. The Windows-only CRLF/mode failures pass there.
Browser sources remain at qualified `aed79bd` (125 workspace cases per engine).

This patch does not serialize multiple remote configurations or change when an
already-started policy action may dispatch. Concurrent changes to the same
configuration fields and policy admission after suspension/removal remain queued
for the next Group 10 review. No real device command was executed.
