# Scheduler restart recovery boundary

The earlier scheduler and Planning findings left later-loop phase reconstruction
as a follow-up. Final contract review resolves that item as a documented
compatibility limit, not an unimplemented timing repair. Cross-date class/block
resolution was repaired separately in
[Planning class boundaries](planning-class-boundaries.md).

The [automation contract](../../AUTOMATION-FRAMEWORK.md#display-recovery-timing)
defines a configured first-pass state projection. `firstPassDueActions` in
`src/automation-runtime.js` accounts for configured delays/dwell;
`automationDueActionSequence` in `src/server.js` applies it to the selected
scheduler time. Neither derives later pass phase from elapsed time.

Continuous restart recovery re-evaluates the currently applicable winners.
`currentContinuousRecoveryWinnerIdentities` requires the complete nonempty
resource scope of an occurrence before `recoverContinuousAutomationOccurrences`
restarts its runner. A saved Stop stays terminal; partial or superseded winners
cannot restart an entire older sequence. The
[complete-ownership repair](scheduler-complete-recovery-owner.md) records the
reproduced failures and delivered behavior.

Adapter latency and uncertain physical command completion are not durable
per-step checkpoints. An elapsed-time modulo calculation would invent a phase
that the appliance cannot verify, potentially replaying a command or overwriting
the current winner. Exact later-pass resumption would require a separately
designed durable checkpoint and uncertain-command policy. It is not added as
part of this compatibility-preserving modernization.

Existing recovery timing, complete-ownership, cancellation, class-boundary and
manual-control regressions remain the acceptance evidence. This documentation
change does not add a new runtime policy or claim physical recovery testing.
