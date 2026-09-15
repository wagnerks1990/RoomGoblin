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
- mutable `alpha` aliases and the `production` source branch advance only after
  the complete pair exists;
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
