# GitHub Actions validation and publication

Six workflows have distinct responsibilities:

| Workflow | Required work |
| --- | --- |
| Validate | Locked dependency audits, syntax, Node/Python regressions, Windows parsing, Android debug APK, restrictive-context Hub build, maintenance build, two Trivy scans and appliance smoke tests |
| Display browser regression | Chromium and Firefox receiver/operator regression tests |
| Security gates | Full-history secret scan; PR dependency review at moderate severity |
| Publish Main Images | Wait for the three main-commit validation workflows, publish exact-revision Hub/maintenance images and refresh alpha aliases without a deployment branch |
| Publish Containers | Verify semantic version/main ancestry and required checks, then promote the published SHA pair to release tags and create the release |
| Sync Wiki | Synchronize the tracked mirror on relevant changes or manual dispatch |

Android debug validation moved into Validate without dropping its APK artifact or
checksum verification. The restrictive-context build is now the Hub image used
by Validate's scans and smoke tests; its separate duplicate workflow was removed.
The direct HTTP smoke test tags the already built/scanned images locally instead
of invoking another Compose build. `npm test` already includes the Full Recovery
contract; `npm run check` already includes controller syntax validation.

Semantic release publication no longer repeats Node tests and builds four more
images. It promotes the existing validated main pair, retaining the published
manifest's attestations. Main publication still builds with SBOM/provenance after
validation. Both canonical and legacy compatibility aliases remain. A release
is created only after both release image aliases have been promoted successfully.

Obsolete PR runs are cancelled by PR number. Main runs use commit-specific groups
and are never cancelled by a newer commit while publication waits on them. Jobs
have finite timeouts. Wiki writes are serialized and refresh stale source before
syncing. Security checks, both browser engines, APK build/signing-contract coverage,
immutable revision checks and main image-pair gating are not optional.

The publisher is restricted to successful main **push** validation. The
`workflow_run` trigger is already scoped to the repository's `Validate` workflow
and `main` branch, so the job gate intentionally does not depend on optional
`workflow_run.head_repository` payload metadata. It still requires a successful
push run on `main`, gates the exact `head_sha` against the latest `Validate`,
`Display browser regression`, and `Security gates` push runs, and promotes only
when that validated SHA is still current `main`. This prevents a missing optional
payload field from silently skipping publication while preserving repository,
branch, commit, and required-check boundaries.

Gate selection checks the latest run/attempt for each workflow; a prior success
cannot mask a failed rerun. Workflow identities are regression checked against
real files. Before changing branch/ruleset required checks, inspect repository
settings: this change does not weaken or silently edit them. If an administrator
configured the removed standalone job names as required, replace those
requirements with their corresponding Validate jobs before merging.

Third-party actions remain pinned to reviewed commit SHAs. Dependabot retains
Node, Actions and Gradle coverage. Do not consolidate by disabling security scans,
using path filters that strand required checks, or accepting unpublished source.

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
