#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${CLASSROOM_HUB_DIR:-/opt/classroom-hub}"
fail(){ echo "RoomGoblin production update failed: $*" >&2; exit 1; }
[[ $EUID -eq 0 ]] || fail "run with sudo or as root"
command -v git >/dev/null 2>&1 || fail "git is required"
command -v docker >/dev/null 2>&1 || fail "docker is required"
docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin is required"
[[ -d "$ROOT/.git" ]] || fail "$ROOT is not a Git checkout"

cd "$ROOT"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || fail "tracked source has local changes; commit or revert them before updating"

branch="$(git symbolic-ref --quiet --short HEAD || true)"
[[ "$branch" == main || "$branch" == production ]] || fail "use the main or production deployment branch"
source "$ROOT/deploy/image-readiness.sh"

echo "Fetching the latest published RoomGoblin build ..."
git fetch origin +refs/heads/production:refs/remotes/origin/production || fail "no published production ref is available; source and services were not changed"
PUBLISHED_COMMIT="$(git rev-parse refs/remotes/origin/production)"
git merge-base --is-ancestor HEAD "$PUBLISHED_COMMIT" || fail "this checkout is ahead of or diverges from the published build; refusing to downgrade source. Wait for a newer published build. Running services were not changed"
roomgoblin_wait_image_pair "$PUBLISHED_COMMIT" "ghcr.io/wagnerks1990/roomgoblin:sha-$PUBLISHED_COMMIT" "ghcr.io/wagnerks1990/roomgoblin-maintenance:sha-$PUBLISHED_COMMIT" || fail "published image preflight failed; source and services were not changed"
git merge --ff-only "$PUBLISHED_COMMIT"

echo "Delegating backup, runtime reconciliation, immutable-image deployment, and convergence checks to install.sh ..."
exec bash "$ROOT/install.sh"
