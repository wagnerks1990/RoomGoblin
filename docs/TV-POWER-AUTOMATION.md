# Scheduled TV power and aggregate selectors

## Defect and execution path

The TV-power handler already supports the same Pluto broadcast command used by
manual room controls. The canonical action sequencer nevertheless expanded a
saved All selector to receiver IDs before calling that handler. The broadcast
branch was therefore unreachable from normal sequence execution. A second
expansion could also lose a forced HDMI/HDBT transport, and duplicate receiver
output mappings could omit a physical port from the resulting individual writes.

The correction retains two distinct values: requested selector intent and typed
resolved output/connection rows. Expanded IDs are still used for existing
resource and announcement-priority checks. With no announcement receiver lock,
explicit All selectors reach the handler unchanged. All TVs dominates redundant
narrower selections; duplicate selections do not duplicate the broadcast.

| Saved selector | Pluto command |
| --- | --- |
| All TVs (`all`) | `cecAllOutputs` |
| All HDMI TVs (`hdmi-all`) | `cecAllHdmi` |
| All HDBT TVs (`hdbt-all`) | `cecAllHdbt` |

Power On retains index 0 and Power Off retains index 1. Individual TV selections
still use `cecOutput` with their saved mapping; they never broaden to All merely
because they happen to cover several or all ports. A legacy individual `output`
field does not narrow aggregate intent. No stored event, receiver mapping, group,
credential, database schema, archived topology or deployment identifier changes.

## Priority and failure boundaries

Any announcement-locked configured receiver prevents aggregate broadcast,
including a receiver outside the legacy tvN inventory. Existing target filtering
continues to defer locked targets; if every target is locked, no TV-power command
is sent. Partial dispatch carries the original typed output/connection rows as
an internal function option, avoiding another ID expansion that would discard
an explicit HDMI/HDBT transport. The runner removes stale aggregate `output`
metadata before filtering so it cannot redirect the last remaining output.
This option is not accepted as a browser or persisted automation override.

The existing internal announcement-priority bypass remains separate from normal
scheduled and manual Run Now operation. The last shared CEC dispatch boundary additionally
resolves all announcement receiver locks to their original physical outputs,
including named receivers and aliases discarded during target deduplication.
This uses configured mappings, not physical wiring discovery. It does not change
stored mappings or the per-target recovery winner scoring model.

A rejected, missing, pending-verification or thrown adapter result is a failed
action. Continue-on-error advances only according to the saved action setting;
it does not turn the result into success. No automatic CEC retries are added,
particularly after uncertain delivery. Run once still participates only on pass
1. Calendar suppression, class-end handling, occurrence cancellation, timers,
Morning Announcements ownership and Background Music policy are unchanged.

## Physical announcement-output safety


Announcement TV-power protection is enforced again at the shared CEC dispatch
boundary using every locked receiver's physical `avOutput`, before deduplication
can hide aliases. Known legacy tv1..tv8 IDs may use their implicit same-number
port only when `avOutput` is absent. Explicit blank/invalid mappings and unmapped
named receivers fail closed: TV power is deferred, not guessed. A protected
physical port blocks both transports conservatively. Individual payload output
overrides are checked too, and locks are rechecked between individual writes.
Deferral is surfaced as priority ownership, not an adapter failure. Do not weaken
this boundary to an ID-only filter or automatically retry deferred CEC writes.

## Startup and Resume Scheduled State

Recovery first computes the existing per-target winners using scheduled time,
priority and event identity. Each TV winner retains a shared, in-process marker
for its original step/occurrence and that step's requested selectors and typed
output/connection rows. This marker is not persisted and does not change scores.

Only an explicit aggregate that owns every current TV winner and its complete
resolved target scope can become one broadcast. Any competing TV winner keeps
execution per-target, including a winner represented by a remapped receiver ID.
The planner does not broadcast first and then replay overrides. Partial winners
retain forced HDMI/HDBT transports and discard stale aggregate output metadata.
Explicit individual selections never become a broadcast merely by covering all
outputs. Full Morning Announcements restoration keeps its existing early return;
remaining receiver locks also prohibit broadcasts and defer locked TV writes.

Reconciliation audit keeps the logical `resourceWinners` count and adds
`resourceDispatches` for the potentially smaller command/result count. A broadcast
result remains an acknowledgement, not eight physical-state measurements.

## Executable regression coverage

```bash
node --test test/automation-tv-power-*.test.js
npm run check
npm test
```

The sequence harness executes the actual `runClassroomAutomation` and
`runSingleAutomationAction` source together with the real schema and target
helpers. Only appliance dependencies are fixtures. It covers scheduled/manual
broadcast parity, canonical/legacy events, cross-domain/default/inherited
targets, remapped/duplicate receiver outputs, explicit individual commands,
forced transport after partial locks, full deferral, failure handling, no replay,
Run once, cancellation, pause and class-end boundaries. A helper-only test or
assertion that the source contains `cecAllOutputs` cannot detect this handoff bug.

The recovery harness executes the actual winner selection, dispatch planner,
`reconcileScheduledAutomationState` and single-action handler together. It checks
startup/operator-resume parity, complete versus partial aggregate ownership,
same-minute priority, later individual overrides, forced transport, stale output
metadata, legacy events, disabled/future/unmatched events, school-day suppression,
announcement restoration and lock deferral. Failure cases verify no uncertain
write is replayed and Background Music reconciliation still runs. These tests
inspect the emitted commands rather than merely looking for helper names in source.

These tests do not contact classroom hardware or verify physical panel standby.

## Upgrade, acceptance and rollback

Wait for the required PR and merged-main validation gates and publication of the
exact SHA-tagged Hub/maintenance images. Use the existing backed-up updater:

```bash
sudo bash /opt/classroom-hub/deploy/update-production.sh --plan
sudo bash /opt/classroom-hub/deploy/update-production.sh
```

Do not pull main first, copy files into the running container, retag an older
image, or bypass a failed validation/publication gate. See
[Production updates](PRODUCTION-UPDATES.md) for old-runner transition and rollback.
This is a Hub application change; the normal selective updater may retain the
unchanged maintenance component after its existing input/identity checks.

After deployment, compare the running Hub OCI revision with the selected commit
and confirm the updater's application, database and scheduler readiness checks
pass. Run the existing shutdown automation in an appropriate maintenance period
and confirm every intended physical panel, including the previously missed
panel, enters standby. Then verify manual power controls still work. No automation
recreation or Android APK reinstall is needed. A successful Pluto acknowledgement
alone is not proof of physical power state.

The updater owns operational backup, health checking and automatic rollback on
deployment failure. Preserve its saved source/database/environment and image
identity together when reverting; do not reset the database or recreate device
credentials to undo this source-only repair.
