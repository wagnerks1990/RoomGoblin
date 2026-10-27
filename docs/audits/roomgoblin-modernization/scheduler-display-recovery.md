# Display recovery timing

Baseline: `22b19dce3078ccfb3c058f6db0d27b7851588e97`, alpha.85, checked
PR #283 main. Status: locally qualified on checked PR #284 main; CI and delivery pending.

## RG-SCHED-022: Recovery applied future display actions and cleared their targets

| Field | Assessment |
| --- | --- |
| Subsystem / category | Scheduler display reconciliation / Timing and target ownership |
| Priority / confidence | P1 / Confirmed with actual selector, resync and action handler |
| Exact baseline locations | `src/server.js:985-1052,5850-5864` |
| Complexity / compatibility risk | Medium / Due state must stay separate from continuous ownership |
| Expected benefit | Keep current display content until the next configured action is due |
| State | Reproduced, implemented and locally qualified |

The selector admitted every display target as soon as its occurrence started.
Resync then cleared all winning targets and replayed every display action without
considering pre-action delay or earlier dwell. A future action could replace
current content early, including when a preceding lighting action was still
within its dwell. An event-level timer could also clear a future target early.

Recovery now computes the due prefix of the normalized first pass using exact
seconds, including every preceding action's delay and dwell. Winner selection
uses only that prefix's display intent. Dispatch plans due content and timer
outputs before clearing their union, preserving ordered composed content,
class defaults, inherited targets and the existing winning-target restriction.
An owned timer deadline is still captured before clearing; reconstructed duration
and clock deadlines retain their existing policy. An empty dispatch plan sends
nothing and does not consume the scheduled occurrence if the clock moved between
selection and dispatch.

Continuous-run admission explicitly requests full occurrence ownership, including
pending actions. This keeps a delayed current owner recoverable through the
normal runner without reviving an older or stopped predecessor. Cancellation
remains checked after ownership selection. The ordinary sequence runner,
announcement locks, command permission checks and native media looping remain
in place.

## RG-SCHED-023: Display reconciliation selected winners using a different clock

| Field | Assessment |
| --- | --- |
| Subsystem / category | Scheduler recovery / Clock consistency |
| Priority / confidence | P2 / Confirmed by executable live-clock fixture |
| Exact baseline locations | `src/server.js:1066-1090` |
| Complexity / compatibility risk | Small / Uses the existing scheduler clock and live-command guard |
| Expected benefit | Live test-clock recovery selects and applies the same dated state |
| State | Reproduced, implemented and locally qualified |

The wrapper selected display winners with real `new Date()` while continuous
recovery and timer reconstruction used the scheduler clock. It now captures the
scheduler clock for selection and metadata. Resync captures one clock value for
eligibility and deadline construction. Existing dry-run and per-command guards
remain mandatory; this does not enable independent scheduler side effects.

## Evidence and limits

The initial 16-case expanded fixture on unchanged main had **7 passed, 9 failed**.
The implemented suite passes all 16; a seventeenth case verifies that a clock
change leaving no due action does not write execution metadata. The tests load
actual server functions and schema/runtime helpers, with fixture adapters for
commands, timers, persistence and owned task admission. They cover first delay,
mixed-domain dwell, target-specific clearing, class targets, composed content,
timer eligibility/deadlines, exact boundaries, future occurrences, continuous
ownership, stopped winners and clock consistency.

The existing planning timer fixture now loads the real due-sequence dependencies.
The framework source assertion requires explicit display ownership mode; the
executable tests verify its behavior. These suites pass **41 tests, 0 failed,
0 skipped**. The native active-worktree snapshot passed **1,189 tests: 1,187 passed, 0 failed,
2 root-only ownership skips**, plus **23 Host Recovery tests**, Node/controller
checks, Python compilation and tracked Bash syntax. CI must also qualify Compose,
runtime images/scans, browser coverage and native artifacts. This qualification
belongs to checked main PR #283 plus the display patch; PR #284 integration and
combined qualification remain pending.

This is a configured first-pass state projection, not a reconstruction of later
loop phases, adapter latency or cross-date scheduling. Those boundaries remain
separate audit items. No schema, payload, version, identity, dependency or stored
configuration change occurs. No physical classroom command, receiver reload or
production fault injection was used. The complete scheduler engine and editor
are not marked audited by this patch.


Checked recovery main `2bd5ce972dca231d5aeb8eff42a57245cec8fee6` is integrated.
Both display and non-display recovery retain explicit full-ownership mode.
Documentation and the shared call-shape assertion were reconciled without losing
any timing, Stop-retention or delivery changes. Combined qualification is running;
the earlier full count is not claimed for this integrated tree.


Two combined Windows focused attempts each passed **164 tests** and failed the
unchanged POSIX directory-mode assertion (Windows mode 0666 versus required
Linux 0770). No assertion or production permissions were weakened. Native Linux
qualification runs that same storage test on the supported platform.


The final combined native snapshot passed **1,205 tests: 1,203 passed, 0 failed,
2 root-only ownership skips**, plus **23 Host Recovery tests**, Node/controller
checks, Python compilation and tracked Bash syntax. The Windows directory-mode
case passed unchanged on Linux. Only documentation status/evidence changed after
this run. Final source, merge and whitespace review passed. Fresh PR/main gates,
exact publication and the normal backed-up update remain pending.
