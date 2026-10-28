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
command was executed. Policy cache identity is under follow-up review.
