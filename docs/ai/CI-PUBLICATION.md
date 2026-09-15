# AI Context: CI Publication and Main Updates

Use this file whenever changing GitHub Actions, release publication, source-update selection, image identity, Android maintenance-image publication, or package promotion.

## Source and release identities

- `main` is the sole integration/bootstrap/update branch during active development.
- Use short-lived branches and checked PRs into main, not production/staging/development promotion branches or environment approvals.
- A `main` commit is **not deployable merely because it merged**. Its exact validated Hub and maintenance image pair must exist before source/runtime mutation.
- No workflow creates or advances a separate deployment branch. Retain old branches as history rather than deleting or overwriting their commits.
- Immutable images are tagged `sha-<40-character commit SHA>` and must carry `org.opencontainers.image.revision=<same SHA>`.
- Mutable `alpha` aliases are convenience pointers only; update correctness is based on the exact immutable SHA pair.
- Repository settings and the main ruleset must both allow merge commits, squash and rebase while retaining required checks and resolved reviews. A restrictive ruleset requires an authorized administrative change, not a code-only declaration or protection bypass.

## Required validation gate

The publication workflow waits for these exact workflow identities on the same commit:

1. `Validate`
2. `Display browser regression`
3. `Security gates`

Do not rename these workflows without updating every consumer and regression test. A prior success for another attempt/commit must never satisfy the current exact-SHA gate.

## Publish Main Images trigger contract

`Publish Main Images` is triggered directly by every push to `main`.

The publication job does **not** inherit success from its trigger. Instead it polls Actions for the exact `${{ github.sha }}` and requires the latest push run of all three required workflows to report `success`. Failure, cancellation, timeout, action-required, stale, or skipped state must fail publication closed.

Do not restore indirect `workflow_run` triggering. Earlier publication outages demonstrated that optional or changed upstream payload metadata can cause a legitimate validated merge to produce only skipped publisher jobs. Direct `main` push triggering plus independent exact-SHA validation preserves the security boundary without depending on another workflow's event payload shape.

## Build and promotion contract

After the exact-SHA gate passes:

- build both `ghcr.io/wagnerks1990/roomgoblin:sha-<SHA>` and `ghcr.io/wagnerks1990/roomgoblin-maintenance:sha-<SHA>`;
- publish the legacy compatibility aliases for the same immutable SHA;
- retain SBOM and provenance generation;
- wait for the complete pair before mutable alias promotion;
- before mutable alias promotion, verify that `main` still equals the validated SHA so a stale run cannot replace a newer alpha;
- promote package aliases only, with read-only source permissions; never advance a production/staging/development branch.

If either image fails, pair promotion must fail closed. Semantic releases remain optional for existing GUI release/revert compatibility; a new release tag is not required for CLI main updates.

## Android maintenance-image dependency retries

The maintenance image compiles the Android Agent APK. If a hosted runner sees a broad simultaneous failure resolving otherwise valid artifacts from Google Maven, Maven Central, or the Gradle plugin portal, the Docker build may retry the same immutable release build up to three times and force fresh dependency resolution after the first failure.

This retry is bounded reliability hardening only. Never suppress a deterministic Gradle failure, use mutable dependency versions to make the build pass, or skip APK package/version/checksum verification. If all attempts fail, the maintenance image and therefore the complete pair must remain unpublished.

## Main update behavior and legacy migration

The historical `deploy/update-production.sh` filename and native `published` journal action remain compatibility identifiers, not production-branch selectors. Install/update paths select main, require trusted main ancestry and the exact immutable image pair, and use the conservative component plan plus native lock/journal/backup/health/rollback protocol. Do not change the default to local builds or an unvalidated main commit. `install.sh --build-local` remains an explicit development/recovery choice only.

An old on-disk wrapper follows the retired production ref. Follow `docs/PRODUCTION-UPDATES.md` for the one-time outside-checkout wrapper download. An installed runner without the main capability marker is bridged only after both exact images verify; the target runner performs one full journaled reconciliation. Never overwrite pending journals, reset divergent local main commits, delete old branches, or pull source before image preflight. Later updates recreate only changed verified runtime components.

## Regression expectations

Keep `test/publish-main-images-gate.test.js`, `test/production-image-install.test.js`, `test/image-readiness.test.js`, `test/update-plan.test.js` and `test/update-runner.test.js` passing. They protect direct main publication, exact images, aliases, all validation gates, stale-promotion rejection, revision mismatch rejection, bounded Android retry, main-only selection, legacy migration, selective reconciliation, backups and interrupted rollback.

## Documentation synchronization

When publication behavior changes, update the publisher, relevant build logic, `docs/CI-WORKFLOWS.md`, its Wiki mirror, `docs/PRODUCTION-UPDATES.md`, its Wiki mirror, this context, regression tests and `AGENTS.md` together. Preserve the shared-data startup umask and backup-readability contract described in `PRODUCTION-SHARED-DATA.md`.

Never weaken validation, exact-SHA identity, complete-pair publication, backup or recovery gates to make an update appear available sooner.
