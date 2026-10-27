# Recovery resource identity

Baseline: `2bd5ce972dca231d5aeb8eff42a57245cec8fee6`, alpha.85, checked
PR #284 main. Status: combined resource/ownership patch qualified on checked PR #285 main; CI pending.

## RG-SCHED-024: Lighting recovery compared groups with their own members

| Field | Assessment |
| --- | --- |
| Subsystem / category | Scheduler lighting recovery / Device ownership |
| Priority / confidence | P1 / Confirmed through actual Govee dispatch and recovery |
| Exact baseline locations | `src/server.js:5771-5817,5860-5905` |
| Complexity / compatibility risk | Medium / Partial group winners must narrow command targets |
| Expected benefit | One applicable state per device, without reviving superseded member loops |
| State | Reproduced, implemented and locally qualified |

A group and one of its members occupied different winner keys. If the newer
individual appeared earlier in saved order, an older group command sent later
could overwrite it. A newer group also failed to exclude an older member loop
from continuous recovery, including when the newer group occurrence was stopped.

The selector now expands known lighting groups to actual device aliases before
comparing winners and sends only the winning members. Device precedence over a
same-name group, default All membership, inherited targets and canonical step
precedence remain intact. Unknown targets still reach normal validation and
surface a failure. Group configuration and stored automation targets are unchanged.

The initial 12 cases passed five controls and failed seven regressions on checked
main. They execute actual selection, planning, reconciliation, single-action
handling, Govee validation/group expansion and the Govee command function; only
MQTT publication and appliance dependencies are fixtures.

## RG-SCHED-025: TV recovery used receiver aliases instead of physical commands

| Field | Assessment |
| --- | --- |
| Subsystem / category | Scheduler TV recovery / Physical output and transport identity |
| Priority / confidence | P1 / Confirmed through actual emitted CEC command plans |
| Exact baseline locations | `src/server.js:5798-5842,5941-5971`; `src/automation-runtime.js:42-87` |
| Complexity / compatibility risk | Medium / Corrects partial All scope and transport isolation |
| Expected benefit | Restore the same physical command intent used by normal dispatch |
| State | Reproduced, implemented and locally qualified |

Two receiver aliases for the same physical connection/output could both win and
send conflicting writes. Conversely, independent HDMI and HDBT actions using the
same alias displaced each other. Legacy individual output overrides did not
participate in winner identity. Partial All recovery restored only one eight-port
transport, although the actual All command addresses all sixteen transport/ports.

The shared `tvPowerIntent` helper now supplies both recovery and existing
conflict/replacement resource keys. It preserves mapped connection precedence,
valid single-output overrides, mixed-selector expansion and complete recognized
broadcast scope. All covers eight HDMI and eight HDBT ports; each transport-only
selector covers its eight ports. Known aliases remain diagnostic labels. A fixed
physical port without a matching alias uses a transport/port label, not a guessed
receiver identity. No receiver command, enrollment or configuration is created.

Recovery compares physical connection/output keys and retains the exact typed
row with each winner. A complete uncontested aggregate still emits one broadcast.
Any competing TV winner or announcement lock keeps dispatch per physical target;
partial commands never re-expand a diagnostic label into receiver mappings.
Stale aggregate output metadata remains ignored. Announcement protection stays
at the final physical CEC boundary, protecting both transports of a locked port,
failing closed on unknown mappings and rechecking locks between writes. The
obsolete ID-only planning shortcut is removed so a remapped label cannot falsely
reserve an unrelated physical port. No automatic write retry is introduced.

The initial six TV cases had one passing broadcast control and five failures.
The expanded ten-case suite against unchanged checked-main server source passed
two controls and failed eight cases, adding delayed/stopped alias ownership and
independent transport recovery. Tests inspect emitted commands and their exact
port scope; they do not establish physical panel power state.

## Qualification and operational impact

All **22 new cases** pass. The focused integration run passes **148 tests, zero
failures, zero skips**, including existing command permissions, sequence behavior,
resource conflicts/replacement and physical announcement locks. An intermediate
run had 135 passes and nine failures: two timing fixtures lacked the new actual
lighting dependencies, and seven old recovery assertions expected incomplete
physical scopes. The fixtures now load those dependencies. The seven assertions
now require both All transports, independent transport state and recovery of
unmapped physical ports while retaining every protected-port exclusion. They do
not weaken safety assertions or alter appliance configuration.

The native active-worktree snapshot passed **1,210 tests: 1,208 passed, 0 failed,
2 root-only ownership skips**, plus **23 Host Recovery tests**, Node/controller
checks, Python compilation and tracked Bash syntax. Only documentation status and
evidence changed afterward. CI must also qualify Compose, runtime
images/scans, browsers and native artifacts. This initial snapshot was qualified on checked PR #284 main. The resource and
complete-ownership changes are now integrated with checked PR #285 main
`217588a`. That combined snapshot passed **1,237 tests: 1,235 passed, zero
failed and two root-only ownership skips**, plus **23 Host Recovery tests**
and Node/controller/Python/Bash checks. The combined focused suite passed 128
cases. See the ownership audit for fixture-integration evidence.

Reconciliation diagnostics count actual lighting devices and physical TV command
targets. `resourceDispatches` can still be smaller because a complete aggregate
uses one command. A CEC acknowledgement remains distinct from measured panel
state. First-pass timing, whole-occurrence cancellation, test-clock permission,
Morning Announcements and Background Music policies are preserved. No stored ID,
SQLite schema, input payload, dependency or version migration is required.

No physical classroom command, receiver reload or production fault injection was
used. Normal exact-image publication, operational backup, selective update, health
verification and coordinated rollback remain required before delivery. Later-pass
phase, cross-date resolution and the editor remain separate audit work.


A separate probe exposes a remaining admission boundary: a loop that owns only
part of its original group can still be admitted as a whole occurrence when no
cancellation marker exists. Its two controls (unopposed ownership and retained
Stop) pass. The combined [complete-ownership patch](scheduler-complete-recovery-owner.md)
addresses that boundary with ten cases, requiring the entire intended scope
before whole-run admission. The entire scheduler engine remains under review.
