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
  Express registration wrappers are deliberately retained. Replacing them needs
  separate route-composition/authentication fixtures within this review unit.

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
all repository gates remain required; the broader bridge-composition review is
still open.

## Completion boundary

The first bootstrap/media/readiness patch is implemented. The broader Core
Architecture and Application Lifecycle unit remains open for exhaustive writer
ownership/feature acceptance and explicit bridge-composition coverage. The
registered-handler and tracked-owner shutdown defect in RG-ARCH-004 is addressed. No UI redesign, production/device tests,
deployment or release completion is claimed.
