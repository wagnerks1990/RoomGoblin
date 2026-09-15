# AI Context: CI Publication and Production Promotion

Use this file whenever changing GitHub Actions, release publication, production-update selection, image identity, Android maintenance-image publication, or branch-promotion logic.

## Source and release identities

- `main` is the source-of-truth development branch.
- A `main` commit is **not deployable merely because it merged**.
- The deployable source is the `production` branch, which advances only after the exact validated Hub and maintenance image pair has been published and promoted.
- Immutable images are tagged `sha-<40-character commit SHA>` and must carry `org.opencontainers.image.revision=<same SHA>`.
- The mutable `alpha` aliases are convenience pointers only; production/update correctness is based on the exact immutable SHA pair.

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
- do not advance `production` until the complete pair exists;
- before mutable alias promotion, verify that `main` still equals the validated SHA so a stale run cannot replace a newer alpha;
- advance `production` only after pair promotion succeeds.

If either image fails, promotion and `production` advancement must fail closed.

## Android maintenance-image dependency retries

The maintenance image compiles the Android Agent APK. If a hosted runner sees a broad simultaneous failure resolving otherwise valid artifacts from Google Maven, Maven Central, or the Gradle plugin portal, the Docker build may retry the same immutable release build up to three times and force fresh dependency resolution after the first failure.

This retry is bounded reliability hardening only. Never suppress a deterministic Gradle failure, use mutable dependency versions to make the build pass, or skip APK package/version/checksum verification. If all attempts fail, the maintenance image and therefore the production pair must remain unpublished.

## Production update behavior

Install/update paths select the published `production` source and pull the matching immutable image pair. Do not change the default production flow back to local builds or to an unvalidated newer `main` commit. `install.sh --build-local` remains an explicit development/recovery choice only.

## Regression expectations

Keep `test/publish-main-images-gate.test.js` and `test/production-image-install.test.js` passing. They protect:

- direct `main` push publication;
- exact commit-matched image pulls;
- canonical and legacy image aliases;
- all three required workflow identities;
- stale-promotion protection;
- single ownership of mutable `alpha` promotion;
- rejection of image/source revision mismatch;
- bounded Android dependency retry with fail-closed behavior.

## Documentation synchronization

When publication behavior changes, update together:

- `.github/workflows/publish-main-images.yml`
- `maintenance-agent/Dockerfile` when retry/build behavior changes
- `docs/CI-WORKFLOWS.md`
- `wiki/CI-Workflows.md`
- this AI context
- regression tests
- `AGENTS.md` if contributor policy or required workflow identities change

Never weaken validation, image-pair atomicity, exact-SHA identity checks, or production-branch promotion to make a release appear available sooner.
