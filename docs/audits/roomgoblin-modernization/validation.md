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

The broader writer-drain and bridge-composition review remains open; see
[the coverage and findings](core-lifecycle.md).
