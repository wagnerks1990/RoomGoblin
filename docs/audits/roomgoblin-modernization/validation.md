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

## Feature-owner lifecycle coverage (2026-10-27 UTC)

Baseline: `a2c78bb03ff1567c9bf69318000bbc81b9d41a88`, alpha.85. Seven new
canonical-process tests pass against unchanged runtime code. They cover accepted
Sports refresh, Ubuntu scheduled acknowledgment and presentation conversion across
shutdown and export freeze, plus conversion deadline/restart/rebuild behavior.
No new runtime defect is claimed by this test-only follow-up.

The mandated `RoomGoblin-LinuxTests.py` active-worktree snapshot included all four
new test/fixture files. Targeted checks: **7 passed, 0 failed, 0 skipped**.
Full native Linux validation: `npm run check` passed; `npm test` reported
**1010 tests: 1008 passed, 0 failed, 2 root-only ownership skips**. Host Recovery
reported **23 passed**. Host Python compilation, tracked shell syntax and
`git diff --check` passed. The Sports timer runs at its real 15-second interval;
the interrupted conversion uses the real ten-second shutdown deadline.

Feed/SSH/rasterizer adapters are controlled fixtures, while the canonical Hub,
routes, managers, SQLite, filesystem publication, freeze/thaw and shutdown remain
real. This does not qualify external services, hardware commands or rendered
slide quality. Docker remains unavailable locally; exact-head CI qualifies the
runtime images, scans, native artifacts and browsers before merge/publication.

## Read-side housekeeping freeze (2026-10-27 UTC)

Runtime baseline: `a2c78bb03ff1567c9bf69318000bbc81b9d41a88`; the local
test-only parent `ee97d7a90ac6d6766d721eec6a290afae8fdd290` has identical
application source. Four initial authentication regressions reported **0 passed,
4 failed**: session cleanup, device credential timestamps and a canonical Hub
GET advancing activity after freeze acknowledgment. After the authentication fix,
a delayed update-status response reproduced the separate history-write gap
(**5 tests: 4 passed, 1 failed**). All use temporary data.

The final mandated native Linux active-worktree snapshot includes both fixes and
five new regressions. `npm run check` passed; `npm test` reported **1015 tests:
1013 passed, 0 failed, 2 root-only ownership skips**. Host Recovery: **23 passed**.
Host Python compilation, tracked-shell syntax and `git diff --check` passed.
The intermediate authentication/storage/freeze subset passed **13 tests**.

SQLite `query_only` catches unintended writes during paused authentication reads.
Expiry, revocation, disabled receivers, invalid tokens, session-list filtering,
cleanup throttling and post-thaw persistence are asserted. Canonical Hub tests
exercise actual admin reads and a maintenance response held across freeze; later
status polls record one history entry without duplicates. No production freeze,
credential change or external device command was used for regression testing.

Exact-head CI still qualifies Compose, both images, image/security scans, native
artifacts and browsers. Published-main deployment, health/identity verification,
operational backup and rollback evidence are recorded in the PR after delivery.

## Veyon read-side identity freeze (2026-10-27 UTC)

Baseline: `c74d6417fd14bf1773829002f4c472543141887f`, alpha.85. The initial
canonical empty-inventory regression failed (**0 passed, 1 failed**): a GET wrote
`veyon.inventory-hostmap.v2` after the export freeze acknowledged. The candidate
includes three process regressions. The targeted freeze/bridge subset passed
**10 tests, 0 failed, 0 skipped**. Initial fixture assertions were corrected to
use the existing 401 authentication response and a hostname-bearing computer;
neither required a runtime change or weakened the snapshot assertion.

The mandated native Linux active-worktree helper verified the modified files and
both new test/fixture files. `npm run check` passed. Full `npm test`: **1018 tests,
1016 passed, 0 failed, 2 root-only ownership skips**. Host Recovery: **23 passed**.
Host Python compilation, tracked shell syntax and `git diff --check` passed.

Coverage includes new GET/HEAD admission, Express case/trailing-slash aliases,
administrator key/config projections, maintenance inventory, token-protected
maintenance config availability, and a held accepted inventory persisting its
stable mapping before freeze acknowledgment. Only the synthetic computer's TCP
probe is controlled; no real workstation or Veyon command is contacted. Normal
identity projection and post-thaw access remain exercised. Docker is unavailable
locally; exact-head CI must still qualify Compose/images, scans, native artifacts
and browsers. Merge, publication and appliance update evidence belong to the PR.

## Interrupted presentation staging (2026-10-27 UTC)

Baseline: `acd537731f1e9eb08d8f7937003ccd1c287fbb6d`, alpha.85. Extending the
existing real ten-second conversion/deadline test reproduced persistent private
render staging after restart (**0 passed, 1 failed**). The original remains
preserved; the added failure concerns orphan staging, not source loss.

The candidate targeted lifecycle/content-permission/staging subset reported
**19 tests: 17 passed, 0 failed, 2 root-only ownership skips**. It covers source
preservation and rebuild after restart, recognized-directory cleanup, unknown
entries, linked roots/directories, nested symbolic/hard links, whole-tree
validation and bounded scan/candidate/node budgets.

The mandated native Linux active-worktree helper included both new files and
all modifications. `npm run check` passed; full `npm test`: **1023 tests,
1021 passed, 0 failed, 2 root-only ownership skips**. Host Recovery: **23 passed**.
Host Python compilation, tracked-shell syntax, the new module's syntax check and
`git diff --check` passed. Rendering uses a controlled external adapter; no
physical receiver or live appliance fault injection was performed. Docker remains
unavailable locally; exact-head CI, publication and normal backed-up deployment
must complete before claiming external delivery.

## Detached Veyon cleanup ownership (2026-10-27 UTC)

Baseline: `42fa368794b14c9bda80565ac66ae9c69c2a07f7`, alpha.85. Three canonical
process regressions reproduced lost shutdown/freeze ownership and idle cleanup
admission during a freeze (**0 passed, 3 failed**). A first candidate run exposed
incorrect test JSON-path expressions; correcting those expressions required no
runtime change. The final cleanup/read-freeze subset passed **6 tests**.

The mandated native Linux active-worktree helper included both new test files
and all modifications. `npm run check` passed; full `npm test`: **1026 tests,
1024 passed, 0 failed, 2 root-only ownership skips**. Host Recovery: **23 passed**.
Host Python compilation, tracked-shell syntax and `git diff --check` passed.
Tests run the real 15-second idle timer and canonical application, controlling
only the external WebAPI transport and cached connection age. No physical
computer is contacted. Docker remains unavailable locally; exact-head CI,
publication and normal appliance update remain separate delivery gates.

## Lab socket disconnect persistence (2026-10-27 UTC)

Baseline: `58524737cf434d220f271a27998d7e1369212657`, alpha.85. Both initial
canonical regressions failed (**0 passed, 2 failed**): disconnect writes changed
the acknowledged snapshot, and an older socket stamped its live replacement.
The final targeted subset passed **7 tests**, covering those cases, acquisition
abort, deferred persistence retry and explicit shutdown failure on a persistent
SQLite error, plus existing freeze/authentication checks.

The mandated native Linux helper validated the active worktree including the new
lab regression file. `npm run check` passed; full `npm test`: **1031 tests,
1029 passed, 0 failed, 2 root-only ownership skips**. Host Recovery: **23 passed**.
Host Python compilation, tracked-shell syntax and `git diff --check` passed.
Enrollment uses a real canonical Hub, temporary credentials and loopback sockets;
no real Windows agent, workstation command or student data is involved. Docker,
browser/native qualification, publication and live delivery remain CI/deployment
gates. The separate startup-reconciliation reproduction is not part of this run.

## Startup reconciliation admission (2026-10-27 UTC)

Baseline: `9873450f9a3fcbd6855938004b1509003fce1eb5`, alpha.85. The canonical
startup regression failed (**0 passed, 1 failed**) because the real five-second
callback added recovered/running ledger rows inside an acknowledged freeze.
The targeted lifecycle/automation subset passed **24 tests**. A final duplicate
admission guard was included in the full run.

Native Linux active-worktree verification passed `npm run check`; full `npm test`
reported **1032 tests, 1030 passed, 0 failed, 2 root-only ownership skips**.
Host Recovery: **23 passed**. Host Python compilation, tracked-shell syntax and
`git diff --check` passed. The test waits for actual startup and scheduler timers,
checks unchanged frozen state, post-thaw current-winner recovery and clean stop.
Its synthetic receiver has no connected display. The new Sports-import
reproduction files were added after the helper captured this snapshot and are
not part of these results. CI and final appliance delivery remain separate gates.

## Sports import callbacks and final lifecycle suite (2026-10-27 UTC)

Baseline: `b49c164e10bb1084a25dfd2af572d20f7b5336e1`, alpha.85. All four initial
canonical callback regressions failed (**0 passed, 4 failed**): after browser
disconnect, shutdown/freeze finished before the held PDF-processing adapter.
Both successful and failed processing now remain owned. The targeted lifecycle,
real PDF isolation and Sports authorization subset passed **10 tests**.

The mandated native Linux helper validated all active source/test modifications
and both new fixture/test files. `npm run check` passed. Final full `npm test`:
**1036 tests, 1034 passed, 0 failed, 2 root-only ownership skips**. Host Recovery:
**23 passed**. Host Python compilation, tracked-shell syntax and `git diff --check`
passed. The final run also includes malformed/oversized multipart error coverage
and all Veyon cleanup, lab disconnect and startup reconciliation regressions.

The import fixture controls only the processing adapter; real parser tests retain
their Linux resource/queue checks. No student roster, connected receiver or live
workstation is used. Final audit prose was reconciled after the helper snapshot;
runtime and test files were unchanged. Docker remains unavailable locally; CI,
immutable publication and the backed-up appliance update must finish before
claiming delivery of this final lifecycle patch set.

### CI fixture-key correction

CodeQL check `121994239360` on PR #271 head
`7eff0e285180a8b1a490773e8f7efed8afde84df` correctly rejected the cleanup fixture's
generated 1024-bit RSA key. The fixture now generates 2048 bits. No production
key, scanner rule, exclusion, security policy or application source was changed.

The corrected active-worktree full rerun passed: **1036 tests, 1034 passed,
0 failed, 2 root-only ownership skips**, plus **23 Host Recovery tests**.
`npm run check`, Host Python compilation, tracked-shell syntax and diff checks
also passed. The corrected pushed head still requires fresh CodeQL and all
required PR gates before merge; the earlier failed check is not a passing result.


## Core lifecycle delivery closure (2026-10-27 UTC)

PRs #269-#271 completed all PR/main checks and exact image publication. The normal
published-main update completed at 04:10:31 UTC with source/Hub image
`40b88c197b2e4d4dbed448348a9d1a9805949dbf`. Maintenance retained its healthy
`20f8c501916f34e17bee2c643434e7cce0c919e6` image and container identity.
Post-update checks verified clean main, both control/media health endpoints,
canonical SQLite integrity, all eight encrypted secrets, required file/ADB
permissions, maintenance authorization boundaries, no pending update request,
and rollback to the prior deployment. The new operational archive passed checksum,
ZIP CRC and extracted canonical SQLite checks. No physical classroom command or
production fault injection was performed. See PR #271 for the delivery receipt.

## Shared frontend and navigation (2026-10-27 UTC)

Source baseline: `40b88c197b2e4d4dbed448348a9d1a9805949dbf` plus the active worktree
patch. The native Linux helper captured tracked and new files from this worktree.
Final source changes were included in the following runs; later edits recorded
only these results and review notes.

| Check | Result |
| --- | --- |
| `npm run check`, including 16 controller scripts | Passed |
| Full `npm test` on native Linux | 1,038 tests: 1,036 passed, 0 failed, 2 root-only ownership checks skipped |
| Host Agent Full Recovery Python suite | 23 passed |
| Host Python compilation and all tracked shell syntax | Passed |
| Chromium full browser discovery with locked PDF.js and packaged fonts | 115 passed, 0 failed |
| Firefox full browser discovery with locked PDF.js and packaged fonts | 115 passed, 0 failed |
| `git diff --check` | Passed |
| Default light/dark phone/desktop screenshot review | Corrected mixed theme background, unreadable brand/headings and account field focus spacing |

The browser suites run real bundled HTML/CSS/JS with deterministic API/WebSocket
fixtures. New coverage exercises account/login focus, session-loss navigation,
light/dark/system-light body and semantic contrast, enrollment JSON downloads,
opaque-token quoting, HTTPS/LAN fallback and updater settings bindings. Existing
navigation, embedded-session, receiver and feature regressions remain enabled.

The first broad browser attempt omitted `npm ci` in its temporary snapshot:
110 cases passed but the document suite setup failed because PDF.js was absent.
All five document cases passed after installing the locked graph; final browser
discovery includes that dependency setup. The first full Node attempt reported
1,034 passed, 1 failed and 2 skipped. Its startup-recovery timeout passed in
isolation; a deterministic test then reproduced the polling helper's premature
expiry on a forward wall-clock correction. Monotonic timing fixed the helper
without extending its ten-second budget. Final full-suite results are above.

Docker is unavailable in the local Windows/WSL environment. Compose, both runtime
images, image vulnerability qualification and platform artifacts remain required
CI checks before merging; local checks do not substitute for those gates.
Appliance delivery is pending exact-main image publication and will be recorded
in the PR after the normal updater and post-update integrity checks complete.


## Today and live-display monitoring (2026-10-27 UTC)

Source baseline: `b3ba0afb2c06f12df7be8ff98c3953cfd00f6957` plus the active worktree.
The first three baseline browser tests reproduced the blocked optional probe,
lost inventory and replaced preview/focus (two assertions and one timeout).
The corrected focused Today and AV matrix run passed **18 tests**. Controller
syntax/symbol checks passed. Final active-worktree snapshot results:

| Check | Result |
| --- | --- |
| `npm run check` and full native Linux `npm test` | 1,038 total: 1,036 passed, 0 failed, 2 root-only ownership skips |
| Host Agent Full Recovery Python suite | 23 passed |
| Host Python compilation and tracked Bash syntax | Passed |
| Chromium full browser discovery | 123 passed, 0 failed |
| Firefox full browser discovery | 123 passed, 0 failed |
| Final current-tree Today check | 8 passed after restoring the unchanged Settings heading |
| Controller symbol/syntax and `git diff --check` | Passed |

All logic and test changes were included in the full snapshots. After capture,
one unrelated Settings heading was restored to its baseline text; the corrected
current tree passed the eight Today browser cases and controller validation.
Later edits only record audit and delivery evidence. Phone screenshot inspection
confirmed no horizontal overflow and visible unavailable/disabled states.

The first broad browser attempt caught the new card's `data-display-id` collision
with existing receiver-editor selectors. Today now uses `data-overview-id`; the
existing AV regression was retained and passes unchanged. The superseded broad
run was stopped after reproducing the collision; a new complete run uses the
corrected snapshot. Screenshot inspection also removed a leftover loading marker.
The first Node suite passed, but the supplemental Host Recovery command selected
the wrong directory and found zero tests. That command failed rather than claiming
coverage. The final run selects `host-agent/test_full_recovery.py` explicitly.

Docker is unavailable locally. Required CI retains Compose, runtime image builds,
vulnerability scans and native artifact qualification. Deployment remains pending
reviewed merge, exact image publication and the normal backed-up update. Tests use
transport fixtures; no physical display, TV power or classroom command was issued.


## Shared frontend delivery closure (2026-10-27 UTC)

All PR/main gates, Wiki sync and immutable publication passed. The normal updater
completed at 05:08:42 UTC on clean main/Hub image
`b3ba0afb2c06f12df7be8ff98c3953cfd00f6957`. Maintenance retained the healthy
`20f8c501916f34e17bee2c643434e7cce0c919e6` container; both containers report zero
restarts. Control/media health, Hub readiness, Host Agent health, canonical SQLite,
eight encrypted secrets, DB/ADB permissions and maintenance authorization checks
passed. Served enrollment/updater/shared-style asset hashes match merged source.
The operational backup passed journal checksum, ZIP CRC, canonical-only database
contents and extracted SQLite checks. No request remains pending; rollback to
`40b88c197b2e4d4dbed448348a9d1a9805949dbf` is available. PR #272 records the backup
identity and checksum. No physical classroom action or fault injection occurred.


## Display receiver browser runtime (2026-10-27 UTC)

Finding baseline: `b3ba0afb2c06f12df7be8ff98c3953cfd00f6957`. Final qualification
snapshots include merged Today commit `e7534eced5a8a803f524e46e7667f06bc7ab5deb`
and the active receiver patch. The four baseline browser regressions all failed;
focused corrected runs passed nine audio/receiver cases and seven final cases.

| Check | Result |
| --- | --- |
| Native Linux `npm run check` and full `npm test` | 1,038 total: 1,036 passed, 0 failed, 2 root-only ownership skips |
| Host Agent Full Recovery suite | 23 passed |
| Host Python compilation and tracked Bash syntax | Passed |
| Focused receiver/layout source-policy checks | 12 passed |
| Full Chromium browser discovery | 127 passed, 0 failed |
| Full Firefox browser discovery | 127 passed, 0 failed |
| Changed-file UTF-8 and line-ending inspection | Passed |

The first broad Node run reported 1,035 passes, one failure and two skips because
an existing source-contract test expected the previous playback signature/session
literal. Both old browser snapshots reported 115 passes and four failures out of
119, all at old renderer-revision assertions. The expectations now match the new
explicit-play signature, persistent session and required cache identity. Geometry
and behavioral assertions remain intact. Fresh complete runs use the current tree.

Two rendered fixture screenshots were visually inspected: body/title/timer
containment remains readable, including the timer-only layout. The latter fixture
contains an unavailable background image; it is not claimed as image-load acceptance.
CI still owns local-unavailable Docker/Compose, image scans and native platform
artifacts. Merge, Wiki sync, exact image publication and normal backed-up deployment
remain open until their actual receipts are recorded. No physical receiver reload,
classroom command or fault injection was performed.


## Today delivery closure (2026-10-27 UTC)

All PR/main gates, Wiki sync and exact image publication passed for PR #273.
The normal updater completed at 05:38:34 UTC on clean main/Hub image
`e7534eced5a8a803f524e46e7667f06bc7ab5deb`. The healthy maintenance container
remained at `20f8c501916f34e17bee2c643434e7cce0c919e6`. Control/media/Host Agent
health, readiness, canonical SQLite, eight secret decryptions, DB/ADB permissions,
authorization and served asset hashes passed. The backup passed journal checksum,
ZIP CRC, canonical-only database and extracted SQLite checks. Previous-deployment
rollback is available, with no pending request. PR #273 holds the full receipt.
No physical classroom commands or fault injection occurred.

## Displays & AV operator workspace (2026-10-27 UTC)

Finding baseline: `e7534eced5a8a803f524e46e7667f06bc7ab5deb`. Final full snapshots
include receiver merge `ed8135b9bd8fd9f340a6360611a7db2767da08e4` and the AV patch.
Seven initial regressions failed against the baseline. Additional cases cover
changed-status focus retention, permissions, special dictionary keys, modal
handoff and malformed responses; these are not all claimed baseline failures.

| Check | Result |
| --- | --- |
| Native Linux `npm run check` and full `npm test` | 1,038 total: 1,036 passed, 0 failed, 2 root-only ownership skips |
| Host Agent Full Recovery suite | 23 passed |
| Host Python compilation and tracked Bash syntax | Passed |
| Full Chromium browser discovery | 140 passed, 0 failed |
| Full Firefox browser discovery | 140 passed, 0 failed |
| Final current-tree AV/Today qualification, Chromium | 31 passed, 0 failed |
| Final current-tree AV/Today qualification, Firefox | 31 passed, 0 failed |
| Controller syntax and symbol ownership | 17 scripts passed |

After the full snapshots were captured, setup's receiver-ID blur listener gained
visible error handling, and its invalid-ID test changed from a direct function
call to a real Save click. The final 31-case runs cover those current-tree changes
in both engines. Other later edits record evidence only. A phone drawer screenshot
was visually inspected; source controls remain readable and accessible.

Docker is unavailable locally. CI must complete Compose, image builds/scans and
native platform qualification before merge/publication. Backend aggregate probe
ownership remains RG-AV-010 in this same review unit. No physical routing, TV
power, receiver reload or production fault injection was performed.


## Receiver delivery closure (2026-10-27 UTC)

PR #274 passed all PR/main gates, Wiki sync and exact image publication. Normal
backed-up deployment completed at 05:59:48 UTC on clean main/Hub image
`ed8135b9bd8fd9f340a6360611a7db2767da08e4`, retaining healthy maintenance at
`20f8c501916f34e17bee2c643434e7cce0c919e6`. Both containers have zero restarts.
Health/readiness, canonical SQLite, eight secret decryptions, DB/ADB permissions,
authorization and served receiver/layout/editor hashes passed. The backup passed
journal checksum, ZIP CRC, canonical-only database contents and SQLite checks.
Rollback to `e7534eced5a8a803f524e46e7667f06bc7ab5deb` is available. PR #274 records
the full receipt. Physical receiver browsers were not forcibly reloaded.

## Displays & AV backend reads (2026-10-27 UTC)

The two baseline regressions failed against `ed8135b9bd8fd9f340a6360611a7db2767da08e4`:
three readers made 18 hardware calls, and a stalled scan continued through six
probes. The corrected owner shares six reads and stops the stalled scan at its
aggregate deadline. Tests use deterministic adapters plus real loopback HTTP for
stalled response bodies and disconnected-reader ownership.

| Check | Result |
| --- | --- |
| Focused transport, TV-power sequence/recovery and command validation | 84 passed, 0 failed |
| Final native Linux `npm run check` and full `npm test` | 1,051 total: 1,049 passed, 0 failed, 2 root-only ownership skips |
| Host Agent Full Recovery suite | 23 passed |
| Host Python compilation and tracked Bash syntax | Passed |
| Combined current-tree transport/workspace composition | 16 passed |
| Combined current-tree AV/Today browser tests, Chromium | 31 passed |
| Combined current-tree AV/Today browser tests, Firefox | 31 passed |
| Controller syntax and symbol ownership | 17 scripts passed |

The earlier full backend snapshot passed 1,047 tests plus two skips. The final
snapshot adds standalone named-read budgets and the unconfigured-matrix fast
failure. It contains the receiver merge and all final backend code/tests. The
independent AV workspace merge `d3c41b1217ad14e2d896bc28fe239c0072b6e7d0` was then
fast-forwarded into this branch, and the combined checks above passed. That
workspace had already passed 140 browser tests in each engine and all 14 PR gates.
No code changed after the combined checks; later edits record evidence only.

An initial Windows focused run exposed an existing LF-only source delimiter
against the CRLF checkout. Normalizing the edited server to LF restored that
unchanged test; all 84 focused cases then passed. No assertion was weakened.
Docker remains unavailable locally. CI owns Compose, both image scans/builds and
native artifacts before checked merge/publication. No physical AV command,
receiver reload or production fault injection was performed.


## AV workspace delivery closure (2026-10-27 UTC)

PR #275 passed all 14 PR checks and all five main workflows, including Wiki sync
and exact image publication. The normal backed-up update completed at 06:18:09 UTC
on clean main and Hub image `d3c41b1217ad14e2d896bc28fe239c0072b6e7d0`.
Maintenance retained its healthy `20f8c501916f34e17bee2c643434e7cce0c919e6`
container; both containers have zero restarts. Health/readiness, canonical SQLite,
eight secret decryptions, DB/ADB permissions, authentication, served AV/controller/
setup asset hashes and deployment-input checks passed. The operational archive
passed journal checksum, ZIP CRC, canonical-only database and extracted SQLite
checks. Rollback to `ed8135b9bd8fd9f340a6360611a7db2767da08e4` remains available.
PR #275 records the backup name, size and SHA-256. No physical command or receiver
reload was issued.


## AV redirect and privileged-configuration qualification (2026-10-27 UTC)

A real loopback 307 regression failed before the redirect correction. It now
passes for both a status read and a route write, with zero requests reaching the
redirect destination. The full active-worktree native Linux snapshot passed
**1,053 tests: 1,051 passed, 0 failed, 2 root-only ownership skips**, plus
**23 Host Recovery tests**. `npm run check`, Host Python compilation and tracked
Bash syntax passed. The snapshot includes the final runtime redirect policy.

The authorization fixture was then extended to include the teacher/operator
profile. The final current-tree transport, real-Hub HTTP and bridge suites passed
**55 tests, 0 failed**, plus 23 Host Recovery tests and syntax checks. This covers
anonymous/viewer/operator denial, maintenance-token rejection on the admin route,
and the separate internal maintenance token boundary. No runtime code changed
after the full snapshot. CodeQL alert 415's privileged configuration flow was
reviewed and classified as a false positive with this evidence; the independently
reproduced redirect forwarding defect was corrected. Security rules and required
gates remain unchanged; fresh CI is required for the corrected head.

The initial Windows transport/HTTP attempt passed 14 transport cases; all 36
real-Hub cases failed their shared startup hook because Windows lacks the Linux
`fchmod` contract. Native Linux ran those tests successfully. No permission check
or assertion was weakened. Documentation, Wiki mirror and delivery receipts were
updated after qualification; `git diff --check` passed.

## Legacy TV scheduler qualification (2026-10-27 UTC)

Baseline `9c15339776e6193b2002a1fccbd0c1e7cbd6f37a` fails seven of the eleven
legacy scheduler regression fixtures; four behavior controls pass. The corrected
focused suite passes all **91 tests** across legacy scheduling, canonical TV power,
recovery and bounded Pluto transport. Tests execute the actual timer/tick, physical
lock helper and application writer-drain predicate with controlled adapters.

The required Windows-to-native-Linux helper tested the active worktree snapshot:
**1,064 tests: 1,062 passed, 0 failed, 2 root-only ownership skips**, plus
**23 Host Recovery tests**. Node/controller checks, Host Python compilation and
tracked Bash syntax passed. The snapshot includes the final admission-retry and
writer-drain fixtures. Docker is unavailable locally; required CI still owns
Compose, both image builds/scans and native artifacts. No physical CEC command,
receiver reload or production fault injection was performed. Merge, Wiki sync,
exact image publication and the normal backed-up update remain pending.


## Scheduler timing and task ownership (2026-10-27 UTC)

Baseline `d3c41b1217ad14e2d896bc28fe239c0072b6e7d0`. Two initial cycle regressions
failed: zero-delay passes had no one-second floor and a timer could not request
cancellation. An independent clock regression reproduced a one-second wait
extending to 3,601 seconds after a backwards correction. Six ownership regressions
reproduced stale task/metadata entries after ledger/final-save failures; two
hold/interruption controls passed before the fix. A ninth ownership case verifies
failed admission persistence cannot cancel prior accepted work.

| Check | Result |
| --- | --- |
| Focused timing, ownership, manual and TV-power boundaries | 94 passed |
| Initial timing-only native full suite | 1,047 total: 1,045 passed, 0 failed, 2 skipped |
| Intermediate ownership full suite | 1,056 total: 1,053 passed, 1 source-location assertion failed, 2 skipped |
| Corrected final native full suite | 1,056 total: 1,054 passed, 0 failed, 2 root-only ownership skips |
| Final Host Recovery / syntax checks | 23 passed; Node/controller, Host Python and tracked Bash checks passed |
| Combined current tree after checked AV merge | 125 native tests and 23 Host Recovery tests passed; syntax passed |

The intermediate assertion was updated to follow registry insertion through the
new owner and still reject blocking dispatch; executable task/drain regressions
remain authoritative. The final full snapshot includes all scheduler runtime and
tests on `d3c41b1`; combined qualification follows AV merge `9c15339`. The adjacent
import conflict was resolved by retaining both independent imports. CI still owns
full combined coverage, Docker/Compose, runtime scans and native artifacts.

Windows broad execution had 100 passed and one Linux permission-mode failure.
Native Linux passed that assertion without weakening it. Documentation changed
after snapshots only to record evidence; no physical classroom testing is claimed.
PR #276's final alert 416 repeated the reviewed privileged destination flow after
the redirect line changed; its 27-node SARIF trace was rechecked and classified
with the same evidence as alert 415. All 14 PR gates then passed and #276 merged.

## Legacy scheduler integration with checked main (2026-10-27 UTC)

PR #277 merged as `70ad1c8e6dbcf2e824746d25af8142dc88c363ea` after all 14 checks
passed. Its integration into the legacy scheduler branch merged source cleanly;
documentation overlaps were resolved by retaining both contracts and evidence.
The combined active-worktree native suite passed **136 focused tests**, plus
**23 Host Recovery tests**, Node/controller checks, Host Python compilation and
tracked Bash syntax. Fresh CI must validate the combined head before merging.
AV backend PR #276 is deployed and verified on `9c15339`; its PR records the full
health, identity, backup-integrity and rollback receipt. PR #277 delivery is pending.


## Scheduled sequence simulation qualification (2026-10-27 UTC)

Five of seven new permission fixtures failed against the qualified PR #277 head;
the two manual/live/real-time controls passed. The actual runner and real
SchedulerClock permission implementation now pass all **91 focused tests**.
The full active-worktree native Linux snapshot passed **1,078 tests: 1,076 passed,
0 failed, 2 root-only ownership skips**, plus **23 Host Recovery tests**,
Node/controller checks, Host Python compilation and tracked Bash syntax.
The checked squash merge of PR #277 has the identical tree; reapplying this
patch on it changed no runtime or test content. Docker/Compose/images/artifacts
remain CI qualifications. No physical command or production fault injection was
used. CI, checked merge, Wiki sync, exact images and appliance delivery are pending.


## AV backend delivery closure (2026-10-27 UTC)

PR #276 passed all 14 PR checks and all five main workflows, including Wiki sync
and exact image publication. The normal backed-up update completed at 06:51:07 UTC
on clean main and Hub image `9c15339776e6193b2002a1fccbd0c1e7cbd6f37a`.
Maintenance retained its healthy `20f8c501916f34e17bee2c643434e7cce0c919e6`
container; both containers have zero restarts. Health/readiness, canonical SQLite,
eight secret decryptions, DB/ADB permissions, authentication boundaries, served
operator asset hashes and deployment inputs passed. The backup passed journal
checksum, ZIP CRC, canonical-only database and extracted SQLite checks. Rollback
to `d3c41b1217ad14e2d896bc28fe239c0072b6e7d0` remains available.
PR #276 records the archive name, size and SHA-256. No physical command or receiver
reload was issued. Scheduler timing/ownership subsequently merged in PR #277 as
`70ad1c8e6dbcf2e824746d25af8142dc88c363ea`; its deployment is pending.
