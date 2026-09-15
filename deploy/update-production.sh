#!/usr/bin/env bash
set -Eeuo pipefail

# The historical filename is a compatibility entrypoint; main is the only source.
ROOT="${CLASSROOM_HUB_DIR:-/opt/classroom-hub}"
MODE="${1:-}"
case "$MODE" in ""|--full|--plan) ;; *) echo "Usage: update-production.sh [--plan|--full]" >&2; exit 2;; esac
fail(){ echo "RoomGoblin main update failed: $*" >&2; exit 1; }
[[ $EUID -eq 0 ]] || fail "run with sudo or as root"
command -v git >/dev/null 2>&1 || fail "git is required"
command -v docker >/dev/null 2>&1 || fail "docker is required"
docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin is required"
[[ -d "$ROOT/.git" ]] || fail "$ROOT is not a Git checkout"

cd "$ROOT"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || fail "tracked source has local changes; commit or revert them before updating"
branch="$(git symbolic-ref --quiet --short HEAD || true)"
[[ -z "$branch" || "$branch" == main || "$branch" == production ]] || fail "use main; only a legacy production or verified detached recovery checkout can migrate automatically"
ORIGIN_URL="$(git remote get-url origin)"
case "$ORIGIN_URL" in
  https://github.com/wagnerks1990/RoomGoblin|https://github.com/wagnerks1990/RoomGoblin.git|git@github.com:wagnerks1990/RoomGoblin.git|ssh://git@github.com/wagnerks1990/RoomGoblin.git|https://github.com/wagnerks1990/classroom-control-hub|https://github.com/wagnerks1990/classroom-control-hub.git|git@github.com:wagnerks1990/classroom-control-hub.git|ssh://git@github.com/wagnerks1990/classroom-control-hub.git) ;;
  *) fail "refusing update from an unexpected origin" ;;
esac
source "$ROOT/deploy/image-readiness.sh"

echo "Fetching RoomGoblin main ..."
git fetch origin +refs/heads/main:refs/remotes/origin/main || fail "main is unavailable; source and services were not changed"
MAIN_COMMIT="$(git rev-parse refs/remotes/origin/main)"
git merge-base --is-ancestor HEAD "$MAIN_COMMIT" || fail "this checkout is ahead of or diverges from main; refusing to downgrade source. Running services were not changed"
if git show-ref --verify --quiet refs/heads/main; then
  git merge-base --is-ancestor refs/heads/main "$MAIN_COMMIT" || fail "the local main branch diverges; preserve/reconcile its commits before updating"
fi
if [[ "$MODE" == --plan ]]; then
  python3 "$ROOT/deploy/update-plan.py" "$MAIN_COMMIT"
  exit
fi

RUNNER=/usr/local/libexec/classroom-control-hub/app-update-runner.sh
if ! grep -Fxq 'ROOMGOBLIN_UPDATE_SOURCE=main' "$RUNNER" 2>/dev/null; then
  # Older installed runners require origin/production. Verify the exact image pair
  # before executing the target runner; it owns the lock, journal, backup and rollback.
  # This also works when this reviewed script was downloaded outside an old checkout.
  echo "Migrating the legacy updater to main with full reconciliation ..."
  roomgoblin_wait_image_pair "$MAIN_COMMIT" \
    "ghcr.io/wagnerks1990/roomgoblin:sha-$MAIN_COMMIT" \
    "ghcr.io/wagnerks1990/roomgoblin-maintenance:sha-$MAIN_COMMIT" || fail "main images are not ready; source and services were not changed"
  candidate="$(mktemp /run/roomgoblin-main-runner.XXXXXX)"
  trap 'rm -f "$candidate"' EXIT
  git show "$MAIN_COMMIT:host-agent/app-update-runner.sh" > "$candidate"
  grep -Fxq 'ROOMGOBLIN_UPDATE_SOURCE=main' "$candidate" || fail "selected main does not contain the main-only updater"
  bash "$candidate" --published "$MAIN_COMMIT" --full
  exit
fi
# The installed runner snapshots itself before source or installer replacement.
exec bash "$RUNNER" --published "$MAIN_COMMIT" "$MODE"
