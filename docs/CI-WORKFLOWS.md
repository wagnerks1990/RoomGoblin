# GitHub Actions validation and publication

Six workflows have distinct responsibilities:

| Workflow | Required work |
| --- | --- |
| Validate | Locked dependency audits, syntax, Node/Python regressions, Windows parsing/native artifact qualification, Android debug APK, restrictive-context Hub build, maintenance build, two Trivy scans and appliance smoke tests |
| Display browser regression | Chromium and Firefox receiver/operator regression tests |
| Security gates | Full-history secret scan; PR dependency review at moderate severity |
| Publish Main Images | Start on every `main` push, wait for all three exact-SHA validation workflows, publish exact-revision Hub/maintenance images and refresh alpha aliases without a deployment branch |
| Publish Containers | Verify semantic version/main ancestry and required checks, then promote the published SHA pair to release tags and create the release |
| Sync Wiki | Synchronize the tracked mirror on relevant changes or manual dispatch |

The duplicate Windows workflow has been removed: its nonempty four-executable
checks, ProductVersion verification and downloadable native package now run in
the existing required `windows-agent` job after its single locked build. Artifact
retention is bounded to 14 days. The obsolete branch-patching workflow and its two
source-rewriting helpers have been retired; source changes belong in reviewed PRs.

Before packaging, the Windows job also runs
`python tools/test-native-command-process.py` on .NET 8. It compiles the actual
native process helper with nine isolated cases covering success, failure detail,
pre-cancelled admission, cancellation, deadlines, descendants, inherited output
pipes and bounded retained output. `python tools/test-native-update-transfer.py`
also runs ten actual-client cases for valid/fallback packages, cancellation,
the real 45-second body deadline, invalid lengths/hashes and staging cleanup.
These tests do not install or start the RoomGoblin agent service; Windows trust
verification is replaced only in the transfer fixture, after real SHA-256 checks.
`python tools/test-native-connection.py` additionally exercises five actual-source
loopback cases for primary preference, the real 15-second handshake deadline,
caller/pre-cancelled admission and errors from all configured origins. It sends
no enrollment credential and does not test certificate trust or the live Hub.
`python tools/test-native-lifecycle-process.py` adds 36 cases across the actual
bootstrap/updater helpers: both real 30-second defaults, retained/error output,
capture/argument/exit-code compatibility, inherited pipes and confirmed-stop
polling. Service queries are replaced with controlled outcomes; owned child
processes run only inside the temporary fixture. No service is installed or
controlled by these tests. Eight included install-owner cases use temporary
package/config files and simulated service/task operations to cover legacy
admission failures, fresh-config cleanup and unsafe-stop rollback refusal.
`python tools/test-native-legacy-state.py` adds 24 Windows cases for
registered enabled/missing state, lookup errors, a real 30-second admission
deadline, COM object release and installer rollback/disable decisions. COM and
service/task mutations use fixtures. One read-only probe checks a unique absent
task through the real Windows COM interface; no task is created, enabled or run.
That probe is skipped on non-Windows hosts; the remaining 23 cases still run.
`python tools/test-native-enrollment-identity.py` adds ten cases against the
actual Install body and configuration writer: existing/empty identity admission,
one-use file admission, fresh success/failure, atomic publication collisions and
prepublication ACL failures. File operations use temporary fixture roots; DPAPI
and ACL execution are substituted. These cases verify protection dispatch and
identity preservation, not Windows cryptography or effective ACLs.

## Conservative documentation-only PR selection

`tools/ci-scope.py` skips expensive image, native/Android build and browser steps
only for pull requests into `main` whose complete Git diff changes allowlisted
Markdown files under `docs/` or `wiki/`, or the six named root documentation files.
The jobs and required check names still execute. Root/maintenance locked installs
and online moderate-severity audits, full Node contracts, JavaScript/PowerShell/
Python/shell syntax, Host Agent tests, Compose policy, full-history secret scanning
and dependency review remain enabled. Documentation is still executable policy
input for the Node suite and never bypasses those tests.

Every main push, release/manual/unknown event, empty/unreadable diff, failed fetch,
unknown path, workflow/tool/test/configuration/lockfile/version/source change uses
full qualification. Renames are expanded into their old and new paths so moving
source under docs cannot hide a source change; source deletions also run full.
Fork PRs receive only the normal read-only token and the same path rules. There
are no workflow-level path filters and no new write permission or local transcript
accepted as a GitHub success check. Executable scope tests cover these fallbacks.

Codex Local/WSL/Cloud should run supported checks before pushing and fix failures
there. Hosted main qualification and exact image scans remain independent; local
tests do not replace native Windows execution, browser engines, current advisory
checks or release provenance. The earlier measured duplicate Windows job cost
about 1.88 runner-minutes per eligible event; its removal avoids that extra build.
Documentation-only savings depend on the changed-file mix and runner overhead;
measure new hosted runs before claiming exact time or billing reductions.

Android debug validation moved into Validate without dropping its APK artifact or
checksum verification. The restrictive-context build is now the Hub image used
by Validate's scans and smoke tests; its separate duplicate workflow was removed.
The direct HTTP smoke test tags the already built/scanned images locally instead
of invoking another Compose build. `npm test` already includes the Full Recovery
contract; `npm run check` already includes controller syntax validation.

Semantic release publication no longer repeats Node tests and builds four more
images. It promotes the existing validated main pair, retaining the published
manifest identity. Main publication builds and verifies exact candidates after
validation. Both canonical and legacy compatibility aliases remain. A release
is created only after both release image aliases have been promoted successfully.

The current main publisher loads Docker candidates locally and pushes those exact
scanned images; explicit SBOM/provenance output is not configured in the workflow.
Do not treat attestation availability as established without inspecting the
published manifests.

## Cache-only optimization audit

The [October 2026 audit](CI-OPTIMIZATION-AUDIT.md) inventories every workflow/job,
live readable rulesets, measured run data, exact retained coverage and deferred
proposals. The readable main ruleset requires `validate` and `windows-agent`;
all three full validation workflows remain mandatory publication prerequisites.
Classic branch protection and Actions-permission settings were inaccessible.

Validate's npm cache key includes both root and maintenance lockfiles. The native
Windows build job caches global NuGet packages using all four locked dependency
graphs. Clean npm installs and online audits always run. Full qualification keeps
locked .NET restores, tests, artifacts, both browser engines and image scans.
No path selection or scheduling change applies to main qualification, and no
required check or publication workflow identity changes.

Obsolete PR runs are cancelled by PR number. Main runs use commit-specific groups
and are never cancelled by a newer commit while publication waits on them. Jobs
have finite timeouts. Wiki writes are serialized and refresh stale source before
syncing. Security checks, both browser engines, APK build/signing-contract coverage,
immutable revision checks and main image-pair gating are not optional.

## Main publication trigger and exact-SHA gate

`Publish Main Images` is a direct `push` workflow on `main`. It does **not** depend
on a `workflow_run` payload from Validate. This removes the class of failures where
a valid merge is validated but publication is skipped because optional or changed
upstream workflow payload metadata does not satisfy the publisher's job-level
condition.

The direct trigger does not weaken validation. The publisher fails closed:

- `VALIDATED_SHA` is exactly `${{ github.sha }}` from the `main` push;
- the gate polls Actions for that exact SHA with `event=push`;
- `Validate`, `Display browser regression`, and `Security gates` must all report
  `success` for that SHA;
- failure, cancellation, timeout, action-required, stale, or skipped state blocks
  publication;
- immutable Hub and maintenance images are labeled with the same exact Git SHA;
- both canonical and legacy aliases are built as one validated pair;
- mutable `alpha` aliases advance only after the complete pair exists; no source
  branch is created or advanced;
- promotion is skipped when the validated SHA is no longer current `main`.

Gate selection checks the latest run/attempt for each workflow; a prior success
cannot mask a failed rerun. Workflow identities are regression checked against
real files. Before changing branch/ruleset required checks, inspect repository
settings; publication hardening must not weaken required checks.

## Transient Android dependency resolution

The maintenance image builds the Android Agent from repository source. A hosted
runner can occasionally encounter an external Google Maven/Maven Central/plugin
portal incident where many otherwise valid Kotlin/Android dependencies appear
unavailable at the same time. The maintenance Docker build therefore retries the
immutable Android release build up to three times and forces fresh dependency
resolution after the first failed attempt.

This is bounded reliability hardening, not failure suppression. A deterministic
source/build problem still fails closed after the retry limit, and publication
still requires a successfully built APK plus package, version, and checksum
verification.

Third-party actions remain pinned to reviewed commit SHAs. Dependabot retains
Node, Actions and Gradle coverage. Do not consolidate by disabling security scans,
using path filters that strand required checks, bypassing the exact-SHA gate, or
accepting unpublished source.

## Main-only development policy

Use a short-lived branch, a pull request into main, required checks/review, and
then the existing main image publisher. No staging/development/production branch
or GitHub environment approval is required. Main publication has read-only source
permissions; only package aliases are promoted. Semantic release tags remain an
optional compatibility mechanism for the existing GUI, not a required update lane.

Enable merge commits, squash and rebase in Settings > General > Pull Requests
and in the main ruleset's allowed merge methods. Preserve required status checks,
review-thread resolution, non-fast-forward/deletion protection and security gates.
Repository-level checkboxes alone do not override a squash-only ruleset. An AI
connection without ruleset-administration writes must report that remaining
owner action rather than claim it changed settings or bypass the ruleset.
