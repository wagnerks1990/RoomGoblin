# Core architecture and lifecycle

Audited baseline: `c2808c8ba861b852e6bbe8dec8c52d8251227756`.
Original finding locations refer to that revision. Follow-up locations below
explicitly identify their newer baseline.

## Coverage

Read in full: `tools/start-roomgoblin.sh`, `src/startup-recovery.js`,
`src/direct-display-compat.js`, `src/display-gateway.js`,
`src/media-server.js`, `src/maintenance-route-bridge.js`,
`src/veyon-keyring-bridge.js`, `src/veyon-dhcp-identity-bridge.js`,
`src/veyon-update-bridge.js`, `src/cloudflare-bridge.js`,
`src/sports-routes.js`, package scripts and changed tests/modules.

Reviewed selected lifecycle regions of `src/server.js`: configuration and writer
tracking; announcement watcher/retries; automation cancellation/waits and recovery
guards; presentation timer; Veyon queue construction; retention/update timers;
HTTP/WS mutation accounting; Full Recovery freeze; integration construction;
scheduled music callers; listener startup and shutdown. The remaining routes,
business functions and full integration implementations were **not** line-by-line
audited. ESPHome/Ubuntu/Veyon close paths were sampled for ownership only.

The initial shutdown review is therefore not a whole-application drain proof.
Follow RG-ARCH-004 before marking this review unit complete.

## RG-ARCH-001: implicit startup composition

- **Subsystem/category/priority:** Core lifecycle / Architecture / P2.
- **Location:** `package.json:13-14`, `tools/start-roomgoblin.sh:1-10`,
  `src/startup-recovery.js:148-157`, `src/maintenance-route-bridge.js:23-48`,
  `src/server.js:1072-1090`.
- **Current implementation:** npm starts `server.js` directly. Production installs
  the preload, recovery and bridges first. The maintenance bridge replaces global
  timeout/interval functions and recognizes music work by callback source text.
- **Evidence:** The commands differ in source. Loading the bridge changes timer
  function identities; callback name/text and delay determine whether it runs.
  The announcement release retry contains `backgroundMusicTick` and has a 5-second
  delay, so missing music credentials suppress its display reconciliation too.
- **Problem:** Development startup omits production behavior. A renamed callback
  can bypass the readiness guard, and unrelated recovery work can be suppressed.
- **Recommendation/benefit:** Share the canonical Node command and explicitly
  check scheduled music readiness, making startup and call ownership visible.
- **Complexity/risk:** Small / Medium; maintain bridge order, token-row probing,
  atomic-database reopen and direct/manual command behavior.
- **Verification:** Actual declared-command startup, both health endpoints,
  authenticated/unauthenticated maintenance route checks, unchanged global timers,
  token insertion/removal, database replacement and execution of surrounding
  recovery work when no music credentials exist.
- **Confidence:** Confirmed from code and current behavioral regressions.
- **Status:** Implemented and locally tested for entry-point/timer ownership.
  The bridge follow-up below replaces global prototype patches with explicit
  application-owned registration and adds route-composition/authentication fixtures.

## RG-ARCH-002: media child outlives normal shutdown

- **Subsystem/category/priority:** Core lifecycle / Reliability / P2.
- **Location:** `src/startup-recovery.js:103-128`, `src/media-server.js:152-155`,
  `src/server.js:8559-8570`.
- **Current implementation:** The parent's exit hook only sends SIGTERM; it cannot
  await the child's HTTP drain or escalate after the parent is gone.
- **Evidence:** The child permits a five-second drain, while parent exit is
  immediate after the control listener/Veyon drain. No child-exit wait exists.
- **Problem:** Process supervisors can observe completion while the old media
  child still owns its port; bare development startup can leave an orphan.
- **Recommendation/benefit:** Give one module explicit start/stop ownership,
  await exit, bound escalation, and use synchronous kill only on abrupt exit.
- **Complexity/risk:** Small / Medium; retain failure of the whole pair when the
  media child unexpectedly dies and preserve the overall ten-second deadline.
- **Verification:** Linux test holds a real incomplete media HTTP request during
  SIGTERM and checks the child has been reaped when the parent exits. Separate
  tests cover unexpected death, zero exit, spawn error, repeated stop, escalation
  and abrupt owner exit.
- **Confidence/status:** Confirmed / Implemented and locally tested.

## RG-ARCH-003: shutdown leaves owned timers scheduled

- **Subsystem/category/priority:** Core lifecycle / Reliability / P2.
- **Location:** `src/server.js:750-754,1072-1090,3205-3206,5053-5056,8391-8392,8559-8570`;
  `src/sports-routes.js:19-22`.
- **Current implementation:** Shutdown clears some recurring timers, but misses
  music/presentation/cleanup timers and anonymous initial timers. The announcement
  watcher unconditionally schedules its next pass in `finally`.
- **Evidence:** Registration/cleanup comparison; the sports close method is
  returned but never called by shutdown.
- **Problem:** While HTTP or media drains, new background work can start or re-arm.
- **Recommendation/benefit:** Name initial timers, clear owned timers, close sports
  refresh and prevent announcement watcher/retry rearming during shutdown.
- **Complexity/risk:** Small / Low; no running-state scheduling or priority changes.
- **Verification:** Review every changed timer registration against its cleanup;
  run the real slow-media shutdown and full scheduler/presentation/music suite.
- **Confidence/status:** Confirmed / Implemented; local regression suite passed.
  This is timer cleanup, not cancellation of already-running tasks.

## RG-ARCH-004: shutdown can exit before asynchronous writes finish

- **Subsystem/category/priority:** Core lifecycle / Reliability / P2.
- **Location:** `src/server.js:4882-4900,5932-5958,8460-8473,8559-8570`.
- **Current implementation:** Full Recovery tracks asynchronous mutations and busy
  domains. Shutdown waits for HTTP close and the Veyon queue, then closes SQLite.
- **Evidence:** The shutdown predicate does not include the export writer counters,
  running automation map or presentation builds. A disconnected response does not cancel its async handler. Controlled Linux
  process tests now reproduce the outstanding write and inspect final SQLite
  state; no production data-loss incident is claimed.
- **Problem:** Completion of every asynchronous writer is not established before
  closing its store. A long-running task can lose its final status write on exit.
- **Recommendation/benefit:** Audit all writer owners and introduce a bounded
  shutdown barrier with explicit task stop policies, preserving scheduled
  occurrence recovery. Do not repurpose Full Recovery's freeze flag or mark all
  running schedules operator-cancelled, which would suppress restart recovery.
- **Complexity/risk:** Medium / High; persistent run status, external command
  delivery and recovery identity cross multiple domains.
- **Verification:** Real in-flight HTTP/WS, scheduled/manual continuous automation,
  presentation conversion, sports/Ubuntu and announcement jobs during SIGTERM;
  inspect final SQLite state and subsequent restart recovery. Include hard deadline
  and active export/thaw races.
- **Confidence/status:** Confirmed / Bounded drain implemented for registered
  handlers and existing tracked/busy owners. Process regressions verify final
  HTTP/WS writes, automation restart policy, freeze coordination and failure
  deadlines. Feature-specific physical acceptance remains open.

### Follow-up coverage and implementation

Baseline: `ea53e2deff70dbb151ca551ddd27b89c633d6afd`, alpha.85.
Relevant original locations: `src/server.js:89-93` (async tracking), `747-753`
(announcement queue), `1824-1846` (action cancellation/dwell), `4743-4756`
(request accounting), `4896-4936` (freeze/thaw), `5962-5988` (manual ledger),
`8016-8036,8366-8407` (WebSocket ownership), `8501-8520` (scheduled ledger),
`8602-8621` (shutdown). These are baseline locations, not patched line numbers.

Read the new drain module and its tests in full. Re-reviewed the selected server
regions above plus timer entry points, integration construction/close contracts,
announcement serialization and scheduled recovery. This remains a scoped review,
not a claim that every line of the main server or every integration was audited.

| Owner | Shutdown policy |
| --- | --- |
| HTTP routes and middleware, including bridge registrations | Track returned promises past response finish/disconnect; preserve Express error and guard behavior |
| WebSocket handlers and MQTT delivery | Reject new work, await active message counters and close callbacks; bound WebSocket handshake |
| Manual/scheduled automation occurrences | Interrupt at action/dwell boundaries; preserve operator cancellation and current-winner restart recovery |
| Announcement lifecycle queue | Count queued and active work; prevent timer rearming |
| Presentation builds/advance, session effects, music, update jobs | Wait for existing build maps and busy ownership flags |
| Veyon, ESPHome, Ubuntu, Sports | Stop admission/timers and wait for their existing tracked mutations |
| Full Recovery export | Abort pending acquisition; keep active authenticated thaw reachable; never steal its freeze |

SQLite closes only after those owners drain and audit/checkpoint succeed. A
nonwaiting checkpoint avoids blocking past the shutdown deadline on another
reader. Hardware commands already sent are not reversed. A task exceeding the
fixed deadline fails the stop; durable feature-specific restart/cancellation for
long conversions or remote operations is not added by this patch.

The HTTP tracker uses application-instance registration, not global Express
prototype patches or private stack traversal. It cannot discover work that a
handler detaches without returning/tracking it. Future mounted routers require
explicit registration tracking. Existing bridge authentication/order tests and
all repository gates remain required. The bridge follow-up below covers the
retained registration composition; integration business logic remains separate.

## RG-ARCH-005: import-time bridges modify unrelated Express applications

- **Subsystem/category/priority:** Core lifecycle / Architecture and reliability / P2.
- **Baseline:** `38db6b8d9bf8fad328fa2639c592b4f739dcca3a`, alpha.85.
- **Location at baseline:** `src/maintenance-route-bridge.js:103-153`,
  `src/veyon-keyring-bridge.js:49-96`, `src/veyon-dhcp-identity-bridge.js:89-94`,
  `src/veyon-update-bridge.js:63-82`, `src/cloudflare-bridge.js:35-52`,
  `src/startup-recovery.js:127-132` and `src/server.js:4749-4750`.
- **Current implementation/problem:** Module imports replace shared Express
  methods and share management-route registration flags. API composition depends
  on import timing rather than the application owner, complicating isolated
  validation and making additional application instances incomplete.
- **Evidence:** An isolated baseline process creates an Express app, imports the
  Veyon update bridge, then creates a second app. The shared prototype changes;
  only the later app gets management routes. Global registration flags also
  prevent later applications from independently registering their own routes.
  This is reproduced load-order dependence, not a claimed production incident.
- **Recommendation/benefit:** Install the existing compatibility hooks explicitly
  per application. This makes ordering visible, prevents unrelated application
  changes and permits realistic composition tests without prototype cleanup.
- **Complexity/compatibility risk/confidence:** Small / Medium / Confirmed.
- **Implementation:** `installApplicationBridges(app)` installs the five bridges
  in their existing order after handler tracking. Each bridge captures only the
  owning app's methods; management registration flags move into that installation.
  Repeated composition is a no-op. Both canonical and direct control-only starts
  now use the same explicit route composition.
- **Preserved boundaries:** Administrator guards, maintenance token separation,
  backend-ID maintenance inventory, stable public Veyon IDs, key metadata only,
  Music Assistant aliases and returned handler promises. Display gateway preload,
  integration stores/caches, database identity and external provisioning behavior
  are unchanged. Existing route hooks still identify their established paths and
  capture the existing first administrator guard; they are not a generic router.
- **Review:** Read all five bridge modules and the new coordinator in full;
  inspect startup, Hub construction, handler tracking and relevant tests. This
  does not audit all Veyon/Cloudflare/Music Assistant business implementations.
- **Verification:** Five loopback subprocess scenarios cover imports/unowned apps,
  repeat installation, two separately guarded applications, every generated
  management route's rejection boundary, safe authenticated routes, maintenance
  mirrors, key/identity transforms, aliases, async rejection and post-response
  writer drain. Fixtures own their SQLite data and never call real integrations.
- **Risk/limit:** Application-local routing is not multi-tenant storage isolation.
  Process-wide integration caches and stores remain intentional compatibility
  state. Physical device and external provisioning acceptance remain separate.
- **Status:** Implemented and locally tested; exact-head CI and delivery are
  recorded in the pull request.

## RG-ARCH-006: export freeze releases HTTP ownership before the writer finishes

- **Subsystem/category/priority:** Core lifecycle / Recovery reliability / P1.
- **Baseline:** `da6bb77187bd23787239347db903ab842fbc6683`, alpha.85.
- **Location at baseline:** `src/server.js:4755-4764,4905-4925`;
  `src/application-drain.js:9-17,50`.
- **Current implementation/problem:** Shutdown tracks returned handler promises,
  but export acquisition only counts the HTTP response lifetime. A disconnected
  or completed response can release its mutation count before the handler's final
  write, allowing snapshot acknowledgment while that write is still possible.
- **Evidence:** Three canonical-process tests fail on the baseline: hold an
  admitted writer, disconnect/finish its response, and request a freeze. The
  freeze returns before the final SQLite preference write. The rejection case
  reproduces the same gap. These are isolated fixtures, not a production incident.
- **Recommendation/benefit:** Reuse handler ownership for mutating HTTP requests
  so snapshot acquisition observes completion rather than transport closure.
- **Complexity/compatibility risk/confidence:** Small / Medium / Confirmed.
- **Implementation:** Cache the shared mutation predicate at application entry;
  count returned handler/error-handler promises separately from all shutdown
  work. Add that count to export acquisition. Preserve response-lifetime counting
  for body parsing and exclude freeze/thaw/export proxy from mutation accounting.
  Prevent an aborted parser from starting another handler while freeze is pending.
- **Verification:** Real canonical Hub, temporary SQLite and loopback clients:
  disconnect, early response, rejection, final write before freeze acknowledgment,
  one-use thaw, 30-second acquisition failure followed by completion/retry, and
  administrator export proxy calling back through real freeze/thaw endpoints.
  Tracker tests retain classification across mounted middleware and async errors.
- **Preserved boundaries:** Existing authentication/transport policy, independent
  export ownership, host lock, timeout/lease, shutdown deadline, schema, identities
  and deployment/rollback path. No production export or external service command
  is needed for these regressions.
- **Review/limit:** Read the tracker, admission/freeze/thaw/proxy functions and
  changed fixtures/tests in full. This covers returned mutating HTTP promises;
  read-method side effects, detached callbacks and integration-specific writers
  still require their explicit owners and feature acceptance. It is not a new
  whole-application snapshot proof.
- **Status:** Implemented; validation and delivery are recorded separately.

## RG-ARCH-007: media shutdown loses exit status and child ownership

- **Subsystem/category/priority:** Core lifecycle / Reliability and observability / P2.
- **Baseline:** `446a9523da9a160bc510e679397269c9097aeb1d`, alpha.85.
- **Location at baseline:** `src/media-plane-process.js:9-44`,
  `src/server.js:8652-8674`, `src/media-server.js:152-155`.
- **Current implementation/problem:** Requested child shutdown ignores its exit
  status. The child's five-second HTTP timeout, signal death and forced kill all
  resolve as success. A signaling error also drops ownership before actual exit.
  Simply rejecting on child failure would make the Hub's fail-fast closure wait
  abandon accepted writers before the existing drain barrier.
- **Evidence:** Nine failures in a 25-test native Linux baseline run reproduce
  false-success outcomes and premature release of child ownership. A canonical
  process with an incomplete media request exits zero after the media deadline.
  These are temporary-data fixtures, not a claimed production incident.
- **Recommendation/benefit:** Preserve the first failure, settle shutdown only
  on actual child exit, and await all listener closures plus accepted writers
  before reporting failure. This makes exit status trustworthy without losing
  accepted work or orphaning a child after a failed signal.
- **Complexity/compatibility risk/confidence:** Small / Medium / Confirmed.
- **Implementation:** Distinguish spawn failure from running-child errors using
  the assigned PID. Retain escalation and owner-exit cleanup after signaling
  errors; ignore reentrant errors during owner exit. Treat nonzero/signal and
  forced exits as failures. Hub closure uses settled results and reports failure
  after writer drain and SQLite cleanup, within the same overall deadline.
- **Review:** Read the supervisor, media listener, shutdown function and changed
  fixtures/tests in full. Review the writer barrier and canonical process helper.
  This is not an exhaustive server or media-playback audit.
- **Verification:** Clean and timed-out media connections, signal death with a
  held accepted writer, final SQLite persistence, repeated stop, nonzero/signal
  exits, forced kill with a racing zero exit, emitted/thrown signaling errors,
  spawn failure and abrupt-owner cleanup. Baseline and candidate counts are in
  [validation evidence](validation.md); delivery belongs to the PR record.
- **Preserved boundaries/limits:** Five/six/ten-second deadlines, independent
  Full Recovery freeze ownership, authentication, media ports, receiver sessions,
  automation interruption/recovery, schema and dependencies remain unchanged.
  No physical playback or production fault injection is claimed.
- **Status:** Implemented; validation and delivery recorded separately.

## RG-ARCH-008: discovery bypasses the manager's lifecycle admission

- **Subsystem/category/priority:** Core lifecycle / Reliability / P2.
- **Baseline:** `4ca4f7c4fc81a4b53321e88319e7ea5768d4d211`, alpha.85.
- **Location at baseline:** `src/esphome.js:139-168,251-265`;
  `src/server.js:5283-5287,3677-3711`.
- **Current implementation/problem:** Discovery returns cached/pending work or
  starts its helper without the `canRun`/closed check used by other operations.
  Its GET route bypasses the generic mutating-method admission guard. A paused
  or closed manager can therefore admit another scan or successful cached call.
- **Evidence:** Five corrected baseline regressions fail: four manager states
  (cold, cached, pending and closed), and a real administrator GET returning 200
  while a canonical Hub export is frozen. Accepted discovery already drains
  correctly. Audit persistence is already buffered during a freeze, so this is
  not evidence of a SQLite snapshot write or production corruption.
- **Recommendation/benefit:** Apply the existing manager admission check before
  every discovery path, keeping lifecycle pause semantics consistent and avoiding
  additional discovery work while the application is quiescing.
- **Complexity/compatibility risk/confidence:** Small / Low / Confirmed.
- **Implementation:** `discover()` calls `checkRun()` before cache lookup, reuse
  or spawn. Existing accepted scans and their tracking/audit policy are retained.
- **Review:** Read `src/esphome.js`, `src/ubuntu-displays.js` and
  `src/sports-service.js` in full for lifecycle ownership; review their Hub wiring,
  audit/freeze code and discovery UI error handling. Native device workers and
  physical device acceptance remain separate feature review units.
- **Verification:** Manager admission permutations plus real canonical-process
  administrator discovery, freeze/thaw and shutdown with temporary SQLite and a
  controlled worker IPC stream. Verify no new worker/success audit on rejection,
  normal retry/cache after thaw, accepted-work drain and deferred audit flush.
- **Preserved boundaries/limits:** Authentication, rate limits, discovery result
  bounds, credential-free helper, native device state and audit buffering.
  Tests do not perform mDNS, device adoption or hardware commands.
- **Status:** Implemented; validation and delivery recorded separately.

## Completion boundary

### Feature-owner lifecycle coverage follow-up

Baseline: `a2c78bb03ff1567c9bf69318000bbc81b9d41a88`, alpha.85.
Seven canonical-process regressions extend RG-ARCH-004 coverage. The real initial
Sports timer persists fetched events/source status before shutdown or freeze.
The real Ubuntu poll claims a scheduled check before dispatch, drains its delayed
acknowledgment, persists history/audit and does not replay it after restart.
The real presentation upload promotes assets and its library record before a
clean stop or freeze; a conversion exceeding the ten-second stop budget retains
its source and recovers as interrupted/rebuildable. Existing behavior passed;
this follow-up adds protection and does not claim a newly repaired runtime defect.

Read `src/veyon-command-queue.js` in full, and re-read the Sports/Ubuntu managers,
their Hub wiring, presentation conversion/upload/rebuild and restart regions.
The retained legacy session dashboard is unreachable behind the existing HTTP
410 retirement guard; its detached callback is not treated as a live writer bug.
Physical commands, external feed correctness and rasterizer output quality remain
in their feature-specific review units. Authentication read-side housekeeping was
a further review lead; the separately reproduced finding below addresses it.

### RG-ARCH-009: read requests perform housekeeping during snapshot freeze

- **Subsystem/category/priority:** Core lifecycle / Snapshot consistency / P2.
- **Runtime baseline:** `a2c78bb03ff1567c9bf69318000bbc81b9d41a88`, alpha.85;
  the test-only follow-up `ee97d7a90ac6d6766d721eec6a290afae8fdd290` has the same
  application source.
- **Locations:** `src/storage.js:490,500,532-541` (authentication housekeeping),
  `src/server.js:201,3831-3836,5056,5072` (storage wiring and update-status history).
- **Problem/evidence:** An authenticated GET advances session activity after the
  real freeze endpoint acknowledges a snapshot. A held System Updates GET writes
  its history when the maintenance response arrives inside that freeze. Storage
  regressions also reproduce cleanup and credential activity writes when reads
  are required to remain read-only. These are metadata consistency violations;
  no credential corruption or production incident is claimed.
- **Implementation:** An application-owned `canMaintainAuth` predicate pauses only
  cleanup/activity writes. Validation and expiry/revocation filtering remain live.
  Update history checks freeze at its write boundary; status stays available and
  a later unfrozen poll records the latest job without duplicate entries.
- **Complexity/risk/confidence:** Small / Medium / Confirmed. Do not use stale
  authentication caches, extend session expiry or treat frozen reads as authorized
  without checking the current database. No schema or credential migration.
- **Review:** Read `src/storage.js` in full; inspect all Hub session/credential
  callers, freeze/thaw, update-status/poll wiring and existing throttle tests.
- **Verification:** Canonical Hub freeze/read/thaw with temporary SQLite, a held
  loopback maintenance response, and storage reads under SQLite `query_only`.
  Check valid/expired/revoked/disabled identities, skipped cleanup throttling,
  post-thaw activity/history persistence and duplicate-history coalescing.
- **Limits:** This closes the identified read-side owners, not every integration
  read path. The native update journal, backup/rollback, access profiles, optional
  receiver credentials and Full Recovery transport/ownership remain unchanged.

### RG-ARCH-010: Veyon read-side identity writers bypass snapshot admission

- **Subsystem/category/priority:** Core lifecycle / Snapshot consistency / P2.
- **Baseline:** `c74d6417fd14bf1773829002f4c472543141887f`, alpha.85.
- **Locations:** `src/server.js:2873-2888,4750-4754,7163-7177`;
  `src/veyon-dhcp-identity-bridge.js:22-32`; keyring metadata/transport bridges.
- **Problem/evidence:** A canonical Hub with an empty inventory writes the
  `veyon.inventory-hostmap.v2` preference after freeze acknowledgment. GETs
  bypassed admission and returned-promise mutation tracking. Populated inventory
  can also persist discovered hostnames; Veyon authentication remembers keys.
- **Implementation:** Include Veyon GET/HEAD routes, administrator config/keyring
  projections and the maintenance inventory mirror in the shared predicate.
  New reads pause with 423; accepted handlers drain before the snapshot. Match
  Express case/trailing-slash aliases. Keep the actual maintenance config mirror
  readable: it has no keyring projection and retains its token guard.
- **Complexity/risk/confidence:** Small / Medium / Confirmed. Veyon views pause
  for the snapshot interval; do not silently skip stable-ID persistence or
  return identifiers that the next request cannot resolve.
- **Review:** Read identity/keyring/update bridges, identity reconciliation,
  keyring storage and maintenance mirror composition. Review the Hub's Veyon
  inventory/info/preview/features/authentication routes and transport writes.
- **Verification:** Canonical process and temporary SQLite, empty inventory
  reproduction, GET/HEAD aliases, metadata routes, maintenance auth and read
  access; hold only a synthetic computer's TCP probe and verify final identity
  persistence before freeze acknowledgment and stable mapping after thaw.
- **Limits:** No real workstation, native service, key rotation, preview or
  classroom command is used. Hardware acceptance remains in its review unit.

### RG-ARCH-011: interrupted conversion staging survives restart

- **Subsystem/category/priority:** Core lifecycle / Recovery and resources / P2.
- **Baseline:** `acd537731f1e9eb08d8f7937003ccd1c287fbb6d`, alpha.85;
  `src/server.js:196,2221-2270` and
  `test/background-lifecycle.test.js:83-100`.
- **Problem/evidence:** The real ten-second shutdown deadline interrupts a held
  conversion, preserving its source and private render directory. Restart marks
  the presentation rebuildable but never reclaims that directory. The added
  restart assertion fails on this baseline; repeated interruptions can accumulate
  excluded, expendable render output. No production disk exhaustion is claimed.
- **Implementation:** Startup-only cleanup recognizes UUIDv4 render directories
  in the existing private staging root. Bound root scan, candidates, total nodes
  and depth; validate a whole tree before unlink/rmdir, reject links/special files,
  other owners/filesystems and changed identities. Preserve unknown uploads and
  all original/published presentation assets. Warn on leftovers without blocking
  startup. No timer, retention setting or schema migration is added.
- **Complexity/risk/confidence:** Small / Medium / Confirmed. Cleanup is destructive
  only for recognized expendable staging and must precede all new conversions.
- **Review/verification:** Review upload naming, render staging/publication,
  interruption recovery and backup exclusions. Extend the canonical deadline test
  to require startup reclamation, source preservation and rebuild. Filesystem
  tests cover unknown entries, links, hard links, whole-tree validation and budgets.
- **Limits:** Bounded cleanup may leave oversized/unsafe staging for inspection.
  It does not remove unknown partial uploads, change rendered slides or prove
  physical receiver behavior. Runtime conversion still uses its existing finally
  cleanup; no cleanup loop races active rendering.

The first bootstrap/media/readiness patch is implemented. The broader Core
Architecture and Application Lifecycle unit remains open for exhaustive writer
ownership/feature acceptance. Registered-handler drain and explicit bridge
composition are addressed within their documented coverage. No UI redesign,
exhaustive server audit or physical-device acceptance is claimed by these tests.
