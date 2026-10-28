# ESPHome controller inventory and draft ownership

Baseline: qualified admission repair `43f4dfd`.

RG-ESP-002 reproduced five actual-source failures: a pre-management inventory
reply restored old devices, a late read error replaced successful management
state, overlapping management writes were admitted, enrollment success erased
newer form edits, and an old management reply repopulated inventory after read
access was removed.

Controller writes now share one management admission boundary. Inventory and
discovery replies must match the current management and permission revisions.
Current failed reads retain stale inventory with controls disabled; management
feedback survives later polls. Successful enrollment clears only an unchanged
submitted draft; newer edits retain the saved identity. Submitted key payloads
are cleared, and existing field-clearing behavior remains in place. Native
capabilities, backend authorization, command IDs and no-replay semantics remain
unchanged. The AI context now matches the existing documented explicit
unencrypted-node support rather than claiming all nodes require Noise encryption.

All 21 new Node regressions pass. Three new real-page browser cases and the two
existing ESPHome cases pass in Chromium. All 83 complete workspace cases pass in
Chromium and Firefox. The supported Linux snapshot passed 2,044 tests with zero
failures and two root-only skips (2,046 total), plus all 23 Host Recovery tests
and syntax/controller checks. Required CI remains pending. No physical ESPHome discovery, enrollment, commands,
production uploads or fault injection were used.
