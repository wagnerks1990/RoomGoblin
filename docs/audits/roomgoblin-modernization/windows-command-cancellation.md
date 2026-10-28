# Native Windows command cancellation

[Finding classification and immutable source locations](finding-metadata.md#windows-command-cancellation).

Baseline: reviewed Windows monitoring PR #318 head `6dda633`.

RG-LAB-007 reproduced caller cancellation leaving an owned child process alive
using the actual extracted `RunProcessBoundedAsync` method. The fixture cleaned
up that process. The repair rejects pre-cancelled work before launch and applies
the existing process-tree termination path to both caller cancellation and its
deadline. Caller cancellation retains its original token; deadline expiry keeps
the existing TimeoutException result. No workstation command is replayed.

Six isolated actual-source process cases pass locally on .NET 10: successful
arguments, bounded failure detail, pre-cancelled admission, caller cancellation,
deadline termination and descendant cleanup. The existing Windows Validate job
now runs the same fixture on its supported .NET 8 SDK/runtime before packaging.
The harness builds only a temporary test executable and starts its own child
fixtures; it reads no credentials and does not install, start or stop the native
agent service. Full supported Linux qualification passes 2,149 tests, zero
failures and two root-only skips (2,151 total), plus all 23 Host Recovery tests
and syntax/controller checks. The previous batch's 103 browser cases per engine
remain applicable because this repair changes no browser source. Fresh CI,
supported .NET 8 execution, image publication and delivery remain pending.
Direct Windows and mounted-WSL contract attempts each passed 28 of 29 cases;
the shell image-identity case failed because the tracked Windows checkout has
CRLF shell lines. A read-only reproduction confirmed Bash's carriage-return
syntax errors. Qualification uses the supported isolated Linux snapshot, whose
tracked sources have Git line endings; its image-identity case passed. No
source/test assertion was weakened.

This repair does not claim complete native resource coverage. Process output
buffering, bootstrap/updater command bounds, connection deadlines and the broader
agent/managed-display review remain open.
