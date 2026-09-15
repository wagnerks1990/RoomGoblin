from pathlib import Path
root = Path('.')
def put(p, s): (root/p).write_text(s)
def replace(p, old, new, count=1):
    s = (root/p).read_text()
    assert s.count(old) == count, (p, old, s.count(old))
    put(p, s.replace(old, new))

put('deploy/update-production.sh', r'''#!/usr/bin/env bash
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
''')
replace('deploy/bootstrap.sh', 'REPOSITORY_REF="${CLASSROOM_HUB_REF:-production}"', 'REPOSITORY_REF="${CLASSROOM_HUB_REF:-main}"')
replace('deploy/image-readiness.sh', 'Use deploy/update-production.sh for published builds, or retry this exact revision after CI succeeds.', 'Retry deploy/update-production.sh after the selected main revision passes CI and both images publish.')
p='host-agent/app-update-runner.sh'
replace(p, 'set -Eeuo pipefail\n', 'set -Eeuo pipefail\nROOMGOBLIN_UPDATE_SOURCE=main\n')
replace(p, '[[ "$(git rev-parse refs/remotes/origin/production)" == "$2" ]]', '[[ "$(git rev-parse refs/remotes/origin/main)" == "$2" ]]')
replace(p, 'git fetch --force --prune --tags origin\ngit fetch origin +refs/heads/main:refs/remotes/origin/main', 'git fetch --tags origin +refs/heads/main:refs/remotes/origin/main')
replace(p, '''  git fetch origin +refs/heads/production:refs/remotes/origin/production
  [[ "$TARGETCOMMIT" =~ ^[0-9a-f]{40}$ ]] || exit 33
  git merge-base --is-ancestor "$TARGETCOMMIT" refs/remotes/origin/production
  git merge-base --is-ancestor HEAD "$TARGETCOMMIT"
  RESOLVED="$TARGETCOMMIT"''', '''  [[ "$TARGETCOMMIT" =~ ^[0-9a-f]{40}$ ]] || exit 33
  git merge-base --is-ancestor "$TARGETCOMMIT" refs/remotes/origin/main
  git merge-base --is-ancestor HEAD "$TARGETCOMMIT"
  source_branch="$(git symbolic-ref --quiet --short HEAD || true)"
  [[ -z "$source_branch" || "$source_branch" == main || "$source_branch" == production ]] || { echo "Only main or a legacy/recovery checkout can be updated" >&2; false; }
  if git show-ref --verify --quiet refs/heads/main; then
    git merge-base --is-ancestor refs/heads/main "$TARGETCOMMIT" || { echo "Local main diverges; refusing to overwrite its commits" >&2; false; }
  fi
  RESOLVED="$TARGETCOMMIT"''')
replace(p, 'exec 9>"$LOCK_FILE"', r'''advance_main_source(){
  # Never reset/delete legacy or unrelated branches. The preflight has verified
  # both HEAD and any existing main can fast-forward to the selected commit.
  if [[ "$(git symbolic-ref --quiet --short HEAD || true)" != main ]]; then
    if git show-ref --verify --quiet refs/heads/main; then
      git switch main
    else
      git switch -c main
    fi
  fi
  git merge --ff-only "$RESOLVED"
  if [[ "$(git config --get-all remote.origin.fetch || true)" == '+refs/heads/production:refs/remotes/origin/production' ]]; then
    git config remote.origin.fetch '+refs/heads/main:refs/remotes/origin/main'
  fi
  git config branch.main.remote origin
  git config branch.main.merge refs/heads/main
}

exec 9>"$LOCK_FILE"''')
replace(p, '    git merge --ff-only "$RESOLVED"', '    advance_main_source')
replace(p, 'if [[ "$ACTION" == published ]]; then git merge --ff-only "$RESOLVED"; else git checkout --detach "$RESOLVED"; fi', 'if [[ "$ACTION" == published ]]; then advance_main_source; else git checkout --detach "$RESOLVED"; fi')
replace(p, 'Checking the Git checkout and resolving the verified release target.', 'Checking the Git checkout and resolving the trusted update target.')
replace(p, 'Published source synchronized; runtime inputs are unchanged. No services restarted.', 'Main source synchronized; runtime inputs are unchanged. No services restarted.')
replace('AGENTS.md','Production selects published source from `origin/production`. Normal supported update flow:', '''During active development, `main` is the sole integration and update branch.
Use short-lived branches and checked pull requests into `main`; do not add
production/staging/development promotion branches or GitHub environment approvals.
The historical update script name is retained for compatibility. Normal flow:''')
replace('AGENTS.md', '''Only successful pair promotion advances `production`. Bootstrap and normal source
updates follow that published ref, verify both revisions before moving source,
and refuse silent downgrades. See `docs/PRODUCTION-UPDATES.md`; do not reintroduce
an unconditional main pull in the production updater.''', '''Bootstrap and source updates select `main`, but only its exact published image
pair may be deployed. No workflow creates or advances a deployment branch.
Preserve selective reconciliation, the legacy-runner migration, main ancestry,
image verification, backups and rollback. Keep local branches/commits intact;
legacy production and detached recovery checkouts transition safely to main.
See `docs/PRODUCTION-UPDATES.md`; never replace this with an unconditional pull.
Repository settings and the main PR ruleset must both permit merge, squash and
rebase methods. Preserve required checks and resolved reviews, and never bypass
protections or claim an administrative setting changed without verifying it.''')
replace('docs/AI-CONTEXT.md','`main` is the development source of truth; `production` is advanced by CI only after the validated image pair is published. Normal supported update flow:', '''`main` is the only integration/update source during active development. Work on
short-lived branches, pass PR checks, merge to main, and publish its exact image
pair. No production/staging/development branch or environment promotion is used.
Allow merge commits, squash and rebase in both repository settings and the main
ruleset, without bypassing required checks/reviews. Normal supported update flow:''')
p='docs/AI-CONTEXT.md';s=(root/p).read_text();s=s.replace('published production source','verified main source');put(p,s)
replace('README.md','clones the CI-published `production` branch, generates unique appliance credentials, installs the', 'clones `main`, waits for its exact CI-published images, generates unique appliance credentials, installs the')
replace('README.md', '''## Production updates

The standard production checkout remains `/opt/classroom-hub`. Production updates follow the latest published image pair:''', '''## Main-based updates

During active development, main is the only integration and update branch. Use
short-lived work branches and checked PRs into main; no staging, development or
production promotion branches are required. The checkout remains
`/opt/classroom-hub`; the historical update script
name remains compatible with existing commands:''')
replace('README.md', '''The updater checks the published image pair, verifies changed images before
advancing source, and uses the native backup/deployment/recovery runner. A failed or still-running `main`
build leaves the previous published build selected. Do not pull `main` before
normal updates. Updates now recreate only components whose verified runtime inputs changed; use `--plan` to inspect decisions or `--full` for complete reconciliation. See [Published production updates](docs/PRODUCTION-UPDATES.md)
for older-checkout migration and image-publication troubleshooting.''', '''The updater selects `origin/main`, checks the exact published image pair, verifies
changed images before advancing source, and uses the native backup/recovery runner.
A failed or still-running main build leaves the existing checkout and services
unchanged; no fallback branch or silent downgrade is used. Do not pull main first.
Only components whose verified runtime inputs changed are recreated; use `--plan`
to inspect decisions or `--full` for repair. See [Main-based updates](docs/PRODUCTION-UPDATES.md)
for the one-time old-updater transition, PR settings and publication troubleshooting.''')
for p in ['docs/CI-WORKFLOWS.md','wiki/CI-Workflows.md']:
    replace(p,'publish exact-revision Hub/maintenance images and advance production after pair promotion','publish exact-revision Hub/maintenance images and refresh alpha aliases without a deployment branch')
    replace(p,'immutable revision checks and production pair gating are not optional.','immutable revision checks and main image-pair gating are not optional.')
    put(p,(root/p).read_text()+'''
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
''')
p='docs/PRODUCTION-UPDATES.md';s=(root/p).read_text()
s=s.replace('''# Published production updates

`main` is the development source of truth. **Publish Main Images** advances
`production` only after all required checks and both image publications succeed.
Never point that branch at unbuilt source or retag another revision to satisfy it.''','''# Main-based updates during active development

`main` is the only integration and update branch. Use short-lived work branches,
checked pull requests into main, and **Publish Main Images**. There is no separate
production, staging or development branch/environment promotion. Existing legacy
branches are retained as history, not fetched or advanced as deployment sources.
The `update-production.sh` filename and native `published` journal action remain
compatibility identifiers; neither selects a production branch.

Main can move before its images finish building. The updater selects one exact
main commit and waits for its validated image pair before source/runtime changes.
Failed CI, missing images, a wrong revision or divergent history stops the update
without changing running services. Never retag another revision to satisfy it.''')
s=s.replace('The optional plan fetches published source and reports component decisions without','The optional plan fetches main and reports component decisions without')
s=s.replace("changing the checkout or services. Normal updates use the native runner's", "changing the checkout or services. A plan is not proof images are ready. Normal updates use the native runner's")
s=s.replace('its current commit can fast-forward to published source; the updater does not\nreset or overwrite a branch to repair it.', '''its current commit and any existing local main can fast-forward to the selected
main commit. Successful source updates switch to main without deleting the old
branch. A single-branch production clone's fetch mapping is migrated to main.
The updater never resets an unrelated/divergent main branch to repair it.''')
a=s.index('## First transition');b=s.index('## Recovery and limits',a)
s=s[:a]+r'''## One-time transition from the old production updater

An old on-disk script cannot discover this change because it follows the retired
production branch. Download the reviewed main updater outside the checkout once:

```bash
curl --proto '=https' --tlsv1.2 -fsSL \
  https://raw.githubusercontent.com/wagnerks1990/RoomGoblin/main/deploy/update-production.sh \
  -o /tmp/roomgoblin-main-update.sh
sudo bash /tmp/roomgoblin-main-update.sh --plan
sudo bash /tmp/roomgoblin-main-update.sh
```

Review the downloaded script before execution. It checks the recognized origin,
clean source and fast-forward ancestry. When the installed runner lacks the main
capability marker, it downloads/verifies both exact images, extracts only the
selected commit's runner to a private temporary file, and invokes its journaled
full reconciliation. This is not an unguarded source pull or a local image build.
The runner owns the mutation lock, backup, source switch, health and rollback;
the installer refreshes the installed runner for later efficient updates. Pending
journals are never overwritten. Resume an interrupted transaction before retrying.
Runtime `.env`, data, secrets, ADB/signing identities and managed add-ons remain
protected. Use the normal in-checkout command after this first successful update.

## Pull-request settings

Both repository Settings > General > Pull Requests and the main ruleset must allow
merge commits, squash merges and rebase merges. The default branch is main; keep
pull requests, required checks, resolved review threads and branch protections.
Auto-merge is useful only after all required checks/reviews complete. Do not bypass
checks, add long-lived environment branches or disable security scans to save time.
Squash is convenient for small fixes; all three methods are permitted by policy.
An administrator must apply any outstanding ruleset setting; documentation or the
repository checkboxes do not change a restrictive ruleset by themselves.

'''+s[b:]
put(p,s);put('wiki/Production-Updates.md',s)
replace('wiki/Troubleshooting.md', '''A merged main commit may still be pending or fail a required check. The published
`production` branch advances only after both validated images exist. Use''', '''A merged main commit may still be pending or fail a required check. Main is the
only source; there is no production branch promotion. Use''')
replace('wiki/Troubleshooting.md','[Published production updates]','[Main-based updates]')
replace('INSTALL.md','From a checked-out release or staging clone, run:','From a checked-out, CI-published main commit (or a deliberately selected semantic release), run:')
replace('INSTALL.md','Optional environment overrides are `CLASSROOM_HUB_REF`,','The default source is `main`; there are no separate deployment branches. Optional environment overrides are `CLASSROOM_HUB_REF`,')
put('CONTRIBUTING.md',(root/'CONTRIBUTING.md').read_text()+'''
## Development flow

Use short-lived work branches and pull requests into `main`; do not introduce
production/staging/development promotion branches or environment gates during
active development. Keep required tests, security checks and resolved reviews.
The desired merge policy permits merge commits, squash and rebase in both the
repository settings and main ruleset. See [Main-based updates](docs/PRODUCTION-UPDATES.md)
for publishing, appliance migration, verification and recovery.
''')
p='CHANGELOG.md';s=(root/p).read_text();s=s.replace('## Unreleased\n','''## Unreleased

### Main-only development and updates

- Restore main as the sole integration/bootstrap/update source; stop advancing a
  separate production branch and remove source-write permission from image promotion.
- Keep checked PRs and permit merge/squash/rebase by policy without weakening gates;
  a restrictive GitHub ruleset still requires an administrator to change it.
- Safely bridge old installed runners after exact-image verification, using one
  full journaled reconciliation before returning to selective updates.
- Migrate legacy or detached checkouts to main without deleting old branches or
  overwriting divergent commits. Preserve backups, rollback and pending journals.
- Update operator, contributor, AI and Wiki documentation and add regressions for
  main selection, legacy migration, missing images and divergent branch safety.
''',1);put(p,s)
replace('CHANGELOG.md', '''- Advance the production source branch only after the validated Hub/maintenance
  pair is published. Bootstrap and normal updates select this branch instead of
  a potentially unbuilt main commit.''', '''- Require the validated Hub/maintenance pair before deployment. The temporary
  production-branch selection was superseded by the main-only workflow above;
  bootstrap and normal updates now select main while retaining image preflight.''')
replace('test/production-image-install.test.js', r'assert.match(source,/app-update-runner\.sh --published/);', r'assert.match(source,/exec bash "\$RUNNER" --published/);')
replace('test/update-runner.test.js',"git('init','-b','production');","git('init','-b','main');")
replace('test/update-runner.test.js',"git('update-ref','refs/remotes/origin/production',target);",'')
