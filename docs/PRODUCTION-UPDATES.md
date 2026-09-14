# Published production updates

`main` is the development source of truth, but a merged commit can still fail CI.
The `production` branch is advanced by **Publish Main Images** only after all
required checks pass and both Hub and maintenance images have been published.
Only the publisher should advance this branch; never point it at unbuilt source.

## Normal update

```bash
sudo bash /opt/classroom-hub/deploy/update-production.sh
```

The updater fetches `origin/production`, checks that the current source can move
forward to it, downloads both `sha-<commit>` images, and verifies each image's
`org.opencontainers.image.revision` label against that exact commit. Only then
does it advance source and run `install.sh`, which performs its normal backup,
runtime reconciliation, deployment and convergence checks. Runtime data, secrets,
service names and paths retain their existing compatibility contract.

Do not run `git pull origin main` before routine production updates. When new CI
is pending or failed, the published branch stays on the previous complete pair.
If local source is already ahead of that branch, the updater refuses to downgrade
it. Wait for a newer published build; it does not reset source or roll back data.
Tracked edits and unrelated branches are also rejected before deployment.

## Existing installations with the old updater

The old script follows `main`. Install the new script once from the published
branch, then use the normal command above for subsequent updates:

```bash
cd /opt/classroom-hub &&
git fetch origin +refs/heads/production:refs/remotes/origin/production &&
git merge --ff-only origin/production &&
sudo bash deploy/update-production.sh
```

Use this transition only with a clean checkout. If the published branch does not
exist yet or fast-forward is refused, stop and wait for a newer successful
publication. Do not use `reset --hard`, `--force`, retagged images, or local builds
to work around a failed publication. This one-time transition updates source
before the new preflight is available; running services are unchanged until the
installer starts deployment.

## Missing-image and registry errors

The installer quietly probes manifests and pulls only after both images exist.
For an explicitly selected unpublished commit, public GitHub CI metadata is used
to distinguish a pending build from a failed required check. A known failure
stops promptly and names the blocking workflow. If GitHub is unavailable or
rate-limited, bounded manifest checks continue; metadata never authorizes an
unverified image. Registry/network failures and revision mismatches fail closed.

The default publication wait is 20 minutes. The compatibility setting
`CLASSROOM_HUB_IMAGE_WAIT_ATTEMPTS` accepts 1–180, with ten seconds of total
publication-wait budget per unit, including manifest/CI probes. Each manifest
probe is capped at 20 seconds; each image download is separately capped at
15 minutes. Increasing the wait cannot fix failed CI.

For example, `9e7b3e8` did not publish because the Firefox lighting regression
failed. A missing SHA tag is not evidence that Docker needs reinstalling. Review
the required workflow and **Publish Main Images** for that commit on GitHub.
The image preflight occurs before installer package, backup, secret, database or
service mutation. Ctrl+C while waiting is safe for running services.

The semantic-release web updater retains its separate backup/rollback protocol.
This published-source selector does not change release acceptance or remove any
required CI gate.
