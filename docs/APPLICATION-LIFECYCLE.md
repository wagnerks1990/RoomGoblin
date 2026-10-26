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

Startup then starts the media process and registers bridges in this order:

1. Veyon keyring compatibility.
2. Veyon DHCP/stable inventory identity.
3. Veyon update routes.
4. Managed Cloudflare routes.
5. Maintenance mirrors and Music Assistant player aliases.
6. The main application's routes, integrations and listeners.

These bridges currently wrap Express registration. Their ordering is a
compatibility requirement. Removing them requires feature-specific route and
authorization tests; it is not a safe source-wide cleanup.

## Media process ownership

`src/media-plane-process.js` owns the child and its exit listener. Unexpected
child exit, including exit code zero, fails the application with code 1 so the
container restart policy can restore both listeners. An abrupt owner exit uses
SIGKILL because a Node exit handler cannot await asynchronous cleanup.

On SIGINT/SIGTERM, the Hub rejects new HTTP requests and WebSocket messages.
After any existing Full Recovery export thaws, it starts its HTTP drain and the
media child's drain together. Repeated media stop calls share one promise. The
child retains its five-second HTTP shutdown deadline; the supervisor escalates to SIGKILL after six seconds and
waits for the exit event. The application retains its ten-second overall deadline
and waits for the media child before closing SQLite and exiting normally.

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

After the listeners, child and writers drain, shutdown flushes pending audit
records and performs a nonwaiting SQLite WAL checkpoint. A busy/failed checkpoint,
pending audit write or drain deadline exits with status 1; it must not be reported
as a clean stop. The deadline does not close SQLite underneath pending writers.
Long external operations or conversions can still exceed this budget; their
individual cancellation/restart semantics remain feature-specific.

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
the media child to verify failure propagation. Linux is required for signals and
the `/proc` child-ownership check. Supervisor tests also cover repeated stop,
deadline escalation, spawn errors and abrupt-owner fallback.

Writer regressions launch the canonical process with temporary SQLite data and
loopback clients. They cover disconnected/finished HTTP handlers, a pending
WebSocket command with a controlled MQTT adapter, manual interruption, scheduled
restart recovery versus operator cancellation, active thaw and pending freeze
races, deadline failure and a busy checkpoint. Announcement queue tests cover a
failed predecessor followed by a queued writer. This is not live hardware,
production presentation conversion, or end-to-end Sports/Ubuntu acceptance.

There is no schema, version, receiver identity, port, authentication or dependency
migration. Deployment requires the normal validated-main image pair and backed-up
updater. Rollback uses the existing previous-deployment recovery path. Do not
deploy a branch, change live displays, or bypass publication checks to test this.
