# Core architecture and lifecycle: first implementation

Audited baseline: `c2808c8ba861b852e6bbe8dec8c52d8251227756`.
All locations below refer to that revision, not the modified line numbers.

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

## RG-ARCH-004: complete writer drain remains unproven

- **Subsystem/category/priority:** Core lifecycle / Reliability / P2.
- **Location:** `src/server.js:4882-4900,5932-5958,8460-8473,8559-8570`.
- **Current implementation:** Full Recovery tracks asynchronous mutations and busy
  domains. Shutdown waits for HTTP close and the Veyon queue, then closes SQLite.
- **Evidence:** The shutdown predicate does not include the export writer counters,
  running automation map or presentation builds. No reproduced production failure
  is claimed; many tasks complete before the normal stop finishes.
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
- **Confidence/status:** Strong Evidence / Deferred to the next focused lifecycle
  change. Requires full writer-owner coverage, not a broader rewrite in this PR.

## Completion boundary

The first bootstrap/media/readiness patch is implemented. The broader Core
Architecture and Application Lifecycle unit remains open for RG-ARCH-004 and
explicit bridge-composition coverage. No UI redesign, production/device tests,
deployment or release completion is claimed.
