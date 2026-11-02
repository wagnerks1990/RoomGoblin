# Automation resource identity review

Baseline: `70ad1c8e6dbcf2e824746d25af8142dc88c363ea`, alpha.85.
Status: validated, merged and delivered in PR #278 on 2026-10-27 UTC.

## Inspection boundary

Fully read `automationResourceKeys`, the sequence runner's target selection,
`runSingleAutomationAction`, `goveeTargets` and `directGoveeCommand`, plus conflict
diagnostics and overlapping-run cancellation. The TV inventory/expansion and
canonical action normalization modules were read in full. Fixtures execute the
actual runner, dispatch handlers, resource resolver, conflict diagnostics and
supersession function with controlled network adapters. This is resource admission
review, not closure of recovery winner timing or in-flight supersession ordering.

## RG-SCHED-009: Empty primary targets disappeared from resource ownership

| Field | Assessment |
| --- | --- |
| Subsystem / category | Scheduler conflict and replacement / Reliability |
| Priority / confidence | P1 / Confirmed by default display and TV execution fixtures |
| Exact baseline locations | `src/server.js:5911-5924`; runner target resolution `1910-1928` |
| Complexity / compatibility risk | Small / Low: existing dispatch defaults |
| Expected benefit | Detect and replace overlapping runs targeting the default devices |
| State | Reproduced, validated and delivered in PR #278 |

The runner applies the action's default `all` selector when a primary action has
no explicit targets. Resource calculation instead used its empty array, producing
no ownership keys. A live action could therefore command devices without taking
part in overlap detection. The resolver now uses the same default for that path.
Compatible later-action inheritance and class-default display-domain precedence
remain intact; this patch does not redefine empty inherited-target semantics.

## RG-SCHED-010: TV keys differed from actual connection and output intent

| Field | Assessment |
| --- | --- |
| Subsystem / category | TV-power resource identity / Compatibility and reliability |
| Priority / confidence | P1 / Confirmed by real-dispatch fixtures |
| Exact baseline locations | `src/server.js:5919`; dispatch `1493-1528` |
| Complexity / compatibility risk | Medium / Medium: broader accurate broadcast ownership |
| Expected benefit | Prevent missed broadcast overlaps and false connection conflicts |
| State | Reproduced, validated and delivered in PR #278 |

Resource expansion omitted the payload connection and individual output override.
It also used receiver aliases for aggregate commands that actually address every
physical port. Remapped or duplicate aliases could omit an output, and the all-TV
broadcast's HDMI side was absent. Individual HDMI actions could be mislabeled as
HDBT, creating false same-transport conflicts.

Individual keys now follow the same expansion, device-connection precedence and
valid single-output override as dispatch. Recognized broadcasts reserve their
complete eight-output transport intent, even when announcements temporarily
defer some outputs. Mixed selectors retain individual expansion. No device
mapping, transport command, saved identifier or topology store changes.

## RG-SCHED-011: Lighting group ownership hid member collisions

| Field | Assessment |
| --- | --- |
| Subsystem / category | Lighting resources / Reliability |
| Priority / confidence | P1 / Confirmed by group/member conflict and supersession fixtures |
| Exact baseline locations | `src/server.js:5920`; group resolution `4350-4354` |
| Complexity / compatibility risk | Small / Low: current configured group membership |
| Expected benefit | Prevent a group loop from fighting a newer command to one member |
| State | Reproduced, validated and delivered in PR #278 |

The resource resolver kept a group name such as `all`, while Govee dispatch expands
the group into device aliases. A command to a member did not overlap that group
key, so conflict diagnostics and cancellation missed it. Known lighting targets
now use the existing Govee target resolver; a device still takes precedence over
a same-name group. Unknown targets retain their diagnostic identity and existing
dispatch failure behavior. Group expansion changes no configuration or MQTT payload.

## Qualification

The baseline fails **9 of 13** resource fixtures; four compatibility controls
pass. Corrected resource, TV sequence/recovery, run ownership, cycle timing and
existing-conflict editing suites pass **112 tests**. The fixtures compare resolved
keys with actual captured TV/display/Govee dispatches and exercise collision and
supersession behavior. No physical device is contacted.

The full active-worktree native Linux snapshot passed **1,084 tests: 1,082 passed,
0 failed, 2 root-only ownership skips**, plus **23 Host Recovery tests**. Node and
controller checks, Host Python compilation and tracked Bash syntax passed.
Docker is unavailable locally, so CI owns Compose, image builds/scans and native
artifact qualification. Required CI, checked merge, Wiki sync, exact-image
publication and the normal backed-up update are pending. Replacement ordering has
its own [review and tests](scheduler-dispatch-order.md) in the combined PR #278.
Recovery winner timing and the remaining scheduler/editor review remain open.
Resource identity does not imply those other behaviors are fixed.


This change is included in the consolidated PR #278. Its final combined snapshot
passed 1,110 tests with zero failures and two root-only skips (1,112 total), plus
23 Host Recovery tests and syntax checks. See the validation record; fresh CI,
checked merge and delivery remain pending.

## Delivery closure

PR #278 passed all 14 PR checks and all five main workflows. The normal backed-up
update completed at 07:45:03 UTC on clean main and Hub image
`66c54a2b321675905472ea992b88b0f0319ab8fa`. Maintenance remained healthy at
`20f8c501916f34e17bee2c643434e7cce0c919e6`. Runtime health, database/secret integrity,
permissions, authentication, source/deployment inputs, served assets, backup
integrity and rollback passed. No physical command or receiver reload was issued.
Earlier pending statements describe their qualification stage; this closure is
the current delivery status. See [validation evidence](validation.md).
