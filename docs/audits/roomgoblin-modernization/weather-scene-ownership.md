# Weather scene operation ownership

[Finding classification and immutable source locations](finding-metadata.md#weather-scene-ownership).

RG-WEATHER-006 reproduces six browser failures: a delayed preview renders after
navigation; a pending send dispatches after navigation or authentication changes;
a send uses targets changed while its scene loads; and delayed schedule/overlay
actions open another workflow after leaving Weather. Current explicit dispatch
and retention of a completed preview pass before and after repair.

Navigation and authentication retire pending scene operations without discarding
an already completed preview. Rendering rechecks the active authorized workspace
and only publishes the candidate after the renderer is ready. Send captures its
explicit targets before loading and requires them to remain unchanged. Existing
settings/layout generation checks, announcement arbitration and server command
authorization remain intact. Fixture commands never reach physical displays.

All nine scene cases and the existing 20 Weather cases pass in both Chromium
and Firefox. The authentication fixture holds its unrelated refresh so the
outcome message cannot disappear before the command assertion. The renderer-load
case verifies that a retired candidate cannot be reused by a later Send. The
supported Linux snapshot passes 2,453 tests with zero failures, two expected
root-only skips, all 23 Host Recovery cases and all 55 JVM cases, plus
syntax/controller/shell checks. Checked delivery remains separate.
