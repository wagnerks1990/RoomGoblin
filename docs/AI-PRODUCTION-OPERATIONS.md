# AI production operations context

Use this file when an AI assistant or automation changes production image publication, Hub startup, persistent-data permissions, operational backup behavior, or the production updater.

## Publication

- Every `main` push starts `.github/workflows/publish-main-images.yml` directly.
- Publication must wait for `Validate`, `Display browser regression`, and `Security gates` to pass for the exact same `github.sha`.
- Never accept a previous workflow success for a different commit.
- Publish both Hub and maintenance immutable SHA tags, including legacy aliases, before mutable `alpha` promotion or advancing `production`.
- If current `main` has moved, skip stale promotion.
- Do not restore an indirect `workflow_run` trigger that can silently skip a valid `main` merge.

## Android maintenance image

The maintenance image builds the Android Agent APK. A broad simultaneous failure to resolve otherwise valid artifacts from Google Maven, Maven Central, and the Gradle plugin portal is treated as a likely external dependency-resolution incident. The Dockerfile may retry the immutable build in a bounded loop and refresh dependencies after the first failure. It must still fail after the retry limit and must never skip APK/package/version/SHA verification.

## Shared persistent data

The main Hub process runs as UID/GID `10001:10001`. Maintenance needs read access to application assets included in operational/full-recovery backups. `tools/start-roomgoblin.sh` therefore sets `umask 0027` before Node starts.

Expected ordinary runtime output:

- files: `0640` unless explicitly stricter;
- directories: `0750` unless explicitly stricter;
- no world access.

Do not replace this with `0777`, blanket recursive chmod, or an unknown inherited umask. Secrets, ADB private material, signing material, and backup files may have stricter explicit modes and must not be relaxed merely to satisfy a generic permission check.

## Backup/update invariant

A production update must complete its operational safety backup before mutating running services. If backup fails with `EACCES`, diagnose the specific persistent file and repair only its incorrect ownership/mode. Never bypass the backup step.

A known incident involved an uploaded MP4 created as `0600`: the Hub could use it, but maintenance could not read it for backup. Runtime umask hardening prevents ordinary uploaded media from repeating that failure.

## Required documentation synchronization

When changing these contracts, update together:

- `docs/CI-WORKFLOWS.md`
- `docs/PRODUCTION-PUBLICATION-AND-SHARED-DATA.md`
- `wiki/CI-Workflows.md`
- `wiki/Production-Publication-and-Shared-Data.md`
- `wiki/AI-and-Contributor-Guide.md`
- regression tests covering workflow identity, exact-SHA publication, bounded Android retry, and Hub runtime umask.
