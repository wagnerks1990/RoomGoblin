# Android policy dispatch admission

RG-LAB-033 reproduces five failures: disabling/removing an enrollment while
connection or wake is pending still sends the following command, and overlapping
policy passes duplicate dispatch. The unchanged enabled policy is a passing
baseline control.

One pending policy operation owns each display. Other displays remain independent.
Before dispatch, between wake and launch, and before marking the policy complete,
the worker rechecks enrollment identity, enabled state, profile assignment,
relevant profile fields and the current schedule window/date. Retired work stops
without issuing the remaining commands. Already-accepted wake/sleep is reported
as a change with an incomplete outcome if the later stage is prevented. A failed
operation releases admission; completed-policy caching and explicit force remain.

This in-process owner does not cancel an accepted ADB command or add a durable
restart claim. Policy actions remain the existing non-toggle wake/sleep and
launch commands. Configuration-operation admission remains separate review work.
All 14 policy cases and 20 record-completion cases pass. Supported Linux
qualification passes 2,362 tests with zero failures and two root-only skips,
all 23 Host Recovery cases and syntax/controller/shell checks. Browser sources
remain at qualified `aed79bd` (125 workspace cases per engine). No physical
command was executed.

The cache follow-up reproduced two failures: reused enrollment IDs inherited an
old completion, and enabling profile launch did not reconcile an already-awake
display. Completion now records enrollment/endpoint identity and relevant profile
settings in a private cache context, retaining the existing status API values.
Disabled/removed entries are pruned during reconciliation. Renaming a display
does not repeat commands, and an endpoint recovered by mDNS owns the completed
cache. An additional reproduced cleanup failure left a private context behind
when reboot had already cleared its status marker. Reconciliation now prunes
both cache key sets. All 20 policy and 20 record cases pass. Final combined Linux
qualification passes 2,368 tests with zero failures and two root-only skips,
all 23 Host Recovery cases and syntax/controller/shell checks. Browser sources
remain unchanged from the 125-case-per-engine qualification.
