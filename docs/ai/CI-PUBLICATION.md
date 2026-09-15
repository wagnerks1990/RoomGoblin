# AI Context: CI Publication and Production Promotion

Use this file whenever changing GitHub Actions, release publication, production-update selection, image identity, or branch-promotion logic.

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

`Publish Main Images` is triggered by completion of the repository's `Validate` workflow on `main` through `workflow_run`.

The gate must require:

- `github.event.workflow_run.conclusion == 'success'`
- `github.event.workflow_run.event == 'push'`
- `github.event.workflow_run.head_branch == 'main'`

Do **not** add a dependency on optional `workflow_run.head_repository` payload metadata. PR #106 fixed a production-publication outage where that optional field caused every job in a legitimate main publication run to be skipped.

The trigger itself is already scoped to this repository, the named `Validate` workflow, and `main`; the exact SHA is then independently checked against all three required workflows before publishing.

## Build and promotion contract

After the gate passes:

- build both `ghcr.io/wagnerks1990/roomgoblin:sha-<SHA>` and `ghcr.io/wagnerks1990/roomgoblin-maintenance:sha-<SHA>`;
- publish the legacy compatibility aliases for the same immutable SHA;
- retain SBOM and provenance generation;
- do not advance `production` until the complete pair exists;
- before mutable alias promotion, verify that `main` still equals the validated SHA so a stale run cannot replace a newer alpha;
- advance `production` only after pair promotion succeeds.

If either image fails, promotion and `production` advancement must fail closed.

## Production update behavior

Install/update paths select the published `production` source and pull the matching immutable image pair. Do not change the default production flow back to local builds or to an unvalidated newer `main` commit. `install.sh --build-local` remains an explicit development/recovery choice only.

## Regression expectations

Keep `test/production-image-install.test.js` passing. It protects:

- exact commit-matched image pulls;
- canonical and legacy image aliases;
- all three required workflow identities;
- stale-promotion protection;
- single ownership of mutable `alpha` promotion;
- rejection of image/source revision mismatch;
- absence of the unreliable `workflow_run.head_repository` gate dependency.

## Documentation synchronization

When publication behavior changes, update together:

- `.github/workflows/publish-main-images.yml`
- `docs/CI-WORKFLOWS.md`
- `wiki/CI-Workflows.md`
- this AI context
- regression tests
- `AGENTS.md` if contributor policy or required workflow identities change

Never weaken validation, image-pair atomicity, exact-SHA identity checks, or production-branch promotion to make a release appear available sooner.
