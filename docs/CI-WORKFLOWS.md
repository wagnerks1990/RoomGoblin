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

Android debug validation remains inside Validate without dropping its APK artifact or checksum verification. The restrictive-context build is the Hub image used by Validate's scans and smoke tests. The direct HTTP smoke test tags the already built/scanned images locally instead of invoking another Compose build. `npm test` already includes the Full Recovery contract; `npm run check` already includes controller syntax validation.

Semantic release publication promotes the existing validated main pair instead of rebuilding four more images, retaining the published manifest attestations. Main publication still builds with SBOM/provenance after validation. Both canonical and legacy compatibility aliases remain. A release is created only after both release image aliases have been promoted successfully.

## Main publication trigger and gate

`Publish Main Images` is a direct `push` workflow on `main`. It does **not** depend on a `workflow_run` payload from Validate. This prevents a valid merge commit from silently producing a skipped publication run because of event/payload differences in the upstream workflow trigger.

The direct publisher still fails closed:

- `VALIDATED_SHA` is exactly `${{ github.sha }}` from the `main` push;
- the gate polls Actions for that SHA with `event=push`;
- `Validate`, `Display browser regression`, and `Security gates` must all report `success` for that exact SHA;
- failure, cancellation, timeout, stale, action-required, or skipped state fails publication;
- immutable Hub and maintenance images are labeled with the same exact Git revision;
- mutable `alpha` aliases and the `production` branch advance only after the complete image pair exists;
- promotion is skipped if the validated SHA is no longer current `main`.

Main publication uses commit-specific concurrency groups and does not cancel an older commit while it is waiting on required checks. PR validation runs may still be cancelled when superseded.

## Transient Android dependency resolution

The maintenance image builds the Android Agent from source. GitHub-hosted runners have occasionally observed an external Maven/Google repository incident where a large set of otherwise valid Kotlin/Android dependencies simultaneously appears unavailable. The maintenance Docker build now retries the immutable Android release build up to three times, forcing fresh dependency resolution after the first failure. A deterministic source/build failure still fails closed after the bounded retries.

This retry is reliability hardening only. Do not replace pinned plugin/tool versions with mutable dependencies, suppress Gradle failures, or publish a maintenance image without a successfully verified APK and matching package/version metadata.

## Required safety properties

Jobs have finite timeouts. Wiki writes are serialized and refresh stale source before syncing. Security checks, both browser engines, APK build/signing-contract coverage, immutable revision checks and production pair gating are not optional.

Gate selection checks the latest run/attempt for each workflow; a prior success cannot mask a failed rerun. Workflow identities are regression checked against real workflow files. Before changing branch/ruleset required checks, inspect repository settings; publication hardening must not weaken required checks.

Third-party actions remain pinned to reviewed commit SHAs. Dependabot retains Node, Actions and Gradle coverage. Do not consolidate by disabling security scans, using path filters that strand required checks, or accepting unpublished source.
