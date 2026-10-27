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

Docker is unavailable locally; Compose, both runtime images, security scans,
Node 22, native platforms and browser regressions remain exact-head CI gates.
The requested merge and update follow those gates and exact-main publication,
with the normal operational backup and rollback path. Delivery evidence belongs
to the PR. No production Full Recovery export, remote integration command or
physical classroom playback is claimed by these tests.
