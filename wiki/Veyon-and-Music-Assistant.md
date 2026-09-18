# Veyon and Music Assistant

## Veyon

RoomGoblin uses the native Ubuntu Veyon services when they are already installed:

```text
veyon.service
veyon-webapi.service
```

The Hub detects these services through the Host Agent and labels the integration **Host Managed**. Host Managed means RoomGoblin does not install, remove, or recreate the systemd services. It does **not** mean monitor-only: Veyon application configuration remains editable in RoomGoblin.

### Authentication profile

This appliance is standardized on **Veyon key-file authentication** using a matching key pair named `master`.

Verify the native key store with:

```bash
veyon-cli authkeys list details
```

The `master/private` and `master/public` rows must have the same Pair ID. The Host Agent synchronizes that existing pair into `/etc/classroom-control-hub/veyon/` before startup. The application imports the private key into the encrypted SQLite secret store, which becomes the RoomGoblin authority for the private key.

The Hub does not silently generate or rotate Veyon keys because a rotated public key must also be deployed to every managed workstation.

Veyon itself also supports logon/username-password authentication, but the current RoomGoblin backend profile is key-file authentication. Do not select or document logon authentication as active until that backend path is implemented and tested.

The classroom **Log In User** action uses a masked password dialog. The browser
clears its password field on cancel, close, and immediately after submitting the
one endpoint command; it does not retain or display that password.

### Required Veyon settings

Open the Veyon WebAPI integration configuration and review:

- WebAPI URL (`http://127.0.0.1:11080` is the normal container-to-host value);
- Veyon authentication key name (`master` is the appliance default);
- Veyon private-key import/storage status;
- Veyon public-key/deployment metadata;
- optional scan subnet and range;
- connection pool maximum;
- authentication retries;
- thumbnail concurrency.

The private authentication key is encrypted in the RoomGoblin SQLite database. The computer inventory is also database-backed. A legacy `veyon-computers.json` file is imported and retired during upgrade recovery.

### Domain and SSH credentials

Optional Windows/domain and Linux/SSH credentials are available for endpoint installation/configuration. In the current key-file profile they are not used for normal Veyon control authentication.

Optional deployment credentials can include:

- Windows domain/workgroup, username and encrypted password;
- Linux SSH username, encrypted private key and optional encrypted passphrase.

A future Veyon logon-authentication implementation must store its actual control username/password separately from these deployment credentials.

### Existing computers

Existing database computers do not need to be rediscovered just because the scan subnet is blank. The Hub preserves names, IP addresses, roles and discovery metadata through upgrades.

After saving Veyon configuration, the Hub probes the database inventory and reports counts for configured, online and authenticated computers. A `404` from `GET /` on port 11080 only proves the WebAPI process is reachable; it is not a successful control/authentication test.

## Music Assistant

Music Assistant can be deployed or an existing `music-assistant-server` container can be adopted. The container being present is not enough to mark the integration ready.

A valid long-lived Music Assistant access token is required.

### First setup

1. Install or adopt Music Assistant from **Discover & Configure Services** or **Infrastructure & Recovery**.
2. Choose **Open Music Assistant**.
3. Complete Music Assistant's own setup if needed.
4. In Music Assistant open **Settings → Profile → Long-lived access tokens**.
5. Create a token for RoomGoblin.
6. Return to RoomGoblin and paste the token into the Music Assistant configuration.
7. Choose **Save & Verify**.

The token is encrypted in the RoomGoblin database. Save & Verify performs an authenticated Music Assistant API check. Missing or rejected credentials leave the integration in setup-required/authentication-required state.

When the server-side URL uses `127.0.0.1:8095`, the Open Music Assistant button converts it to the current appliance hostname for browser access.

## Troubleshooting

Veyon host checks:

```bash
systemctl status veyon.service veyon-webapi.service --no-pager
veyon-cli authkeys list details
ss -lntp | grep -E '11080|11100'
```

Music Assistant checks:

```bash
docker ps --filter name=music-assistant-server
ss -lntp | grep 8095
```

RoomGoblin checks:

```bash
docker compose ps
curl -fsS http://127.0.0.1:3000/health
```

Do not deploy the old `veyon/webapi-proxy:latest` image when the native Veyon WebAPI service is present. Native service adoption is the supported appliance architecture.

## Dedicated Sendspin transport (selective PR #22 migration)

TVs retain PR #27's ticketed, same-Hub socket validation. The backend alone connects to the configured `sendspinHost:sendspinPort` (normally `:8927/sendspin`) using `src/music-assistant-sendspin.js`. Music Assistant control remains on the authenticated API; never send its token/auth preamble to the raw Sendspin port or consume the first audio/protocol frame as an auth reply. Preserve PR #28's exact host-alias mapping and saved remote/IPv6 settings. The relay bounds buffers and cancels connection timers on all close/error paths.

Do not restore the stashed legacy `server.js`, run PR #22 patch scripts, merge its old font-sizing code, or switch receivers to direct MA sockets. No renderer, SDK, autoplay, database, enrollment or Compose changes are part of this migration. See [Music Assistant Sendspin](Music-Assistant-Sendspin) for the file-by-file review, tests and upgrade acceptance procedure.

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

RoomGoblin supports the host-managed upstream/OEM Veyon installation and upstream/OEM add-ons only. Custom/community plugin pilots and experimental browser adapters are not part of the supported integration.
