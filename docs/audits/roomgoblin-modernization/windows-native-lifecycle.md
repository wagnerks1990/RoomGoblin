# Native Windows lifecycle process ownership

[Finding classification and immutable source locations](finding-metadata.md#windows-native-lifecycle).

RG-LAB-012 reproduces six actual-source failures in bootstrap and updater:
unbounded thrown diagnostics, approximately 67.5 MB retained for 32 MiB of
captured output, and owned child processes still running after 35 seconds.
RG-LAB-013 reproduces four stop-confirmation failures: both owners return after
an expired wait and treat query error 5 as stopped.
RG-LAB-014 reproduces four install-admission failures: legacy stop/disable,
legacy query and install-directory errors bypass the failure handler. These
steps now share that handler; a nativeTouched marker prevents rollback from
stopping a native service before installation reached it.

Both helpers now apply a 30-second default process/output budget, retain at most
64 Ki characters per stream and limit thrown error detail to 2,048 characters.
Timeouts stop the owned process tree where the parent still exists. Inherited
output-pipe waits are bounded without claiming ownership of an already-detached
descendant. ArgumentList, capture and allowed nonzero-exit behavior remain.

Stop polling uses Stopwatch and passes only the remaining budget to each query
and sleep. Successful STOPPED output and explicit error 1060 confirm absence;
other query errors and exhausted budgets fail before file replacement/deletion.
The existing rollback sequence uses this same gate: if it cannot establish a
safe stop, it fails with remaining recovery files preserved rather than claiming
successful restoration or enabling a second agent runtime. No installer identity,
DPAPI, package hash, service configuration or enrolled credential was changed.

All 36 actual-source cases pass locally on .NET 10 with zero build warnings
or errors, including both real 30-second budgets. Controlled service-query
outcomes cover stopped, missing, access denied, running, zero budget and shrinking
query budgets. These are process/polling contracts, not live SCM, reinstall,
rollback or fresh-enrollment acceptance. Eight included install-owner cases
exercise the actual Install body with temporary package/config files and
simulated service/task operations, including fresh-config cleanup and refusal
to start legacy runtime when native stop is unconfirmed. Final Linux qualification
passes 2,169 tests, with zero failures and two root-only skips, plus all 23 Host
Recovery cases. Syntax, controller and tracked shell checks pass. Required .NET 8
CI and image/platform/security gates precede publication and delivery. Browser
sources remain unchanged from qualified `32416c9` (270 Chromium cases and 106
workspace/Veyon Firefox cases); required CI runs both browser suites again.
The inherited assumption that an existing legacy task was enabled remains a
separate review item; this repair does not claim complete migration-state coverage.

The missing-service classification follows Microsoft's documented
[Windows error 1060](https://learn.microsoft.com/en-us/windows/win32/debug/system-error-codes--1000-1299-).
