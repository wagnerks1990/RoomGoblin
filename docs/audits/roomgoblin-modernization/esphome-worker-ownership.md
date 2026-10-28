# ESPHome worker error containment and discovery completion

[Finding classification and immutable source locations](finding-metadata.md#esphome-worker-ownership).

Baseline: qualified controller repair `d80389c`.

RG-ESP-003 reproduced six actual-source failures: JSON null escaped the worker
stdout callback, synchronous stdin errors retained pending RPCs, a second child
error was unhandled, worker stdout errors were unhandled, discovery parsed
partial stdout at process exit, and discovery stdout errors were unhandled.

The worker rejects non-object IPC, contains synchronous writes and continuing
process/pipe errors, and releases every pending request through the existing
uncertain-delivery/no-replay path. The current-child guard prevents obsolete
events from failing a replacement or increasing backoff twice. Discovery waits
for `close`, retaining its six-second deadline and one-megabyte output limit.
This follows Node's distinction between process exit and completed stdio:
[child process documentation](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html).
Accepted discovery still drains after shutdown admission closes.

All 20 new regressions and 51 focused ESPHome cases pass, including a real Node
child writing discovery fixture data without network access. Final Linux
qualification passes 2,064 tests with zero failures and two root-only skips
(2,066 total), plus all 23 Host Recovery tests and syntax/controller checks.
Frontend source is unchanged from the controller
repair's 83 Chromium and 83 Firefox passes. No physical discovery, enrollment,
device commands, production uploads or fault injection were used.

The first full run passed 2,061 tests with three failures and two root-only skips
(2,066 total). All three failures used the discovery lifecycle fixture, which
emitted process exit without the subsequent stdio close. The fixture now emits
close after its stdout ends (or is destroyed), matching the real subprocess
contract. Its Full Recovery, deferred-audit and shutdown assertions are unchanged.
The fresh full qualification run passes after this fixture correction.
