# Lighting metadata and policy persistence

[Finding classification and immutable source locations](finding-metadata.md#lighting-registry-persistence).

Baseline: PR #313 head `44cb9c8`.

RG-LIGHTS-006 has three actual-source failures: failed metadata persistence left
new live names/groups/registry entries; invalid empty names created an overlay
before validation; failed discovery preference persistence changed live
enrollment policy. Candidate metadata and policy now persist before live
publication. Existing registry keys, physical identity, name normalization and
group membership semantics remain compatible. Unknown inherited object
properties cannot pass as known devices.

A further regression reproduced a persisted `__proto__` group changing the group
map's prototype during startup projection. Both candidate group publication and
the shared registry projector now create own data properties. This preserves
configured names without treating them as object operations.

All 18 new regressions pass, covering failure identity preservation, validation,
persist-before-publish observations, explicit retry, legacy keys, physical
identity, group behavior and restart projection. The supported Linux snapshot
passed 1,954 tests with zero failures and two root-only skips (1,956 total),
plus all 23 Host Recovery tests and syntax/controller checks. Required CI
remains pending. Frontend source is unchanged from
PR #313's 80 Chromium and 80 Firefox passes. No physical lighting or production
fault injection was used.

Discovery enrollment/reconciliation persistence, device dispatch identity and
ESPHome remain under review. Checked delivery follows PR #313.
