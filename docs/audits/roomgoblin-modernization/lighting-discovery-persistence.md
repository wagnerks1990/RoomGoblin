# Lighting discovery persistence

Baseline: qualified registry repair `55327cf` on PR #313 head `44cb9c8`.

RG-LIGHTS-007 reproduced five actual-source failures: disabled enrollment
registered unknown devices that later appeared after restart; failed enrollment,
cleanup and synthetic migration persisted different state from live inventory.
Registry changes now persist before live projections and notifications. Disabled
enrollment leaves unknown devices out, while known state/presence remains live.
Historical keys, physical metadata, operator names, groups and cleanup grace are
preserved. Manual cleanup uses one write for synthetic and stale removals.

The review also found startup migration calling auditing before its owner was
initialized, and uncontained MQTT/timer persistence failures. Startup cleanup now
runs after audit initialization. Background failures remain diagnostic; freeze
and shutdown still prevent writes and unrelated MQTT display traffic continues.

All 25 new regressions pass; combined with registry and command transport checks,
all 72 focused cases pass. The supported Linux snapshot passed 1,979 tests with
zero failures and two root-only skips (1,981 total), plus all 23 Host Recovery
tests and syntax/controller checks. Required CI remains pending. Frontend source
is unchanged from PR #313's 80 cases per browser.
No physical lighting/display commands or production fault injection were used.

Device dispatch identity and ESPHome review remain open. The registry and discovery
commits will integrate together after merged PR #313's exact-image delivery.
