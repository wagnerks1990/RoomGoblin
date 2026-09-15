# GitHub Actions validation and publication

Six workflows have distinct responsibilities:

| Workflow | Required work |
| --- | --- |
| Validate | Locked dependency audits, syntax, Node/Python regressions, Windows parsing, Android debug APK, restrictive-context Hub build, maintenance build, two Trivy scans and appliance smoke tests |
| Display browser regression | Chromium and Firefox receiver/operator regression tests |
| Security gates | Full-history secret scan; PR dependency review at moderate severity |
| Publish Main Images | Start on every `main` push, wait for all three exact-SHA validation workflows, publish exact-revision Hub/maintenance images and advance production after pair promotion |
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
immutable revision checks and production pair gating are not optional.

## Main publication trigger and exact-SHA gate

`Publish Main Images` is a direct `push` workflow on `main`. It does **not** depend
on a `workflow_run` payload from Validate. The gate still waits for `Validate`,
`Display browser regression`, and `Security gates` to pass for exactly the same
`github.sha` before any image is published.

Failure, cancellation, timeout, action-required, stale, or skipped state blocks
publication. Both immutable runtime images and legacy aliases use the same source
SHA. Mutable `alpha` aliases and the `production` branch move only after the full
pair exists, and stale commits are not promoted after `main` advances.

## Transient Android dependency resolution

The maintenance image builds the Android Agent APK from repository source. If a
hosted runner experiences a broad external Maven/Google repository failure, the
immutable Android release build is retried up to three times and fresh dependency
resolution is forced after the first failure. The retry is bounded and fail-closed:
APK package/version/checksum verification remains mandatory and deterministic
build failures still block publication.

Gate selection checks the latest run/attempt for each workflow; a prior success
cannot mask a failed rerun. Workflow identities are regression checked against
real files. Before changing branch/ruleset required checks, inspect repository
settings; publication hardening must not weaken required checks.

Third-party actions remain pinned to reviewed commit SHAs. Dependabot retains
Node, Actions and Gradle coverage. Do not consolidate by disabling security scans,
using path filters that strand required checks, bypassing the exact-SHA gate, or
accepting unpublished source.
