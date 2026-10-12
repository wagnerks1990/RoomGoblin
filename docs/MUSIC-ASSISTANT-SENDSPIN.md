# Music Assistant Sendspin TV Audio

## Supported transport

Music Assistant control and TV audio use separate connections:

```text
Controller -> Hub -> authenticated Music Assistant API (:8095/ws; HTTP API fallback)
TV browser -> same-Hub /music-assistant/sendspin-proxy?ticket=... -> Hub backend
                                                               -> MA :8927/sendspin
```

The backend uses the configured dedicated Sendspin host/port. It does **not** append `/sendspin` to the Music Assistant web/API URL, send an API-authentication preamble to the dedicated socket, or discard the first upstream message as an authentication response. Text and binary Sendspin frames are relayed unchanged in both directions.

The Music Assistant long-lived token remains encrypted in SQLite as `musicassistant.token` for control/API operations. Existing setup/attachment still requires that token. Audio authorization at the Hub remains a one-use, 60-second display ticket plus a current attachment and enabled-bridge check. The browser URL validation from PR #27 remains unchanged: browsers connect only to the same Hub, never directly to an arbitrary audio host.

Upstream reference, checked 2026-09-09: [Music Assistant Sendspin player documentation](https://www.music-assistant.io/player-support/sendspin/), section **Connecting Other Sendspin Players**, documents `:8927/sendspin` for external clients and distinguishes it from the built-in web-player route on port 8095.

## Browser SDK compatibility pin

The browser receiver intentionally remains on `@sendspin/sendspin-js` 3.2.1
for the reviewed Music Assistant 2.9 compatibility contract. Sendspin 4 and 5
replace the caller-supplied player identity with a persisted cryptographic
identity and add a new Noise/pairing handshake. Updating the package alone
would make RoomGoblin report its historical `classroom-hub-*` player ID while
the SDK advertises a different client ID, and the existing browser/relay tests
do not exercise a real Music Assistant pairing flow.

Dependabot therefore ignores only semver-major updates for this package. Minor
and patch updates within the supported major remain eligible. A future major
upgrade must be a dedicated migration with Music Assistant version support,
stable per-display identity and re-pairing behavior, status-registration
mapping, Chromium/Firefox coverage, physical-TV audio checks, and documented
rollback. `hls.js` remains independently updatable.

Version 3.2.1 stays on the same identity/pairing protocol and adds upstream
audio-unlock, initial-state sequencing, changed-state and correction-limit
fixes. A regression bundles the installed SDK and checks its public `unlock()`
API; call-site and relay tests cover the surrounding RoomGoblin contracts.
Physical-TV audibility still requires the post-upgrade check below. Runtime SDK
version diagnostics must match the locked dependency.

## Configuration and host networking

Existing `musicassistant.config` fields are retained; this change does not migrate the database or reset saved audio/attachment preferences.

| Field | Meaning |
| --- | --- |
| `url` | Music Assistant web/API base URL, normally port 8095. API TLS does not imply TLS on the dedicated audio port. |
| `sendspinHost` | Backend-reachable hostname, IPv4 or IPv6 address, without scheme/path/credentials. When absent, use the API URL hostname. |
| `sendspinPort` | Dedicated Sendspin listener; default 8927. Invalid/non-integer/out-of-range values fail validation rather than silently clamping. |
| `tvBridgeEnabled` | Whether the Hub TV audio bridge may establish a new connection. |

In host mode, the existing network helper translates exact legacy aliases `host.docker.internal`, `music-assistant`, and `music-assistant-server` to `127.0.0.1`. Explicit remote IP/DNS settings remain remote; IPv6 addresses receive URL brackets. An explicit hostname must be reachable by the Hub backend, not by the browser. The dedicated endpoint is plain `ws://` and must remain on a trusted network; no public exposure, TLS bypass, reverse-proxy or SDK change is introduced here. A Music Assistant listener bound only to a LAN IP needs that IP configured rather than loopback.

`GET /api/v1/music-assistant/status` (authenticated controller access) reports the actual `sendspinWebSocket` and `upstreamTransport: "dedicated-sendspin"`. The existing `transport: "authenticated-ma-sendspin-proxy"` identifier is retained for compatibility; authentication here refers to the Hub ticket, not an upstream API-token exchange.

## Connection lifecycle and resource bounds

The dedicated relay has a 10-second connect timeout. Closing either side cancels the timer, clears queued frames, and closes the peer, including termination of an upstream that has not finished connecting. Failed sends are contained; reserved close codes are normalized. Pending queues are bounded at 100 frames and 1 MiB, active output buffering at 8 MiB, and WebSocket payload limits remain enforced. Limits fail visibly instead of silently dropping protocol frames. Audio sessions are included in per-IP connection accounting.

No old `authTimer` reference remains in this relay. The saved local `server.js` patch from the user changed the open/authentication block but left such a reference in the close handler; it must not be restored over current source.

## Selective review of PR #22

Reviewed PR #22 head `7e567d202eea70c8834cc35c2320ef2349769ae8` against main `a4fd63cbac838045fb21167ad3faf7ba1472a35f`, which already includes PR #27 (single renderer/security) and PR #28 (host networking). The PR description records successful earlier TV1 audio testing, but the PR's 14 changed files do **not** directly update `src/server.js`. The accepted server patch was present as a script and as the user's separately saved local diff.

| Original files / changes | Disposition |
| --- | --- |
| `scripts/patch-sendspin-dedicated-port.py` | Port its intended backend transport change into `src/server.js` and tested `src/music-assistant-sendspin.js`; do not ship/run the patch script. Correct timeout/early-close cleanup and validate the configured endpoint. |
| `docs/MUSIC-ASSISTANT-SENDSPIN.md` | Carry forward the separate control/audio architecture; replace old host-gateway instructions with current host-mode guidance and identify historical versus new validation. |
| `docs/AI-CONTEXT.md` | Add only the current transport contract. Reject the unrelated master-key migration-path edit and obsolete text-sizing paragraph. |
| `public/display/index.html`, `test/display-text-sizing.test.js`, `wiki/Automation-Display-Media.md` | Do not migrate older fitting changes or source-string tests. PR #27 owns the renderer and browser geometry tests. The current receiver and its security module remain byte-for-byte unchanged. |
| `.github/scripts/apply_display_fit_coalescing.py`, `.github/workflows/apply-display-fit-coalescing.yml`, `scripts/disable-display-autofit.py` | Exclude superseded renderer patching and auto-fit disabling. |
| `scripts/apply-sendspin-lifecycle-fix.py` | Exclude the combined old renderer/browser rewrite. Required backend cleanup is implemented independently; browser reconnect policy is not replaced. |
| `scripts/enable-direct-music-assistant-sendspin.py`, `scripts/use-ma-kiosk-sendspin-lifecycle.py`, `scripts/stabilize-ma-kiosk-sendspin.py` | Exclude browser-direct transport and competing lifecycle/SDK experiments. Preserve current ticketed same-Hub architecture. |
| `scripts/enable-sendspin-browser-audio-unlock.py` | Exclude unrequested browser/autoplay changes; not part of the accepted dedicated-port fix. |

Retire PR #22 as superseded after the selective replacement passes validation and is merged; do not merge its legacy branch wholesale. Closing the PR and deleting its branch preserves the review history. Review-only source-export/patch-transfer workflows are not part of the application change.

## Verification and deployment

Automated coverage: `test/music-assistant-sendspin.test.js` executes endpoint validation, the actual server ticket/attachment handler and deterministic connection races. `test/music-assistant-sendspin-ws.test.js` uses real local WebSockets and separate fake API/audio listeners to test the untouched first server frame, text/binary round trips, no API-auth preamble, correct port selection and close/reconnect cleanup. These are protocol fixtures, **not** tests of live speakers or Music Assistant playback. Existing Chromium/Firefox display suites must continue passing.

The earlier TV1/Windows kiosk playback success is historical evidence recorded in PR #22, not a claim that this replacement was deployed to physical TVs. After merge:

1. Keep local stashes/backups until playback is verified. Do not `stash pop` the obsolete server block and do not run PR #22 patch scripts.
2. Take a SQLite-safe operational backup. Pull current main and follow `docs/HOST-NETWORKING.md`, including port-conflict/effective-Compose preflight and `bash install.sh` to refresh the native Host Agent and both core containers when migrating from bridge mode.
3. Reload receivers, check MA API readiness and the configured dedicated listener with `ss -lntp | grep ':8927'` (substitute the saved port). A healthy Hub alone does not prove audio availability.
4. Attach one TV, verify its `classroom-hub-tvN` player is enabled/registered, start Background Music, and check for stable audible playback. Then check announcements pause/resume and remaining targets. Preserve automation settings and confirm the four-component display layout remains unchanged.

The diagnostic event `musicassistant.sendspin.proxy.connected` indicates an upstream socket opened; it does not by itself prove decoded or audible playback. Missing/disabled players, browser autoplay restrictions, network listener bindings, and API-token failures remain separate diagnostic causes. Application VERSION stays aligned with the repository `VERSION` file and changes only in a reviewed release.

## Music Assistant route budgets

The touched status endpoint allows 120 requests per 60 seconds appliance-wide. Configuration saves and TV bridge attach/detach share a separate 30-request/60-second budget. The limiters run before the existing authorization handlers, return HTTP 429 with Retry-After, use fixed keys unaffected by forwarding headers, and reset on process restart. Status polling cannot consume the mutation budget. These limits do not throttle raw audio frames or internal scheduled music operations. The locked express-rate-limit version matches the already reviewed maintenance dependency. Actual HTTP regression tests exercise both limits and their independence.

## Browser reconnect diagnostics

Every active browser host must have its own stable receiver ID. Two live hosts
using the same `/display/<id>` also advertise the same `classroom-hub-<id>`
Sendspin identity and can replace each other's Music Assistant connection. A live
operator test isolated a reconnect loop to reuse of an occupied receiver ID;
using an unused ID stopped that loop. This does not establish that every future
close has the same cause.

The browser uses an adopted, ticketed WebSocket. Sendspin 3.2.1 does not reconnect
that socket itself; RoomGoblin retains its existing reconnect request after an
active session closes. The diagnostics update does not change retry timing,
player creation, codecs, buffers, autoplay policy, or duplicate-session handling.

The receiver now logs `RoomGoblin Music Assistant proxy closed` with code, the
Hub-supplied reason, clean-handshake flag, player ID, generation, prior protocol
activation and whether the callback is stale. Stale callbacks log evidence but
still cannot change current playback state or schedule a reconnect. Active close
errors remain visible and `lastProxyClose` persists in bridge status across the
next reconnect, while the current error can clear after recovery. A clean close
(code 1000) does not prove the shutdown was desirable or identify its initiator.

The Hub records one `musicassistant.sendspin.proxy.closed` audit event for the
first terminal event of each admitted relay. `relayId` correlates it with the
existing `.connected` event. `closedBy` distinguishes `browser`, `upstream`,
`browser-error`, `upstream-error`, `browser-send-error`, `upstream-send-error`,
`connect-timeout`, `pending-buffer-limit`, `buffer-limit`, `browser-not-open`,
and explicit `hub` teardown. These describe the boundary observed by the Hub,
not necessarily the underlying network or application root cause.

`observedCode` retains the original peer code for close events (including 1006);
it is null for errors without a close frame and uses the selected local code for
Hub timeouts/limits. `forwardedCode` is the legal code selected for the browser,
so an upstream 1006 is still forwarded as 1011. `reason` is a fixed Hub diagnostic
label; `durationMs` and `upstreamConnected` provide lifecycle context. Admission
failures generate `.rejected` with the policy code and fixed reason. A consumed
ticket is checked only at admission: its 60-second expiry does not time out an
established audio stream.

Proxy URLs contain one-use credentials. Never log those URLs, request query
strings, API tokens, protocol payloads or arbitrary peer-supplied close text.
Browser reason text is supplied by the Hub; backend events deliberately retain
fixed reasons rather than raw upstream messages. Diagnostics callback failures
must not interrupt teardown. Events use the existing bounded audit/diagnostics
storage and its existing authorization rules.

After installing the exact published image pair, reload the test receiver once,
keep only one host on its receiver ID, and reproduce the failure. Capture the
browser close record and run this in a signed-in controller's Console:

```javascript
(async () => {
  const result = {};
  for (const kind of ['closed', 'rejected']) {
    const r = await fetch(`/api/v1/diagnostics/events?kind=musicassistant.sendspin.proxy.${kind}&limit=40`);
    if (!r.ok) throw new Error(`Diagnostics request failed: ${r.status}`);
    result[kind] = (await r.json()).events;
  }
  console.log(JSON.stringify(result, null, 2));
})();
```

An autoplay warning followed by `AudioContext resumed`, `audio unlocked` and
`ctx=running` records recovery from the initial browser restriction; it is not
proof of an ongoing transport failure or of audible sound. A navigation creates
a fresh playback context and may require another real tap/key interaction on the
display page. A controller click does not activate a separate receiver browser.
Managed Android retains its existing WebView autoplay exemption and resume
preservation. Do not fabricate activation or reconnect on every gesture.

Regression coverage executes the actual receiver close/reconnect handlers,
checks stale-generation isolation and ticket-free logs, and tests relay source
classification, once-only teardown, observer failures, and real upstream 1006
termination. Physical audio remains operator-verified. Rollback uses the normal
updater's saved source/images and operational backup; this update has no database
migration, receiver identity change, or new playback policy.

## Apple Music sync and playback recovery

For an existing externally managed Music Assistant Compose deployment, stable
**2.10.4** includes the upstream Apple Music fixes reviewed on 2026-09-23:

- [Missing artists on library-playlist tracks](https://github.com/music-assistant/server/pull/5558): use the artist-name fallback when Apple returns an empty artist relationship, and invalidate the old parsed-item cache.
- [Bounded throttle recovery](https://github.com/music-assistant/server/pull/5333): shorten the first retry delay instead of stalling playback for 15 seconds on a transient throttle.
- [Batched library synchronization](https://github.com/music-assistant/server/pull/5391): reduce API requests while preserving imported library contents.

The [upstream report](https://github.com/music-assistant/support/issues/5955)
contains matching rate-limit/playback symptoms. These fixes improve recovery;
they do not remove Apple's external rate limits. Do not repeatedly force full
sync, disable IPv6, delete the library, or replace credentials merely because a
429 appears. Re-authenticate only if the provider reports an authentication error.

Upgrade an externally owned container through its original Compose project.
Pull the exact `ghcr.io/music-assistant/server:2.10.4` image first. Stop only that
service, take a private backup of its entire persistent `/data` directory and
Compose configuration, and retain the previous image ID. Pin the Compose image,
then recreate that service while preserving its data bind, host networking,
LAN-selection shim, `PYTHONPATH`, and bounded `wait-for-lan.sh` entrypoint. Check
API authentication, provider readiness, registered players, and Sendspin before
declaring success. The 2.10 release removes the local-audio provider: establish
whether it is in use before upgrading. A downgrade requires the saved pre-upgrade
data as well as the previous image, since upstream database schemas can migrate.

This procedure is for externally owned Compose deployments. It does not adopt
or recreate them through RoomGoblin's managed-service/recovery catalog; existing
managed-service image and recovery identities remain governed by their separate
allowlist. The core RoomGoblin updater never silently upgrades an adopted add-on.

RoomGoblin's Music Assistant HTTP compatibility path accepts successful raw JSON
results, including `null`, arrays, and scalar values, as well as wrapped `result`
responses. Non-JSON errors include the HTTP status without copying arbitrary
upstream response bodies into diagnostics. Media-load/play commands have a
bounded 60-second response budget; pause, stop, volume, and status keep their
15-second budget. If a submitted WebSocket command times out or disconnects,
RoomGoblin does not blindly repeat the mutation over HTTP. Read-only player
polling may fall back, and commands that were not sent may use HTTP normally.

Regression tests exercise real fixture HTTP responses and controlled WebSocket
completion/timeout/disconnect cases. They do not claim physical audio acceptance.
