# Application lifecycle

## Bootstrap ownership

`npm start` and `tools/start-roomgoblin.sh` execute
`node --require ./src/direct-display-compat.js src/startup-recovery.js`.
The shell wrapper uses `exec`, preserving the Hub as the container's PID 1.
The npm wrapper is a development convenience, not the container entry point.

The preload installs configured display-gateway compatibility before Express
application creation. Startup recovery sets the private umask, resolves the
authoritative database filename, repairs incomplete built-in profiles, migrates
legacy Veyon inventory and reconciles the synchronized Veyon key metadata.
These existing recovery operations and their persistent identifiers are retained.

Startup then starts the media process. `server.js` creates its Express application,
installs handler tracking, and explicitly calls `installApplicationBridges(app)`
from `src/application-bridges.js` before registering routes. It installs:

1. Veyon keyring compatibility.
2. Veyon DHCP/stable inventory identity.
3. Veyon update routes.
4. Managed Cloudflare routes.
5. Maintenance mirrors and Music Assistant player aliases.
6. The main application's routes, integrations and listeners.

The bridges wrap only that application's registration methods. Importing their
modules does not change Express prototypes. Installation is idempotent, and
management-route registration flags belong to the installed application. Their
order preserves existing authentication, maintenance mirrors and Veyon/Music
Assistant transforms; the display-gateway preload remains independent.

Direct control-only `server.js` starts also install these bridges. Both entry
points therefore own the same API composition; the canonical bootstrap still
owns startup recovery and the media child. The bridge helpers retain the existing
process-wide integration stores/caches; this is not a multi-tenant application
factory. Administrator guards are still captured from the existing admin route
registrations, so keep those guards first. Existing rate-limited routes elsewhere
retain their rate middleware before authorization.

`test/application-bridges.test.js` exercises real loopback requests for app
isolation, administrator guards, maintenance-token separation, Veyon identity/key
composition, Music Assistant aliases and async drain/error propagation. It uses
temporary SQLite data without contacting external integrations.

## Media process ownership

`src/media-plane-process.js` owns the child and its exit listener. Unexpected
child exit, including exit code zero, fails the application with code 1 so the
container restart policy can restore both listeners. An abrupt owner exit uses
SIGKILL because a Node exit handler cannot await asynchronous cleanup.

On SIGINT/SIGTERM, the Hub rejects new HTTP requests and WebSocket messages.
After any existing Full Recovery export thaws, it starts its HTTP drain and the
media child's drain together. Repeated media stop calls share one promise. The
child retains its five-second HTTP shutdown deadline; the supervisor escalates
to SIGKILL after six seconds and waits for the exit event. Only an unforced
code-zero exit without a signal or signaling error is successful. A failed signal
does not prove termination: retain the deadline and abrupt-owner kill fallback
until actual exit. Spawn failure without a child PID still fails immediately.
The application retains its ten-second overall deadline.

Listener and child closures settle before the accepted-writer barrier completes.
A child/listener failure must not short-circuit that barrier: finish accepted
writes, flush audit records, checkpoint and close SQLite, then exit 1 with the
failure reported. A stuck writer or child still fails at the overall deadline.

Shutdown clears the startup/periodic timers for presentations, Background Music,
retention, updates, upload cleanup and login cleanup as well as the existing
scheduler and integration timers. Sports closes its initial and periodic refresh
timers. An announcement watcher completing during shutdown cannot re-arm itself
or schedule a release retry.

## Writer drain and restart policy

The shutdown barrier waits for registered HTTP handler promises even after a
response finishes or its client disconnects. `src/application-drain.js` wraps
only the application's public route/use registration methods, preserving route
guards, nested handler arrays, errors and bridge ordering. It does not replace
Express prototypes or inspect private router stacks. New code must return its
async promise; detached work must have an explicit tracked owner. Mounted routers
would need their own registration tracking; none are currently used by the Hub.

The barrier also waits for WebSocket message handlers, tracked asynchronous
mutations (including Veyon, ESPHome, Ubuntu displays and Sports), queued/running
announcement lifecycle work, presentation conversions/advance, session effects,
music reconciliation, scheduler occurrences and update/status jobs. A WebSocket
peer gets one second to acknowledge close before termination; server close
callbacks finish before SQLite closes. MQTT close is awaited too.

Automation waits stop at the next action/dwell boundary (at most 500 ms during a
dwell) with `interrupted` / `server-shutdown` recorded in the existing ledger.
Already requested operator cancellation retains precedence and remains
`cancelled`. On restart, only a currently applicable winning scheduled continuous
occurrence can recover. Manual runs do not automatically restart. Commands already
delivered to hardware are not undone or replayed by the shutdown handler.

Full Recovery's freeze remains independently owned. Shutdown aborts an unfinished
freeze acquisition, but an already active freeze keeps its authenticated,
one-use `export-thaw` endpoint reachable. Other new requests receive HTTP 503.
Shutdown does not clear the export's token or emit interruption writes while its
freeze is held. Waiting for thaw consumes the same ten-second total deadline.

Full Recovery acquisition also waits for `httpHandlers.pendingMutations`.
The shared admission predicate classifies mutating HTTP requests once at
application entry, before mounted middleware changes their path. Returned
handler and error-handler promises remain counted after response finish or
disconnect. Freeze/thaw and the initiating `/api/v1/maintenance/backup/create`
proxy are excluded from this mutation count, but remain in the shutdown count.
New mutations stay locked while acquisition waits. An aborted body cannot start
a late handler during the freeze. The existing 30-second acquisition deadline
fails without issuing a token if work remains; it does not cancel that work or
close SQLite. Read methods and explicitly tracked background owners retain their
existing policy. Detached work still requires explicit ownership.

ESPHome discovery is a GET operation with explicitly tracked asynchronous work
and a success audit. Its manager checks admission before cache lookup or pending
scan reuse, so new calls cannot enter while export acquisition/freeze or close
holds the lifecycle lock. Already accepted discovery drains normally. Audit
records remain buffered while freeze is requested and flush after authenticated
thaw; shutdown waits for the final audit before closing SQLite.

Authentication reads must not become snapshot writers. The Hub supplies storage's
`canMaintainAuth` callback to pause session cleanup, session last-seen and device
credential last-used writes during freeze acquisition, active freeze and shutdown.
Session/credential validation remains immediate: expired, revoked, disabled or
unknown identities still fail; session lists filter expiry without deleting rows.
Skipped cleanup does not advance its throttle, so a later allowed read performs
overdue maintenance. Other storage users retain the default housekeeping policy.

System Updates status remains readable during freeze, including a request already
waiting on maintenance when freeze starts. `recordUpdateJob` checks the current
freeze state before writing history. The next unfrozen poll records the latest
job once; this is a bounded status cache, not the native transaction journal.
Accepted update-history work still persists normally during shutdown.

Veyon GET/HEAD routes also participate in the mutation barrier: their identity
bridge can initialize storage, persist stable mappings and move key affinity;
inventory/info/preview authentication can update hostnames or key metadata.
Administrator config/keyring reads can import compatibility key metadata too.
The shared predicate pauses these routes and the maintenance inventory mirror
with HTTP 423 during acquisition/freeze, including Express case/trailing-slash
aliases. Accepted handler promises drain through their final writes. Keep the
save-before-project identity contract; do not return stable IDs that were not
persisted. The separate maintenance config mirror has no keyring projection and
remains token-protected and available to recovery. Ordinary authentication and
update-status reads retain their read-only freeze policy.

The Veyon idle-pool timer checks freeze/shutdown admission and tracks its entire
cleanup promise. Removing a computer also tracks its detached connection close
while retaining the immediate API response. Accepted closes and their audits
therefore finish before clean shutdown or freeze acknowledgment; audit persistence
still waits for thaw when appropriate. Network close and overall lifecycle
deadlines are unchanged, so an over-budget drain remains an explicit failure.

After the listeners, child and writers drain, shutdown flushes pending audit
records and performs a nonwaiting SQLite WAL checkpoint. A busy/failed checkpoint,
pending audit write or drain deadline exits with status 1; it must not be reported
as a clean stop. The deadline does not close SQLite underneath pending writers.
Long external operations or conversions can still exceed this budget; their
individual cancellation/restart semantics remain feature-specific.

Before listeners or conversions start, `src/presentation-staging.js` reclaims
orphan `render-<UUIDv4>` directories beneath `presentation-upload-tmp`. One pass
inspects at most 512 root entries, considers 64 render directories and validates
8192 tree nodes with depth capped at eight. A candidate is fully validated before
deletion. Root/child symbolic links, hard-linked files, special files, changed
identities and different owners/filesystems are not deleted. Unknown upload
files and names remain untouched. Refused or over-budget entries produce a
generic startup warning rather than blocking the Hub. This is startup-only work;
it must never run over active conversions. Originals and completed assets live
outside this staging tree and retain the existing rebuild/backup policy.

## Scheduled music readiness

`src/music-assistant-readiness.js` checks only whether the encrypted Music
Assistant token row exists; it does not read or log the token. Its read-only SQLite
connection reopens when the configured file or inode changes and closes on read
failure or shutdown. Adding/removing credentials is observed on the next check.

The three direct timer-driven Background Music calls explicitly check this readiness,
shutdown and Full Recovery freeze before running. Maintenance route registration
does not replace global timers or examine callback source strings. Direct/manual
calls retain their immediate errors and existing announcement/audio-priority logic.
An announcement release retry can reconcile displays even without a music token;
mentioning a music tick inside that callback must not suppress its other work.

## Verification and deployment

`test/application-lifecycle.test.js` launches the declared Node startup command
against temporary data and loopback ports, verifies guarded maintenance routes
and both health endpoints, holds a media connection during shutdown, and kills
the media child to verify failure propagation. Both a media connection that
drains normally and one exceeding the child's deadline are covered. Linux is
required for signals and the `/proc` child-ownership check. Supervisor tests also cover repeated stop,
deadline escalation, nonzero/signal exits, signaling errors, spawn errors and
abrupt-owner fallback. Forced termination remains a failure even if a racing
child exit reports code zero.

Writer regressions launch the canonical process with temporary SQLite data and
loopback clients. They cover disconnected/finished HTTP handlers, a pending
WebSocket command with a controlled MQTT adapter, media failure while an accepted
HTTP writer is held behind a test gate, manual interruption, scheduled
restart recovery versus operator cancellation, active thaw and pending freeze
races, deadline failure and a busy checkpoint. Announcement queue tests cover a
failed predecessor followed by a queued writer. This is not live hardware,
production presentation conversion, or end-to-end Sports/Ubuntu acceptance.

Export regressions hold an accepted writer behind a test-owned gate, disconnect
or finish its response, then verify freeze acknowledgment follows its final
SQLite write. They also exercise rejection cleanup, acquisition timeout/retry,
the real administrator proxy with a loopback maintenance fixture, and stable
mutation classification through mounted middleware and async error handlers.

Discovery regressions run the real manager, administrator route, freeze/thaw,
shutdown and SQLite audit path with a controlled worker IPC stream. They cover
new/cached admission, accepted discovery across freeze and shutdown, and deferred
audit persistence. They do not perform a physical mDNS scan.

`test/background-lifecycle.test.js` exercises the real initial Sports refresh
timer, Ubuntu scheduled poll and authenticated presentation upload with temporary
SQLite data. Feed/SSH transports and rasterization are controlled test adapters.
Held operations must persist their final results before freeze acknowledgment or
clean shutdown; freeze audits flush only after thaw. A claimed Ubuntu job must
not dispatch again on restart. An over-budget conversion must fail shutdown,
retain its original file, recover to an explicit interrupted state and permit
rebuild. These tests qualify lifecycle ownership, not physical device behavior,
external feed availability or visual rendering quality.

There is no schema, version, receiver identity, port, authentication or dependency
migration. Deployment requires the normal validated-main image pair and backed-up
updater. Rollback uses the existing previous-deployment recovery path. Do not
deploy a branch, change live displays, or bypass publication checks to test this.
