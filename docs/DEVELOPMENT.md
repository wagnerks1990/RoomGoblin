# Development

## Read first

AI assistants and contributors should read `AGENTS.md` and `docs/AI-CONTEXT.md` before changing behavior. Before changing TVs, displays, sources, AV routing, class targets, automation targets, presentations, media, Morning Announcements, or Music Assistant TV selection, also read `docs/ROOM-TOPOLOGY.md` and `docs/ai/ROOM-TOPOLOGY.md`.

The direct source tree on `main` is canonical. The temporary `source-archive/` migration payload and materialization workflow have been removed.

## Source layout

```text
classroom-control-hub/
├── src/                    # main Node.js backend and startup recovery
├── public/                 # controller, display, setup and supporting web UIs
├── maintenance-agent/      # maintenance service + alpha extension layer
├── host-agent/             # host-level systemd agent + controlled wrapper
├── config/                 # public defaults/catalog/schema
├── docs/                   # version-controlled technical documentation
├── wiki/                   # Git-tracked GitHub Wiki mirror
├── tools/                  # validation/development utilities
├── .github/workflows/      # CI and container publishing
├── AGENTS.md               # AI/contributor operating contract
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Development rules

### Preserve persistent data

Application changes must not require deleting the runtime database or site configuration as a routine upgrade step. Schema changes should use explicit, reviewable migrations.

Production runtime `.env`, databases, data, uploads, backups, master keys, private keys, credentials, and managed integration data are not replaceable source files.

Database identity is an operational invariant. `DATABASE_FILE` is authoritative. If a migration reconciles database filenames, stop the application, take SQLite-safe backups of every database, verify the destination with `PRAGMA quick_check`, preserve the previous file for rollback, and update `.env` before recreation.

### Keep deployment-specific values out of source

Do not hard-code real school/district domains, internal addresses, credentials, stream IDs, schedules, device identifiers, or tokens into reusable public source.

### Keep manual and automatic behavior consistent

Features with both scheduler and manual controls should share backend state transitions rather than duplicate similar logic in separate paths. Morning Announcements are a key example: manual and automatic starts enter the same highest-priority state.

### Favor reconciliation over cached assumptions

Long-running integrations can reconnect independently. When practical, scheduler decisions should compare intended state to actual external/device state instead of trusting stale in-memory flags.

When Morning Announcements end, current display state is recovered by a scheduler resync, not by restoring a stale snapshot.

### Keep integration health independent

A failed integration must not mark unrelated integrations offline. Slow optional hardware probes must not block initial controller Overview rendering.

### Preserve appliance control boundaries

The controller may inventory and operate existing Docker containers through the authenticated maintenance/Host Agent path. New container creation stays restricted to reviewed supported add-on images. Do not replace this with arbitrary root shell or unrestricted Docker execution.

Supported optional managed add-ons are Mosquitto, Govee2MQTT, Music Assistant, and Veyon WebAPI. Existing containers should be adopted without recreation unless an administrator explicitly chooses recreate/update. Persistent add-on data must survive container replacement.

### Room topology invariants

RoomGoblin has separate canonical inventories for physical TVs, content displays, content sources, and lighting. Do not infer one domain from another.

- `All Displays` resolves against enabled content receivers.
- `All TVs` resolves against enabled physical TVs.
- Classes keep content-display defaults.
- TV power targets physical TVs; display text/media/URLs target content displays.
- AV routing uses physical TVs plus content sources.
- Stable IDs survive friendly-name changes.
- Typed groups cannot cross domains.
- Missing/removed target IDs fail closed rather than being redirected.
- Pluto's current 8×8 shape is adapter-specific and must not become an application-wide device-count assumption.

Setup and **Displays & AV** edit the same SQLite-backed topology. Changes must refresh dependent operator target inventories without requiring duplicate configuration.

### Setup wizard invariants

Setup edits the canonical topology rather than treating receiver count as the room's TV count. Content-display IDs remain stable/editable, and physical-TV/source inventory is independent. Legacy receiver/device projections remain compatibility boundaries during migration.

Discovery actions must match backend capabilities: **Adopt Existing** must not call a route that rejects adoption, and **Deploy/Recreate** must remain an explicit action.

## Standard production layout

The standard production checkout is `/opt/classroom-hub`. The Host Agent uses `/run/classroom-control-hub/host-agent.sock`.

Do not reintroduce migration-era `/opt/classroom-control-hub` assumptions into default paths unless explicitly supporting a custom deployment path.

## Validation

The `Security gates` workflow performs a full-history Gitleaks scan and blocks
pull requests that introduce dependencies with moderate-or-higher known
vulnerabilities. Both actions are pinned to full reviewed commit SHAs. The
validated-main and tagged-release publication gates require this workflow to
pass. Main validation also scans both built runtime images and blocks fixable
high/critical vulnerabilities. Dependabot separately monitors the two npm
graphs, GitHub Actions, and the Android Agent Gradle build.

Every tracked shell script is syntax checked; adding a new `.sh` file therefore
does not require manually extending a workflow filename list.

The directly downloaded Gradle 8.9 distribution is verified against Gradle's
published SHA-256 checksum in both Android CI and the maintenance image build.
Do not update the distribution or checksum independently.

Before committing a release candidate, run the checks represented by `.github/workflows/validate.yml`.

```bash
node --check src/server.js
node --check src/storage.js
node --check src/startup-recovery.js
node --check maintenance-agent/server.js
node --check maintenance-agent/extensions.js
node tools/validate-controller.js
python3 -m py_compile host-agent/server.py host-agent/start.py
npm test
docker compose config
docker build -t classroom-control-hub:test .
docker build -t classroom-control-hub-maintenance:test maintenance-agent
```

For installer changes, also run:

```bash
bash -n install.sh
```

## Version convergence

`VERSION` is the primary Hub release identifier. Root and maintenance package metadata must agree with it. Large client surfaces are stamped mechanically at image build time from `VERSION`, the maintenance image stamps its runtime diagnostic version from package metadata, and the Host Agent wrapper reports the release version while importing the audited core implementation.

Tests must verify the stamping/wrapper contracts so releases do not rely on manually editing large client files.

## Current known-good baseline

At the time this document was updated, `1.0.0-alpha.82` is the production-readiness review baseline. It retains stable URL display access as the default, keeps individual credentials optional, prevents supported installs from modifying tracked source modes, binds immutable images to their trusted revision, and makes encrypted single-export recovery a writer-frozen point-in-time transaction with stable identity snapshots and all-state rollback.

A newer `VERSION` supersedes the version number, but existing behavioral invariants remain unless deliberately changed and documented.

## Git workflow

Preferred workflow:

```text
feature/fix branch
      ↓
pull request
      ↓
Validate + Display browser regression + Security gates
      ↓
merge to main
      ↓
validated immutable Hub + maintenance image pair
      ↓
production promotion
```

Urgent classroom alpha fixes may be committed directly when necessary, but they must remain traceable, validated, and documented.

## Production update workflow

Supported production updates select the validated published source/image pair rather than pulling arbitrary newer `main` directly:

```bash
sudo bash /opt/classroom-hub/deploy/update-production.sh
```

The updater verifies the exact published revisions, applies the journaled deployment path, and refuses silent downgrade or unvalidated image substitution. Do not document `git pull origin main && install.sh` as the normal production path.

For development rebuilds after the installer has established the host state:

```bash
docker compose build --no-cache
docker compose up -d --remove-orphans
docker compose ps
curl -fsS http://127.0.0.1:3000/health
```

Always back up production state before upgrades.

## Testing priorities

High-value regression scenarios include:

- active database selection when two historical `.db` files coexist;
- built-in Administrator profile recovery when capabilities are missing;
- passwords containing shell-significant punctuation such as `!` and `#`;
- maintenance startup while the main application is still stopped;
- adopting existing Docker integrations without recreation;
- deploy/recreate/remove of supported add-ons while preserving persistent data;
- topology migration from three content displays to eight physical TVs;
- adding/removing/renaming/disabling physical TVs, content displays, and content sources without cross-domain leakage;
- Classes/Automations/presentations/media refreshing from the canonical topology;
- stale removed topology target IDs failing closed;
- multiple displays connecting/reconnecting simultaneously;
- automation execution at period boundaries;
- active-class selection for multi-class events;
- transition timers;
- valid and invalid explicit continuation chains;
- announcement priority takeover and HLS live/offline detection;
- announcement volume/mute controls;
- automations becoming due while announcements are live;
- post-announcement failsafe scheduler resync;
- Background Music pause/resume and Music Assistant reconnect;
- no-school/remote/delay/half-day calendar behavior;
- independent integration health;
- Overview responsiveness when hardware is slow/unconfigured;
- Host Agent socket visibility after install/migration;
- version mismatch handling without reload loops;
- persistent database survival across image upgrades.

## Documentation requirement

Behavior-changing changes should update `CHANGELOG.md`, the relevant `docs/` page, and the matching `wiki/` mirror page. Changes that materially affect future AI/contributor decisions should also update `AGENTS.md`, `docs/AI-CONTEXT.md`, or the relevant focused `docs/ai/` context. Topology changes specifically must keep `docs/ROOM-TOPOLOGY.md`, `wiki/Room-Topology.md`, and `docs/ai/ROOM-TOPOLOGY.md` synchronized.
