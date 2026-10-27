# Lifecycle validation evidence

Date: 2026-10-26. Baseline: `c2808c8ba861b852e6bbe8dec8c52d8251227756`.
The candidate is the working-tree patch in this PR, including its untracked new
source/test files; the Windows helper snapshots that exact state into native WSL.

## Executed locally

| Check | Result |
| --- | --- |
| Baseline native Linux `npm run check` and `npm test` | Passed; 947 tests, 945 passed, 0 failed, 2 skipped |
| Final candidate native Linux `npm run check` and `npm test` | Passed; 958 tests, 956 passed, 0 failed, 2 skipped |
| Final callback isolation/global-timer tests | 2 passed, 0 failed, 0 skipped |
| Host Python compilation | Passed for `server.py`, `start.py`, `full_recovery.py` |
| Host Full Recovery unittest suite | 23 passed, 0 failures/errors, 0 skipped |
| All tracked shell scripts, `bash -n` | Passed in the native Linux snapshot |
| `git diff --check` | Passed |

The mandated command was run for the baseline and candidate:

```powershell
py -3.11 "C:\ChatGPT\Workspace\Tools\RoomGoblin-LinuxTests.py"
```

An additional invocation used that helper's unchanged snapshot procedure and
check/test commands, then appended Python compilation, the host unittest suite
and `git ls-files -z '*.sh' | xargs -0 -r -n 1 bash -n` inside the same native
checkout. Linux Node was v24.21.0; CI also validates its configured Node 22 runtime.
The two full-suite skips require root for cross-UID/group ownership tests.

Initial direct WSL validation encountered an unsourced nvm environment and then
the Windows worktree's nonportable Git pointer. Neither is a source regression.
The verified native snapshot resolved both and completed the host/shell checks.

## Behavioral coverage

- The Node command declared by npm matches the container's `exec` command.
- The actual bootstrap starts both healthy listeners using temporary data and
  loopback-only ports. Maintenance mirrors return 401 without their token and
  200 with a test-owned token.
- An incomplete HTTP request holds the media child in its five-second drain.
  The Hub exits normally only after that child has exited and been reaped.
- Killing the media child makes the Hub exit 1.
- Supervisor state tests cover repeated stop, pending exit, escalation, startup
  errors, unexpected zero exit, abrupt owner exit and control-only entry points.
- Readiness follows token insertion/removal and an atomically replaced database.
- Registering maintenance routes does not replace global timers or suppress
  surrounding recovery work when no Music Assistant token exists.

The last defect was reproduced against the baseline bridge in an isolated Node
process: a callback that reconciles state and then calls `backgroundMusicTick`
never ran without credentials (`false !== true`). The same callback regression
passes with this patch. This reproduces the source-text interception mechanism;
it is not a live Morning Announcements/device acceptance test.

## External and operational limits

Docker is unavailable in the local Windows/WSL environment. Compose validation,
image builds, image security scans, browser regression and other platform gates
must run through the PR's existing required workflows. Check the exact PR head;
these local results do not claim those gates passed.

The Wiki mirror is changed with the source. Hosted Wiki synchronization remains
the existing `Sync Wiki` workflow after a reviewed merge to main. No production
configuration, appliance, classroom display, database or external service was
changed. No merge, deployment, image publication or live acceptance is implied.

That first patch left writer drain and bridge composition open. The follow-up
below adds the bounded drain; exhaustive feature acceptance and bridge composition
remain open in [the coverage and findings](core-lifecycle.md).


## Writer-drain follow-up (2026-10-26)

Baseline: `ea53e2deff70dbb151ca551ddd27b89c633d6afd`, alpha.85. The mandated
Windows helper was run against the baseline and the complete candidate, including
untracked new files, using its isolated native WSL snapshot.

| Check | Actual result |
| --- | --- |
| Baseline `npm run check` + `npm test` | 965 tests: 963 passed, 0 failed, 2 skipped |
| Final candidate `npm run check` + `npm test` | 978 tests: 976 passed, 0 failed, 2 skipped |
| Python compile: Host Agent server/start/full recovery | Passed |
| Host Full Recovery unittest suite | 23 passed, 0 failures/errors |
| All tracked shell scripts, `bash -n` | Passed |
| `git diff --check` | Passed |

Node: v24.21.0 in WSL. The two skips still require root for cross-UID/group
ownership tests. Docker is absent locally and in WSL; Compose/images, Node 22,
browser/platform and security coverage remain the required PR workflows, whose
current result belongs to the exact PR head rather than these local counts.

The 13 new regressions cover:

- Actual HTTP disconnect and response-finish races: the final write remains in
  the same Hub SQLite database after clean process exit.
- Express route chaining, nested guards, setting getters, async middleware and
  error handlers, without changing the global prototypes.
- Ordinary aborted-body cleanup remains unchanged; during shutdown, a late
  body-parser continuation cannot start another writer for that abandoned request.
- An unresponsive WebSocket close handshake and disconnect callback completion.
- An accepted authenticated WebSocket command whose MQTT adapter is deliberately
  delayed: its final command audit persists even after the socket disconnects.
- A stuck handler exceeding the existing ten-second deadline exits 1, and a
  reader holding a WAL snapshot causes checkpoint failure rather than false
  success; the completed application write is preserved.
- Active export freeze retains authentication and one-use thaw validation while
  other requests (including the preloaded display gateway) receive 503.
- Pending freeze acquisition aborts on shutdown, and a manual continuous run
  records interruption without being marked operator-cancelled.
- A scheduled continuous run records interruption, recovers on real process
  restart, and stays cancelled across a further restart after operator Stop.
- Queued announcement work survives a failed predecessor and retains ownership
  until its final callback finishes.

During development, missing shutdown variables in existing VM harnesses and a
missing receiver in the new scheduled fixture caused test failures. The harnesses
now explicitly provide the new lifecycle state, and process fixtures provision a
test-owned receiver. No production guard or assertion was removed to pass tests.

No live appliance, display, integration credential or production data was used.
MQTT is a controlled test adapter; no physical delivery is claimed. Full
presentation conversion, Sports refresh and Ubuntu remote-operation acceptance
under shutdown remain feature-specific follow-ups. Hosted Wiki synchronization
will use the existing workflow after a reviewed merge; this PR updates its mirror.

## Explicit bridge composition follow-up (2026-10-27 UTC)

Baseline: `38db6b8d9bf8fad328fa2639c592b4f739dcca3a`, alpha.85. The ordinary
Windows helper passed against the active candidate, including untracked files.
A final invocation used its unchanged snapshot/check/test procedure and appended
Host Agent Python compilation, Full Recovery unittests and tracked-shell syntax
checks. Both native Linux runs reported 982 tests: **980 passed, 0 failed,
2 root-only ownership skips**. The host suite passed **23 tests**; Python compile,
shell syntax and `git diff --check` passed.

The five new composition scenarios also passed on Windows. An initial harness
used immediate `process.exit()` after closing sockets and hit a Windows libuv
assertion; normal process completion fixed it. The existing atomic SQLite rename
test remains unsuitable for Windows and passed in native Linux. No application
guard or assertion was removed to accommodate either environment.

Loopback tests cover unchanged Express prototypes/unowned apps, idempotent
composition, separate application guards, generated administration routes,
maintenance-token separation, Veyon key/identity transforms, Music Assistant
aliases and async error/drain ownership. Existing canonical-process lifecycle
tests also pass. An old source-text import-order assertion was replaced by this
request-level composition coverage; guarded Veyon GUI checks remain.

No production data or integration services were used by the tests. Docker is
unavailable locally; Compose, both images, scans, Node 22, native platforms and
browser regressions remain the required exact-head CI gates. The operator has
authorized merge/update after these gates, through the exact-main image pair,
operational backup and normal rollback path. Deployment evidence belongs to the
PR's delivery record; these local results do not claim physical acceptance or an
exhaustive audit of integration business logic.

## Export-handler drain follow-up (2026-10-27 UTC)

Baseline: `da6bb77187bd23787239347db903ab842fbc6683`, alpha.85. Three new
canonical-process regressions were run against that unchanged application using
the helper's native Linux snapshot procedure. All three failed at the expected
assertion: export freeze acknowledged while a held HTTP handler could still write.
The fixture registers after real admission middleware and writes through the
actual Hub SQLite instance; it uses only temporary data and loopback connections.

The candidate passed 21 targeted lifecycle/freeze tests. The final full invocation
used `C:\ChatGPT\Workspace\Tools\RoomGoblin-LinuxTests.py` with its unchanged
active-worktree snapshot, `npm run check` and `npm test` procedure, appending Host
Agent Python compile/unittests and tracked-shell syntax checks:

| Check | Actual result |
| --- | --- |
| `npm run check` | Passed |
| `npm test` | 988 tests: 986 passed, 0 failed, 2 root-only ownership skips |
| Host Agent Python compilation | Passed |
| Host Full Recovery unittests | 23 passed, 0 failures/errors |
| Tracked shell scripts, `bash -n` | Passed |
| `git diff --check` | Passed |

Six added tests cover transport closure versus returned-handler lifetime,
rejection cleanup, final SQLite state before freeze acknowledgment, one-use thaw,
the real 30-second acquisition timeout with later completion/retry, the guarded
administrator export proxy with a maintenance fixture, and stable classification
through mounted middleware and async error handlers. Existing shutdown/export
races and automation restart tests still pass. The six tracker tests also pass
on Windows. No guard or assertion was weakened.

GitHub code scanning flagged exception text in the loopback maintenance fixture's
HTTP error body. The fixture now sends fixed plain text and retains the original
exception for the test runner's assertion. All five export process regressions
passed again in native Linux after that test-only correction; the application
implementation is identical to the full-suite candidate above. CI is rerun on
the corrected PR head before merge.

Docker is unavailable locally; Compose, both runtime images, security scans,
Node 22, native platforms and browser regressions remain exact-head CI gates.
The requested merge and update follow those gates and exact-main publication,
with the normal operational backup and rollback path. Delivery evidence belongs
to the PR. No production Full Recovery export, remote integration command or
physical classroom playback is claimed by these tests.

## Media shutdown outcome follow-up (2026-10-27 UTC)

Baseline: `446a9523da9a160bc510e679397269c9097aeb1d`, alpha.85. With only
the new/updated tests applied, the native Linux snapshot reported **25 tests:
16 passed, 9 failed, 0 skipped**. Failures reproduced false-success shutdown
status and premature release of child ownership after signaling errors. The
candidate passed all **25 targeted tests** after the implementation fix.

The final full run used `C:\ChatGPT\Workspace\Tools\RoomGoblin-LinuxTests.py`
with its unchanged active-worktree snapshot, `npm run check` and `npm test`
procedure, appending Host Agent Python compilation, Full Recovery unittests and
tracked-shell syntax checks:

| Check | Actual result |
| --- | --- |
| `npm run check` | Passed |
| `npm test` | 996 tests: 994 passed, 0 failed, 2 root-only ownership skips |
| Host Agent Python compilation | Passed |
| Host Full Recovery unittests | 23 passed, 0 failures/errors |
| Tracked shell scripts, `bash -n` | Passed |
| `git diff --check` | Passed |

Eight added tests and the corrected timeout assertion distinguish clean drain
from unsuccessful child exit. A canonical process keeps an accepted HTTP writer
alive after media SIGKILL, persists its final SQLite write, then exits 1. Unit
tests cover forced termination including a racing zero exit, nonzero/signal
status, emitted/thrown signaling errors, actual reaping and owner-exit fallback.
The existing timeout remains a failure; no deadline, guard or assertion was
weakened to make the tests pass. These tests use temporary data and loopback only.

Code scanning identified missing rate limiting on the test fixture's new file
access. The fixture now admits at most four requests per minute across callers;
all nine writer-drain process tests passed again in native Linux. Production
source is unchanged from the full-suite run above. CI runs on the corrected head.

Docker is unavailable locally. Compose, both runtime images, vulnerability scans,
Node 22, native platforms and browser regressions remain exact-head CI gates.
The user requested push, merge and update after this change; the normal
validated-main publication, operational backup and rollback path remain required.
Delivery and hosted Wiki synchronization are recorded in the PR. No production
fault injection or physical playback acceptance is claimed.

## Discovery admission follow-up (2026-10-27 UTC)

Baseline: `4ca4f7c4fc81a4b53321e88319e7ea5768d4d211`, alpha.85. The corrected
targeted baseline reported **10 tests: 5 passed, 5 failed, 0 skipped**. Four
manager-admission permutations and a canonical administrator request during an
active export freeze failed. Accepted discovery already drained correctly.

An initial test incorrectly expected audit persistence during freeze acquisition.
Reading `audit()` confirmed the existing deliberate buffering policy. The test
now requires no SQLite audit before thaw and persistence afterward. No application
audit behavior was changed, and no snapshot-write defect is claimed.

The final native Linux active-worktree snapshot used
`C:\ChatGPT\Workspace\Tools\RoomGoblin-LinuxTests.py`, retaining its check/test
procedure and appending Host Agent Python compilation, recovery tests and shell
syntax validation:

| Check | Actual result |
| --- | --- |
| `npm run check` | Passed |
| `npm test` | 1003 tests: 1001 passed, 0 failed, 2 root-only ownership skips |
| Host Agent Python compilation | Passed |
| Host Full Recovery unittests | 23 passed, 0 failures/errors |
| Tracked shell scripts, `bash -n` | Passed |
| `git diff --check` | Passed |

Seven new tests cover cold/cached/pending/closed admission, rejection without
worker launch or a deferred success audit, thaw/retry/cache behavior, accepted
discovery through export acquisition, and final audit persistence before shutdown.
The process fixture retains the real manager, guarded route, SQLite and lifecycle
owners while replacing only external mDNS worker IPC. No network scan or device
command is performed. The current UI already surfaces the returned lock error.

Docker is unavailable locally; exact-head CI must qualify both runtime images,
Compose, vulnerability scans, native artifacts and browsers. Push/merge/update
continues through the normal exact-main publication, backup and rollback path;
delivery evidence and hosted Wiki synchronization belong to the PR record.
