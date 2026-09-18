# Veyon and Music Assistant Integration Contract

This document defines the supported appliance architecture for Veyon classroom workstation control and Music Assistant classroom audio.

## Ownership model

RoomGoblin separates **service lifecycle ownership** from **application configuration ownership**.

### Veyon

`veyon.service` and `veyon-webapi.service` are native Ubuntu/systemd services. RoomGoblin discovers and monitors them through the Host Agent. The Hub must not deploy a second Veyon WebAPI container when the native service exists, and it must not remove or recreate the native services from a managed-integration action.

The Hub still owns the Veyon application configuration used by RoomGoblin. A host-managed service is therefore **configurable**, not monitor-only.

The current appliance profile is standardized on Veyon **key-file authentication** using one matching key pair named `master`. The native private and public keys must share the same Veyon Pair ID. The Host Agent synchronizes `master/private` and `master/public` into `/etc/classroom-control-hub/veyon/` before startup when native Veyon is present. The main application imports the private key into the encrypted SQLite secret store.

Veyon also supports logon/username-password authentication in other deployments. That alternative must not be presented as active unless the backend authentication path is implemented and validated for it. Linux SSH credentials are not Veyon control credentials; they are endpoint-administration/deployment credentials.

The classroom **Log In User** action collects the endpoint password in a masked
modal field. RoomGoblin clears that field when the modal closes and again after
submitting the one command; the password is not displayed or retained by the
controller.

### Music Assistant

Music Assistant normally runs as `music-assistant-server` with host networking so local player discovery works. RoomGoblin may deploy or adopt that container, but container presence alone does not mean the integration is ready.

A valid long-lived Music Assistant access token is mandatory before the Hub reports Music Assistant as operational.

## Database authority

The SQLite database is the RoomGoblin source of truth.

### Veyon computers

The Veyon workstation inventory is stored through the database-backed `veyon-computers` namespace. Records include, as applicable:

- stable computer ID;
- IP address;
- hostname;
- display name;
- `teacher` or `student` role;
- discovery timestamps;
- last-known online/authentication information and related metadata.

Legacy `data/veyon-computers.json` is migration input only. Startup recovery merges it into the SQLite namespace, verifies the record count, records the migration, and removes the active legacy file. Production runs with `LEGACY_JSON_MIRROR=false`, so subsequent writes remain database-only.

### Veyon authentication material

The authoritative Veyon private authentication key is stored encrypted in `secret_store` under `veyon.private-key`. The Veyon public key and non-secret deployment metadata may be stored as managed-integration configuration.

For the current appliance, the canonical native key name is `master`. The pre-start key synchronization helper exports the existing native `master/private` key and its matching `master/public` key into the RoomGoblin compatibility path. The application then imports the private key into SQLite. Native key files remain required runtime material for Veyon, but they are not the Hub configuration authority after import.

The Hub never silently creates or rotates a Veyon key pair during discovery. Key generation/rotation must be an explicit administrator action because the matching public key must also be distributed to all managed endpoints.

### Optional endpoint deployment credentials

Windows/domain and Linux/SSH credentials can be stored for endpoint installation and administration. In the current key-file authentication profile they are not used for normal Veyon control authentication.

Supported deployment configuration concepts include:

- Windows domain/workgroup;
- Windows deployment username;
- encrypted Windows deployment password;
- Linux SSH username;
- encrypted SSH private key;
- encrypted SSH key passphrase.

If a future release adds Veyon logon authentication, its domain username/password must be stored and modeled separately from deployment credentials so the authentication purpose is unambiguous.

### Music Assistant credentials

The Music Assistant long-lived token is stored encrypted in SQLite as `musicassistant.token`. The browser never receives the stored token. A blank token field preserves an existing stored token unless an explicit clear operation is implemented.

## Veyon required configuration

The guided configuration surface exposes:

- WebAPI URL, normally `http://127.0.0.1:11080` from containers;
- authentication key name, default `master` for this appliance profile;
- private key import/replacement state;
- public key metadata for endpoint deployment;
- optional subnet scan prefix and start/end range;
- connection-pool maximum;
- authentication retry limit;
- thumbnail concurrency;
- optional Windows/domain endpoint-deployment credentials;
- optional Linux/SSH endpoint-deployment credentials.

Existing database computers do not require a new subnet scan. A blank scan subnet is valid when the inventory is already populated.

## Veyon health model

Do not treat an HTTP response from `/` as proof that Veyon control works. Native Veyon WebAPI can correctly return `404 Invalid command or non-matching HTTP method` for an unsupported root request.

Health should distinguish:

1. native service installed/running;
2. WebAPI network reachable;
3. Veyon authentication key configured;
4. number of database computers;
5. number of TCP-reachable computers;
6. number of successfully authenticated Veyon computers;
7. command/control errors.

The managed-integration save path performs a real computer/status probe after applying Veyon settings and reports total, online, and authenticated counts. A zero-sized connection cache by itself is not a failure; cached Veyon connections are opened on demand and expire when idle.

## Screen previews and connection recovery

The Veyon workspace uses the existing capability-protected same-Hub framebuffer
endpoint; credentials and connection UIDs remain on the backend. Wall previews
are bounded to four concurrent visible requests. Compact, comfortable and list
views share the same inventory and commands. Textual failure/retry and last-frame
states distinguish preview availability from TCP connectivity and authentication.

`src/veyon-transport.js` keeps each upstream request deadline active through body
consumption and caps a response at 16 MiB. Image responses are checked for PNG or
JPEG signatures and served using the detected type. Non-image responses fail with
a controlled error rather than being mislabeled as JPEG. The client also decodes
images before swapping the displayed frame.

Connection/session errors (documented WebAPI codes 2, 7 and 8) permit one renewal
and replay; invalid credentials or denied authentication are not blindly retried.
A new connection may authenticate before its first frame is ready: framebuffer
code 10 permits two short retries (200 and 400 ms). Unsupported JPEG (code 9)
or a JPEG encoder failure (code 11) falls back to PNG once. The outer framebuffer loop has at most three attempts. Each
upstream frame request remains separately bounded; UI timeout/cancellation may
precede a slow backend recovery, which will itself finish within those bounds.

Expired sessions are closed before replacement under a per-host single-flight
operation. Cleanup of an old UID cannot delete a newer cached session, and pool
trimming avoids active readers. Stale saved `online`/`authenticated` flags no
longer permanently block a fresh framebuffer attempt. An authenticated user-info
request must succeed before inventory reports authenticated status.

Regression coverage exercises delayed bodies, response limits, image types,
first-frame readiness, codec fallback, bounded retries, connection races and false
authentication. Browser fixtures cover UI recovery; these tests do not prove a
specific endpoint's Veyon key, firewall, display session or codec configuration.

After upgrading, verify a real student preview, a live-view session, a teacher
broadcast, and one reversible command on a selected test endpoint. Confirm list
and compact views show connection state and hidden selections clearly. If a
preview fails, retain its displayed error and the endpoint's connection/auth state
for diagnosis; do not rotate the classroom key or re-enroll computers as a cosmetic
repair. Official protocol reference: https://docs.veyon.io/en/latest/developer/webapi.html.

## Queued classroom commands and recovery

Classroom feature commands are accepted as tracked jobs. The controller shows
Submitting until the Hub accepts the request, then Queued, Running, Retrying,
Confirmed, Accepted, Failed, Skipped, Cancelled, or Outcome unknown per computer.
Queued is never displayed as a confirmed lock. Leaving the page does not cancel
server work; returning refreshes progress. Repeated submissions carry request IDs
so a repeated HTTP request does not execute the same action twice.

The workers process several computers concurrently, serialize actions for each
computer, and check eligibility immediately before that computer's dispatch.
There is no full-class eligibility barrier. Session-dependent commands query the
user rather than fetching unrelated session and feature metadata. Pending
interactive work takes priority over new preview requests; offline retry backoff
must not continuously suppress screenshots.

| Operation | Confirmation and recovery |
| --- | --- |
| Screen/input lock | Read the actual mode, apply the current intent, and read back the mode before reporting Confirmed. Transient failures may retry within a bounded command window. |
| Unlock | Supersedes older waiting lock requests. Per-computer ordering and an intent check prevent stale queued locks from following it. |
| Reboot, shutdown, login, logoff, message, website, app | A successful WebAPI response is Accepted, not proof of the final desktop outcome. An uncertain send is reported as Outcome unknown and is not automatically replayed. |
| Broadcast | Teacher start completes before client jobs run. Owned modes are observed after reconnect, never restarted automatically with old tokens. Hub restart schedules their cleanup. |
| Stop broadcast | Uses the same workers, reports per-computer failures and requires an observed inactive mode instead of swallowing errors. Expired stops retain owned-mode cleanup intent until reconnect. |

A newer broadcast start or stop supersedes any older teacher setup still waiting
to fan out to students, preventing mismatched broadcast sessions.

RoomGoblin-owned screen/input locks and broadcast modes enter the durable SQLite
ownership journal. Credentials, command arguments, and Veyon connection UIDs do not enter
that journal or command-progress responses. After a Veyon outage during the same
Hub session, bounded reconciliation reads actual lock state before applying a
still-valid intent. Failed, cancelled or expired requests cannot become new locks
when a computer returns later.

A fresh **Hub restart clears recorded RoomGoblin-owned locks and broadcasts** as
computers become reachable. It never restores an old classroom lock or replays an earlier reboot,
shutdown or login. This is an ownership-based cleanup, not a blanket reset of
untouched features set by other Veyon controllers. A disconnected computer cannot be
confirmed cleared until it returns and its mode is read back.

The queue runs six workers, allows up to 512 targets per job and 1,024 pending
target operations, and retains at most 128 recent jobs. Ordinary queued requests
expire after two minutes; transient reversible operations use up to eight attempts
with increasing delays capped at 30 seconds. Confirmed locks remain desired for
the current Hub session until explicitly released or the owner's permission is
revoked. Ownership cleanup continues in bounded retry cycles until a confirmed
inactive mode removes its journal entry. Pending cleanup stays visible.

Recent job history and one-shot arguments are memory-only. The durable ownership
journal is capped at 512 host/mode entries; reaching that cap rejects a new owned
mode before changing the endpoint. Restart reconstructs cleanup from this journal,
not the old queue. Background checks also run without an open browser. A normal
idle authentication renewal is not treated as a Veyon server reboot.

Cancellation stops waiting targets; an already dispatched operation may still
finish. Use Unlock to reverse a lock. Retry controls are limited to reversible
locks and exclude targets with a newer command. Dispatch checks the actor's
current permissions and current inventory identity. Recovery export pauses new
queue work and drains active workers before snapshotting the ownership journal.

Validation uses simulated multi-computer and outage fixtures. Actual latency
still depends on endpoint availability, authentication, and the Veyon service;
a fast queue acknowledgement is not a promise that every computer changes
instantaneously.

## Embedded scrolling and preview diagnostics

Inside Lab computers, the controller document owns normal page scrolling. The
same-origin `embedded-workspaces.js` helper sizes the Veyon and Windows frames to
content height, including shrinking after filters. Frames remain mounted across
tab and Focus workspace changes. Live and information dialogs stay inside the
visible parent viewport. Standalone consoles retain their normal page scrolling.
Preview workers use the actual visible parent viewport so an expanded iframe does
not request every screen in a large inventory. Hidden consoles suspend previews.

Preview status and retry controls sit below each screen, preserving the image
area. Empty live frames remain hidden until an image successfully decodes. A
retained last-good frame is labeled when a later request fails.

The root WebAPI probe only establishes service reachability: a root HTTP 404 is
not evidence of authenticated computers or working screenshots. Status responses
include `verification: "reachability-only"`; cached authenticated connection counts
are also not fresh screen verification. The operator UI states this distinction.

A failed framebuffer response includes a safe message, `stage` (authentication or
framebuffer), `reason`, documented Veyon `code` when available and `upstreamStatus`.
It never echoes arbitrary upstream text, private keys or connection UIDs. Network,
DNS, missing-key and timeout failures are categorized; bounded upstream timeouts
return HTTP 504. The UI displays stage, code and HTTP status next to Retry.

If a production preview still fails, capture the failed **framebuffer** request's
**Response** in browser Network tools and the matching Veyon service log. The
outer HTTP 502 alone cannot distinguish key/access problems, endpoint sessions,
encoding failures or upstream availability. Do not treat a green service badge as
proof of working screens or rotate keys without identifying the failure.

On ordinary LAN HTTP pages the browser ignores Cross-Origin-Opener-Policy, so
RoomGoblin omits that header there. HTTPS and loopback origins retain it. This
removes the irrelevant warning without introducing TLS changes or weakening the
existing CSP, capabilities or framebuffer authentication. COOP warnings do not
explain a server-side framebuffer 502.

## Music Assistant setup flow

Music Assistant uses a two-phase setup when the server is not already installed:

1. deploy/adopt the Music Assistant server;
2. open the Music Assistant UI and complete its own first-run setup;
3. in Music Assistant, go to **Settings → Profile → Long-lived access tokens** and create a token for RoomGoblin;
4. return to RoomGoblin, enter the token, and choose **Save & Verify**;
5. RoomGoblin stores the token encrypted and performs an authenticated API check;
6. only after authentication succeeds is Music Assistant considered ready.

The setup/controller card includes an **Open Music Assistant** action. When the container-facing URL uses `127.0.0.1`, the browser link substitutes the current Hub hostname so an administrator can open port 8095 from the workstation browser.

## Music Assistant API validation

Every Music Assistant API request requires an authenticated long-lived token. RoomGoblin uses the Music Assistant API at `/api` and the existing authenticated command path. A stored token that receives an authentication error must leave the integration in `authentication-required` / setup-required state rather than reporting success.

Container state and API state are separate concepts:

- `installed/running`: the Music Assistant process/container exists;
- `configured`: a token is stored;
- `online/ready`: an authenticated API request succeeds.

## Security boundaries

- Integration secrets are written by the main application, not directly by the maintenance container.
- The maintenance agent uses token-bound internal routes that mirror the existing database-backed application handlers.
- Internal maintenance routes must never be exposed without `MAINTENANCE_TOKEN` validation.
- Secret values must not be included in audit payloads, diagnostics, module responses, or browser-visible configuration.
- Host-managed Veyon lifecycle controls must remain blocked even though configuration controls are available.
- Veyon key synchronization may read the native Veyon key store and write only the dedicated `/etc/classroom-control-hub/veyon` compatibility path.

## Upgrade verification

After an upgrade, verify at minimum:

```bash
systemctl status veyon.service veyon-webapi.service --no-pager
veyon-cli authkeys list details
ss -lntp | grep -E '11080|11100'
docker compose ps
curl -fsS http://127.0.0.1:3000/health
```

For the standardized key-file profile, `master/private` and `master/public` must show the same Pair ID.

In the UI verify:

- Veyon shows host-managed and exposes configuration;
- the Veyon key name is `master` unless explicitly migrated to another validated pair;
- the existing Veyon computer count is preserved after legacy JSON migration;
- Veyon reports authenticated computers when reachable clients are available;
- Music Assistant shows setup-required until a valid token is saved;
- **Open Music Assistant** opens the appliance Music Assistant UI;
- invalid/missing Music Assistant tokens fail Save & Verify instead of silently succeeding.

## Dedicated Sendspin transport (selective PR #22 migration)

TVs retain PR #27's ticketed, same-Hub socket validation. The backend alone connects to the configured `sendspinHost:sendspinPort` (normally `:8927/sendspin`) using `src/music-assistant-sendspin.js`. Music Assistant control remains on the authenticated API; never send its token/auth preamble to the raw Sendspin port or consume the first audio/protocol frame as an auth reply. Preserve PR #28's exact host-alias mapping and saved remote/IPv6 settings. The relay bounds buffers and cancels connection timers on all close/error paths.

Do not restore the stashed legacy `server.js`, run PR #22 patch scripts, merge its old font-sizing code, or switch receivers to direct MA sockets. No renderer, SDK, autoplay, database, enrollment or Compose changes are part of this migration. See [Music Assistant Sendspin](MUSIC-ASSISTANT-SENDSPIN.md) for the file-by-file review, tests and upgrade acceptance procedure.

## Veyon extension boundary

RoomGoblin uses the host-managed upstream/OEM Veyon installation and upstream/OEM add-ons only. Custom/community plugin pilots and experimental browser adapters are not part of the supported integration. Feature discovery remains informational; adding an upstream/OEM add-on does not automatically grant a browser action.
