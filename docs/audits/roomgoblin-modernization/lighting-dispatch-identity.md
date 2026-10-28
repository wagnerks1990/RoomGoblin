# Lighting command target identity

[Finding classification and immutable source locations](finding-metadata.md#lighting-dispatch-identity).

Baseline: PR #314 head `b631369`.

RG-LIGHTS-008 reproduced three actual-source failures: inherited map properties
accepted as targets, an unknown later group member allowing earlier writes, and
a pending alias redirecting a group command to different hardware after an await.

Commands now validate all targets before sending, capture group membership,
payload and physical metadata, and recheck each pending device's ID plus native
temperature transport/address. A changed target stops remaining writes without
replaying earlier sends. Friendly names and accepted payloads remain stable;
existing MQTT/UDP payloads, group order and automation priorities are preserved.
Own prototype-shaped configured names remain ordinary data. Duplicate group
aliases send once. Scene/status reads reject inherited entries as unknown.

All 35 new regressions and 246 focused lighting/automation/announcement/music
cases pass. The initial combined run had 11 fixture failures: ten old lighting
recovery cases used ID-less inventory, and one new comparison crossed VM realms.
Fixtures now supply physical IDs and normalize the comparison; assertions remain
intact. The supported Linux snapshot passed 2,014 tests with zero failures and
two root-only skips (2,016 total), plus all 23 Host Recovery tests and
syntax/controller checks. Required CI remains pending.
Frontend source is unchanged from PR #313's 80 cases per browser.

Group writes remain sequential, not atomic. No physical lighting/display commands
or production fault injection were used. ESPHome remains under review.
