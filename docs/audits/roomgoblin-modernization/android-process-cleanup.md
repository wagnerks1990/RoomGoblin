# Android child process cleanup

[Finding classification and immutable source locations](finding-metadata.md#android-process-cleanup).

RG-LAB-040 reproduces an interrupted RootTools request leaving its direct child
alive. Agent service destruction interrupts executor workers; an InterruptedException
from waitFor or output-drain joining previously bypassed process cleanup. Four
controls pass before repair: normal completion, nonzero exit, bounded output and
timeout. The interrupted-child case fails.

Execution now owns process and stream cleanup in finally. A surviving direct
child is forcibly terminated with a bounded 500 ms exit wait, all three process
streams are closed, and the output reader is interrupted. Interruption still
propagates. Existing five/fifteen-second policy timeouts, the one-second output
drain join, 64 KiB output cap and explicit root-policy gates remain unchanged.

All five JVM cases pass using the actual source fields, result and execution
method. Process creation alone is substituted with a harmless local Java child;
the fixture runs no su executable or Android command. It verifies the direct
child and pipes, not privileged descendants or Android superuser behavior.
The fixture runs in the existing Validate Android job before APK construction.

Supported Linux qualification passes 2,428 tests with zero failures and two
root-only skips, all 23 Host Recovery cases, all 16 socket/activity/process JVM
cases and syntax/controller/shell checks. Browser sources remain unchanged
from their 126-case-per-engine qualification. No physical Android command or
root-policy change was performed.
