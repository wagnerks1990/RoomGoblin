# Changelog
- Recover transient TV Chromium text-fit failures during action-to-action display transitions by retrying a visible below-readable layout from canonical geometry; repeated same-content state requests now reconcile hidden/collapsed regions. Renderer/cache revision is `dynamic-fit-20260922-12`.
- Anchor title/subtitle at the top, reserve the remaining center for body text, and give the timer a 160px safe region that preserves top/center/bottom placement without clipping.
- Bound automatic font growth to 110% of configured size while retaining hard shrink-to-fit containment; renderer/cache revision is now `dynamic-fit-20260922-11`.

## Unreleased

### Main-based System Updates

- Change the administrator updater from semantic release-channel polling to the latest merged commit on trusted `main`, while retaining the native exact-SHA image, backup, health and rollback transaction.
- Show installed/available commit identity in the GUI and history so multiple commits sharing one prerelease VERSION remain distinguishable.
- Use the same verified main-commit path for automatic maintenance-window updates and reject dirty/divergent source, stale selections and arbitrary SHAs.
- Correct updater systemd ordering to the canonical `classroom-hub-host-agent.service`, retire the stale old-name unit during install/refresh, and normalize no-request manual oneshot failures without hiding real deployment failures.


### Automation continual-loop termination

- Stop an automation sequence from creating new passes once only one action remains eligible and it is `Loop continually`.
- Preserve intentional multi-action continual cycling and explicit finite `Loop X times` repeats.
- Leave the surviving action's current display/device state in place instead of reissuing it, preventing needless display clears/reloads and visible flashing.


### Large operational backup streaming

- Restore the intended operational-backup policy that excludes replaceable media payloads, while retaining disk-streaming Info-ZIP/ZIP64 creation for large non-media operational state.
- Preserve the SQLite snapshot, shared-data filters, symlink/special-file rejection, private backup permissions, and restore manifest contract.
- Extend update backup/inspection timeouts and print the maintenance error that caused preflight failure instead of returning only a generic failure state.

### Continuous recovery winner filtering

- Fix `Resume Scheduled State` and startup recovery so an earlier continuous automation is not restarted merely because its scheduled time has passed.
- Continuous recovery now restarts only occurrences that are current resource winners at the recovery time, preventing a previously tested or superseded automation from resurfacing after the correct scheduled state is restored.


### Restored dynamic display validation

- Reintroduce the pre-revert dynamic display renderer and WYSIWYG editor for controlled physical validation now that production deployment is verified.
- Restore media-only timer overlay handling from renderer/cache revision `dynamic-fit-20260922-9`, including compact top/center/bottom timer placement and configured timer-size ceilings.
- Restore browser-independent hard font ceilings and deterministic dynamic region allocation from the TV8 clipping fixes.
- Restore exact-receiver WYSIWYG previews in Display Studio and scheduled automation Display Text editing.

- Fix a live Chromium/TV false-containment regression where full-width flex child geometry caused title, subtitle, and body text to collapse to 1px despite their painted glyphs fitting the allocated dynamic regions.
- Keep scroll/offset, independent natural-size, and painted glyph rectangle containment checks; stop treating the full-width child border box as painted content.
- Add the exact TV8 1548×1273 classroom scene as a browser regression and bump renderer/cache revision to `dynamic-fit-20260922-10`.

### Resume scheduled state cancels manual tests

- Fix `Resume Scheduled State` so any active manual continuous `Run Now` / draft test is cancelled and fully drained before current scheduled winners are reasserted.
- Prevent a previously tested, currently unscheduled automation from waking after its dwell timer and repainting the display after schedule resume.

### Resumable upload backup readability

- Create resumable-upload roots and per-upload session directories as `0750` and chunk files as `0640`, matching RoomGoblin's shared-data contract.
- Prevent operational safety backups from failing with `EACCES` while an upload session exists, without granting world access or weakening secret/ADB/signing permissions.

### Linked-class automation targets

- Make each linked class's default displays authoritative for every display action when class-target inheritance is enabled, and show those effective targets read-only without discarding saved manual selections.

### Automation action dwell timing

- Correct automation sequencing so each action's configured timer means how long that action remains active before RoomGoblin advances to the next action.
- Preserve `delaySeconds` as a pre-action wait and use `repeatDelaySeconds` as the post-action dwell timer on every sequence pass.
- Expose Action 1 timing in the editor, allow continual sequence participation for all action types, and label action timers by their actual stay/advance behavior.
- Add explicit Timer Overlay coverage: default to all display actions, with an Action 1 only compatibility option; reassert overlays after later text/URL/media/clear actions without restarting manual-duration countdowns.
- Preserve class-end cancellation, Morning Announcements priority, recovery, and action-level error handling.

### Morning Announcements live volume

- Apply Live Watch announcement-volume slider changes immediately to the displays owned by an active announcement while persisting the value for future sessions.
- Keep live volume changes in-place with `display.web.audio`; do not clear, reload, or recreate the announcement player.
- Make both schedule-resume controls explicitly restore an active Morning Announcements takeover after an operator clears or reloads displays, while preserving observe-only periodic live probes.

### Resumable media uploads

- Added owner-isolated, resumable media uploads with 45 MiB chunks, a 5 GiB
  default file limit, retry-safe chunk submission, pause/resume/cancel controls,
  chunk and final SHA-256 verification, server-side content inspection, and
  automatic cleanup of abandoned sessions (fixes #182).

### HTTPS/public-origin endpoint migration

- Add a repository-wide endpoint inventory covering RoomGoblin browser/API/WebSocket traffic, Windows agents, displays/media plane, Music Assistant, Veyon, MQTT, ESPHome, Android management, maintenance/Host Agent and auxiliary web UIs.
- Prefer the recorded managed Cloudflare HTTPS origin for new and existing RoomGoblin Windows agents while retaining an explicit LAN origin fallback; HTTPS automatically upgrades the long-lived control channel to WSS and native self-update follows primary-to-fallback origin selection.
- Keep Veyon WebAPI/native endpoint traffic private: browser Veyon controls continue through the RoomGoblin HTTPS Controller while the Hub talks to loopback Veyon WebAPI and LAN-native Veyon services.
- Add an allowlisted protected Music Assistant HTTPS resource on the managed Cloudflare tunnel using a separate hostname routed to local port 8095, mandatory Cloudflare Access policy, ownership-aware DNS/Access cleanup, and a separate persisted browser URL while backend/API and Sendspin/streaming paths remain local/LAN.
- Stop browser helpers from translating loopback Music Assistant into an unreachable public-host local-port URL; HTTPS sessions require the explicit protected browser URL, while LAN HTTP remains a deliberate fallback.
- Preserve physical-display HTTP/media-plane behavior until a reviewed HTTPS design retains the dedicated port-3020 large-media path; no privileged local control port is auto-published merely for URL uniformity.

### Veyon package-version normalization

- Normalize Debian/Ubuntu Veyon package versions such as `4.11.3.0-ubuntu.26.04` to the upstream release version `4.11.3` for lifecycle display and comparisons.
- Add regression coverage for Ubuntu package suffixes, distro revisions, and Debian epochs so the lifecycle UI no longer reports `11.3.0` after installing Veyon 4.11.3.


### Veyon lifecycle official-package fallback

- Fix the Veyon lifecycle install bridge to call the actual guarded host-update endpoint.
- When the Veyon PPA lags an upstream release, allow only the exact official Ubuntu amd64 Veyon DEB advertised by `veyon/veyon` release metadata, with SHA-256, URL, package-name, architecture, distribution-version and installed-version verification at the Host Agent boundary.
- Preserve recovery backups, native `veyon.service` / `veyon-webapi.service` recovery, APT preference, anti-downgrade enforcement, and rejection of arbitrary package URLs.
- Add regression coverage and synchronized operator/Wiki/AI lifecycle documentation.

- Fix retention convergence so full installs immediately enforce the 3 automatic operational / 1 pre-* / 3 migration policy, and make Host Agent migration/legacy cleanup honor `HOST_BACKUP_DIR` instead of the obsolete hardcoded backup path.

### Automatic backup retention hardening

- Classify update-created operational backups separately from manual operational exports.
- Automatically retain 3 operational update backups, 1 `pre-*` safety backup, and 3 `migration-*` installer snapshots after successful maintenance.
- Treat historical `classroom-hub-operational-*` archives as the legacy automatic pool so existing accumulation is pruned, while protecting manual operational exports and encrypted Full Recovery `.rgbak` bundles.


### Veyon OEM-only reset

- Removed RoomGoblin custom/community Veyon extension source, experimental web controls, local analysis/command bridges, pilot packaging/deployment tooling, and their CI/test/documentation surfaces.
- Removed corresponding runtime routes and configuration so the Veyon workspace dispatches only the reviewed upstream WebAPI command allowlist.
- Retained host-managed upstream/OEM Veyon configuration, keys, inventory, package lifecycle, monitoring/live view, classroom commands, and upstream/OEM add-on compatibility.
- Added explicit operator/contributor policy and regression guards against reintroducing custom Veyon extension trees or experimental controller bundles.
- Added bounded appliance-wide rate limits to retained Veyon command status and mutation APIs after CodeQL review.


### Managed Cloudflare remote HTTPS

- Expand the existing host-side Cloudflare Tunnel pilot into first-class Setup and Controller provisioning for an optional remotely managed tunnel, proxied DNS hostname, HTTPS rewrites/enforcement, HTTP/3, Brotli, and optional Cloudflare Access.
- Store API Tokens / legacy Global API Keys only in encrypted application secret storage; keep the tunnel connector token server-side and preserve the root-only `/etc/cloudflared/roomgoblin.token` runtime boundary.
- Add fail-closed ownership rules: conflicting DNS replacement and adoption of a same-name unrecorded tunnel require separate explicit administrator choices.
- Route connector installation through the loopback maintenance API and authenticated Host Agent, invoking only the reviewed Cloudflare installer; keep the Hub restart a separate explicit action.
- Preserve local classroom availability when Cloudflare, DNS, or Internet access fails; Cloudflare remains outside core health, scheduler, announcement, Background Music, managed-device, update, and rollback readiness.
- Add mocked Cloudflare API regression coverage plus synchronized operator, Wiki, configuration, and AI/contributor documentation.
- Fix Host Agent sandbox provisioning so the GUI can write only `/etc/cloudflared` and the dedicated `/etc/systemd/system/cloudflared-roomgoblin.service` file while retaining `ProtectSystem=full`.
- Checkpoint Cloudflare tunnel/DNS ownership before local connector installation so a host-side failure can be retried without leaving a newly created tunnel unrecorded.
- Move `cloudflared` package installation out of the systemd-sandboxed Host Agent and into the normal root install/update path; Host Agent provisioning now requires the already-installed binary with `--skip-install`.
- Recover a stale `cloudflared-roomgoblin.service -> /dev/null` mask left by failed provisioning without touching generic Cloudflare services, and preserve an existing valid RoomGoblin Cloudflare unit instead of overwriting it during updates.
- Explicitly restart `cloudflared-roomgoblin.service` after connector token reprovisioning so an already-running process cannot continue using a stale/deleted tunnel token and trigger Cloudflare Error 1033.
- Fix Host Agent tunnel-token serialization so it writes a real trailing newline instead of the literal characters `\\n`, preventing `Provided Tunnel token is not valid` restart loops.
- Persist Cloudflare GUI state across reload/reboot with explicit Configured/Credential stored indicators, accurate tunnel health styling, and a reconstructed Open HTTPS URL link.
- Retry transient network failures for idempotent Cloudflare reconciliation calls and include the failing HTTP method/path in 502 errors; non-idempotent create calls remain single-attempt/fail-closed to avoid duplicate resources.

### Scheduled automation sequence rebuild

- Rebuild scheduled automation execution around canonical schema-v3 `actionSequence[]` passes instead of the legacy special primary action plus additional actions runtime.
- Define per-action participation as Run once, Loop X times, or Loop continually; after the last action the runner returns to Action 1 while any action remains eligible.
- Make continuous sequences cancellable, class-end-aware, safe against zero-delay command storms, superseded by newer overlapping scheduled occurrences, and recoverable after restart/operator Resume when still applicable.
- Initialize Timer Overlay after the first pass so continuous sequences cannot starve overlays; keep Morning Announcements and Background Music reconciliation invariants.
- Replace the long Scheduled Events card stack with one time-ordered automation selector; the editor follows that selection instead of rendering a redundant second selector.
- Collapse class schedule links into a compact multi-select dropdown with persistent checkboxes, a selected-count summary, and explicit Save/Clear/Cancel behavior.
- Simplify the automation editor footer to Save & Enable plus Cancel / New; validation now runs automatically before the save-and-enable operation.
- Make uploaded-media settings content-aware so images, videos, and paged documents expose only applicable controls.
- Retire the browser automation hotfix and fold its required schedule-ordering behavior into the canonical controller.


### Securly physical-console kiosk

- Add an optional Ubuntu Server physical-console Securly Pass kiosk using tty1 autologin, Xorg, Openbox and Chromium Snap while preserving SSH and separate sudo-capable recovery access.
- Capture the live-validated Chromium Snap requirements: systemd user D-Bus, no inherited tty1 standard file descriptors, Snap-owned profile storage and software browser rendering; retain the host NVIDIA Xorg driver independently.
- Add `deploy/configure-securly-kiosk.sh`, operational helpers, operator/Wiki/AI documentation, cold-boot acceptance criteria and public-safe secret handling with no production kiosk code in Git.

### Music Assistant LAN startup gate

- Add a managed `/data/.roomgoblin-compat/wait-for-lan.sh` entrypoint gate that waits up to 60 seconds for the already-filtered physical LAN adapter set to expose a usable IPv4 before starting Music Assistant.
- Preserve the upstream image startup contract by execing `/usr/local/bin/entrypoint.sh --data-dir /data --cache-dir /data/.cache` after the gate succeeds.
- Extend Host Agent validation to allow only the reviewed `/bin/sh` entrypoint override plus the exact managed wait script for Music Assistant.
- Cover the generated script, shell syntax, Docker arguments, and rejection of unreviewed entrypoints/post-image commands in regression tests.
- Document the live reboot evidence that eliminated both Zeroconf `Errno 19` and Streams `IndexError: tuple index out of range`.

### Docker network least-privilege restoration

- Restore service-specific Docker networking instead of applying host mode to every managed add-on.
- Move RoomGoblin-managed Mosquitto to the named `roomgoblin-integrations` user-defined bridge and publish its configured MQTT port only on `127.0.0.1`.
- Keep Govee2MQTT and Music Assistant on host networking because their reviewed upstream LAN multicast/discovery requirements depend on it.
- Make the Host Agent enforce the exact network topology and allow lifecycle operations only for the reviewed named integration bridge.
- Replace the Music Assistant DOWN-interface workaround with deterministic default-route LAN adapter selection so an UP Docker bridge cannot become the published/discovery interface after reboot.
- Update controller messaging, operator/Wiki/AI/contributor documentation, and focused network-policy regressions.

### Music Assistant host-network recovery

- Live-validate the permanent Zeroconf guard on the production appliance after reboot with Tailscale IPv6 restored and inactive addressed Docker bridges still present; preserve the legacy `/opt/music-assistant/data` bind and confirm HTTP 200 on 8095 plus listeners on 8097/8927.
- Defer scheduled Background Music until the configured Music Assistant player is registered and available, and apply a 30-second backoff after transient scheduled start failures so provider/player startup does not generate repeated `PlayerUnavailableError`/`MediaNotFoundError` calls.

- Fix Music Assistant startup on hosts that combine Tailscale/global IPv6 with addressed but link-down Docker bridges by filtering only interfaces whose Linux `operstate` is explicitly `down` before Music Assistant Zeroconf enumeration.
- Keep host networking, LAN multicast discovery, Tailscale IPv6 and persistent Music Assistant data intact; fail open for unreadable/unknown interfaces.
- Allow an explicit RoomGoblin-owned Music Assistant recreate to repair an offline/dead API instead of requiring successful authentication before container replacement; refuse destructive recreate of foreign/adopted containers until their persistent data is migrated into managed storage; add regression coverage and synchronized host-network/AI documentation.

### Repository-wide correctness and security audit

- Review all 538 tracked project files (about 64,600 lines of source, tests,
  configuration, and documentation) across the Hub, browser clients, recovery
  services, Veyon/ESPHome integrations, managed-device agents, and CI supply
  chain.
- Fail closed on malformed commands, URLs, environment limits, private-network
  Veyon targets, recovery archives, device-agent requests, enrollment material,
  and update inputs before persistence or side effects.
- Repair crash recovery, database-handle replacement, session-write churn,
  receiver-state races, Music Assistant connection cleanup, and managed-device
  listener/transport concurrency.
- Strengthen Android, Windows, PowerShell, Docker, Gradle, NuGet, and image
  publication boundaries; add regression coverage and synchronized operator
  documentation. See `docs/CODE-AUDIT-2026-09-18.md` for the audit record.
- Follow up the live controller click-through by allowing only the eight built-in
  `/test-images/tvN.svg` assets through media-command URL validation, fixing the
  Controller **Test Image** action without widening arbitrary same-origin paths.
- Reduce SQLite write amplification by coalescing display/lab-agent credential
  last-used timestamps, keep diagnostic bundles in temporary storage, and bound
  verified update safety backups to the newest ten automatic pre-* archives while
  preserving pinned revert and user-created recovery backups.

### Native Windows enrollment EDR hardening

- Prefer a browser-downloaded native ZIP plus one-time enrollment JSON instead of PowerShell download-and-execute for first-time Windows enrollment.
- Package the exact four native binaries with `manifest.json`; make the bootstrap verify all executable SHA-256 values before service installation.
- Add `--enrollment-file` support that deletes the plaintext enrollment file immediately after reading it, then preserves the existing DPAPI, HTTP-opt-in, ACL and health-gated rollback boundaries.
- Retain the verified automated PowerShell native installer and legacy scheduled-task installer only as explicit fallbacks.


### Automation action loops and live media sessions

- Alpha.84 media-plane production acceptance on 2026-09-18 verified healthy `:3000` control and `:3020` media listeners, working physical MP4 autoplay and persistent play/pause/seek/volume/rate/restart controls, and multi-megabyte video backpressure isolated from responsive controller/API/WebSocket traffic.
- Preserve signed/session media authorization while allowing the intentionally separate media port with `Cross-Origin-Resource-Policy: cross-origin`; controller previews and library cards must not decode full MP4 files.
- Add per-action run-once, bounded-repeat and receiver-native media-loop behavior so looping one video no longer restarts an entire scheduled automation.
- Keep MP4 playback as a persistent receiver session with live play/pause, stop/restart, seek/scrub, volume/mute and playback-rate controls that do not reload the file.
- Add configurable video start/end boundaries, clip looping and receiver playback telemetry; expose the same live controls in the Media workspace and document scheduler/announcement/BGM invariants.


### Veyon installed version and feature discovery

- Read installed package versions even when apt offers no update; flag mixed installs.
- Remove obsolete 4.9.7 GUI feature claims and retain newly advertised feature names.
- Keep package, proxy-advertisement and endpoint-verification evidence distinct.


### Browser Sendspin close diagnostics

- Retain browser close codes/reasons and stale-generation evidence without
  logging ticket-bearing URLs or changing playback/reconnect behavior.
- Record bounded, correlated relay closure/rejection events, preserving original
  abnormal close codes and distinguishing browser/upstream/local failures.
- Document unique receiver IDs per host, recovered autoplay warnings, and the
  difference between browser activation and transport stability.
- Remove the unused fake base URL from adopted-socket player configuration and
  document managed autoplay policy for unattended desktop kiosk browsers.

### Restore receiver mapping and group editing

- Restore the missing receiver form under Displays & AV, linked from Settings
  and TV drawers; preserve drafts, receiver fields and stable IDs when saving.
- Report shared and missing output assignments without guessing receiver IDs;
  keep hardware routing independent and refresh target names after edits.
- Offer explicit cleanup of empty repeated-prefix groups and wrap long group
  names; preserve other groups and existing schedule references.
- Cover mapping repairs, reload persistence, save failures and safe command
  targeting in focused browser regressions; document operator recovery and limits.

### Matrix receiver safety and readable groups

- Stop guessing receiver IDs for unmapped outputs; reject ambiguous/disabled
  receiver commands and group saves while preserving physical routing and labels.
- Wrap full saved group keys on separate drawer rows without changing membership,
  schedule references or archived topology; surface group-save failures.
- Document historical prefix accumulation and missing-receiver diagnosis; add
  mobile/desktop browser regressions. Physical mapping remains operator-verified.

### Restore TV Routing Matrix and remove room topology

- Remove topology editors, target overrides, page-wide ordering observer and
  backend preference projections; restore the original receiver Setup workflow.
- Preserve saved receiver/group/AV data and credentials; retain archived topology
  untouched, and reject stale topology saves with an explicit reload message.
- Allow names on matrix outputs without a receiver, report save/partial-save
  errors, and avoid repeatedly rebuilding unchanged routing controls and hidden
  configuration inventories during polling.
- Add backend/browser regression coverage and update operator, Wiki and AI docs.
  Live hardware acceptance remains separate from automated validation.

### Android build toolchain and dependencies

- Update the Android Agent dependency set and align CI plus the maintenance
  image on checksum-verified Gradle 9.6.0 required by Android Gradle Plugin 9.4.
- Migrate to AGP built-in Kotlin, removing the conflicting standalone plugin
  and legacy Kotlin options while retaining Java 17 bytecode compatibility.
- Align the compile SDK at API 37.2 and Build Tools at 36.0.0 for OkHttp 5.5;
  retain minimum API 26 and target API 35 for existing managed-device behavior.
- Keep the debug and embedded release APK builds on the same reviewed toolchain;
  package identity, version metadata, signing continuity and staged-artifact
  verification remain unchanged.

### Browser media dependencies

- Update `hls.js` to 1.7.3 and Sendspin JS to the compatible 3.2.1 patch while
  retaining the reviewed Sendspin 3.2 browser protocol for Music Assistant 2.9.
- Carry Sendspin's audio-unlock, initial-state sequencing, changed-state and
  inaudible correction-limit fixes without accepting the 4/5 protocol break.
- Verify the installed SDK supplies the gesture-unlock API and synchronize
  runtime SDK version diagnostics.
- Block automated Sendspin major upgrades until stable cryptographic display
  identity, pairing, registration mapping and physical-TV rollback are reviewed.

### Main-only development and updates

- Restore main as the sole integration/bootstrap/update source; stop advancing a
  separate production branch and remove source-write permission from image promotion.
- Keep checked PRs and permit merge/squash/rebase by policy without weakening gates;
  a restrictive GitHub ruleset still requires an administrator to change it.
- Safely bridge old installed runners after exact-image verification, using one
  full journaled reconciliation before returning to selective updates.
- Migrate legacy or detached checkouts to main without deleting old branches or
  overwriting divergent commits. Preserve backups, rollback and pending journals.
- Update operator, contributor, AI and Wiki documentation and add regressions for
  main selection, legacy migration, missing images and divergent branch safety.
- Remove conflicting source-first pull instructions from installation, migration,
  deployment and operations guides; regression-check the legacy migration handoff
  and distinguish live filesystem copies from database-safe recovery backups.

### Earlier matrix-first topology controls (superseded by removal above)

- Keep routine TV routing ahead of the collapsed topology configuration panel.
- Synchronize TV/output and AV-source/input labels from their normal controls;
  retain an explicit Save Changes action for direct RoomGoblin Display naming.
- Order topology cards by hardware output/input or natural stable receiver ID,
  independently of friendly names, without changing endpoint identity or routing.

### Selective production updates and consolidated CI

- Plan from verified running component revisions and deployment configuration;
  pull/recreate changed components only, with full reconciliation for migrations,
  deployment changes, missing history and explicit repair.
- Share the native update lock/journal, backup, health and rollback protocol with
  published-source CLI updates; recover interrupted transactions before new work.
- Fix rollback service-name propagation and preserve a private runner copy during
  installer replacement, previous environment and immutable component image IDs.
- Consolidate Android/permission coverage into Validate, reuse scanned images in
  the Compose smoke test, promote published images for semantic releases, bound
  job runtime and cancel superseded PR runs without cancelling publication gates.

### Published-image update preflight

- Require the validated Hub/maintenance pair before deployment. The temporary
  production-branch selection was superseded by the main-only workflow above;
  bootstrap and normal updates now select main while retaining image preflight.
- Verify both images before moving the checkout; refuse silent downgrades and
  report failed CI promptly without repeated Docker missing-tag errors.
- Keep lighting Apply controls stationary when polling clears command status;
  cover a refresh between pointer down and pointer up in both browser engines.

### Encrypted native ESPHome devices

- Add a Room controls workspace for verified device enrollment, live sensor state,
  switches, light power/brightness, bounded numbers, selects and confirmed admin
  button actions. No Home Assistant or MQTT dependency is required.
- Store keys encrypted and pin hardware MAC identity. Preserve subdevice entity
  IDs, require capability checks, bound reconnect/concurrency, and distinguish
  state-confirmed from sent-unconfirmed commands without offline or restart replay.
- Include the pinned official Python client in the unprivileged main image, with
  regression tests, recovery-aware writes and operator/AI/Wiki documentation.
- Firmware/OTA, automatic discovery and sensor-triggered automations are not part
  of this initial integration; physical-device acceptance remains necessary.

- Queue classroom commands with per-computer progress, bounded concurrency,
  request deduplication, lock read-back verification and ownership-based restart
  cleanup. New interactive commands take priority over preview work. Uncertain
  one-shot actions are not automatically replayed; broadcast-stop failures are
  reported instead of hidden.


### Veyon preview recovery and embedded scrolling

- Use the main page scrollbar for embedded Veyon/Windows consoles, retaining
  sessions and keeping dialogs within the visible parent viewport.
- Limit embedded previews to the actual visible parent viewport; place status
  below images and hide empty live frames until decoding succeeds.
- Fall back to PNG after JPEG encoder errors and expose sanitized authentication,
  capture and network failure details. Distinguish service reachability from
  authenticated computers and working previews.
- Omit the ignored COOP header on ordinary LAN HTTP while retaining it on HTTPS
  and loopback origins; preserve existing content/security policies.

### Compact lighting and fixed RoomGoblin identity

- Condense Govee lighting into searchable device/group controls with expandable
  configuration, preserving existing command routes and MQTT behavior.
- Remove custom product-name, logo and favicon settings from Settings and Setup.
  Use the supplied RoomGoblin name, descriptor, tagline, mascot and favicon on
  existing and fresh installations; ignore old overrides in API and browser
  responses and canonicalize normal saves without deleting uploaded files.
- Keep school/room labels, device names, timezones, display prefixes and custom
  theme settings configurable.

### Operator refinement and Veyon reliability

- Rebuild Veyon's device wall with compact/comfortable/list views, search and
  connection filters, retained selection/tool state, and all existing commands.
- Decode previews before display, retain labeled last-good frames on failure,
  bound visible polling, and release live-view requests/object URLs on close.
- Repair frame readiness/codec/session recovery, bound upstream body reads, and
  stop reporting authentication success after failed authenticated requests.
- Refine Today, desktop focus mode, mobile navigation, Windows lab inventory,
  setup sequence, display studio and managed-display filters/density.
- Repair two corrupt bundled logo assets using the supplied valid mascot and
  apply consistent permanent product marks while retaining custom site branding.
- Add transport, selection, branding and browser regressions; preserve physical
  display rendering, priority scheduling and compatibility identifiers.

### Image publication recovery

- Restore the stable browser-workflow name consumed by both image publishers.
  The GUI coverage expansion had renamed the workflow without updating the
  publication contract, preventing its image pair from becoming available.
- Test every required publisher workflow name against actual workflow definitions.

### Operator GUI

- Reorganize the controller into searchable room, content, planning and
  administration workspaces, with a keyboard-accessible mobile navigation drawer.
- Apply a shared operator design layer and responsive layouts to the controller,
  display content editor, lab consoles, setup and managed displays.
- Keep daily actions visible and group advanced options in native expandable
  sections; retain managed-device disclosure state during inventory refreshes.
- Add lab selection counts and keyboard handling for Veyon custom dialogs while
  preserving existing action bindings and confirmations.
- Document styling ownership, authorization boundaries and the unchanged physical
  display layout contract in `docs/GUI-WORKSPACES.md` and the Wiki mirror.


## 1.0.0-alpha.82 - 2026-09-13

### Deployment reliability

- Preserve pre-rebrand Android signing identities, normalize shared ADB access
  during installation/update/restore, and preserve SQLite maintenance access
  across restarts and WAL recreation. Added executable migration regressions.
- Documented live upgrade findings and acceptance limits in
  `docs/ALPHA82-UPGRADE-RECOVERY.md`.

- Create `/var/lib/classroom-hub` before starting the sandboxed Host Agent. This prevents systemd `226/NAMESPACE` restart loops on clean or upgraded hosts where the declared `ReadWritePaths` state root does not yet exist.
- Added an installer ordering regression test so every release provisions the protected Host Agent state root before restarting the service.
- Apply current Debian security updates during the Hub image build so newly disclosed base-layer vulnerabilities cannot survive into a promoted runtime image.

## 1.0.0-alpha.81 - 2026-09-12

### Production hardening

- Made Full Recovery Export a single point-in-time appliance transaction. The
  Host Agent now holds the shared mutation lock while the Hub blocks and drains
  HTTP, WebSocket, scheduler, announcement, presentation, Background Music,
  update, MQTT, and retention writers before database selection. One-use tokens,
  bounded leases, queued audit writes, and `finally` cleanup prevent a failed or
  interrupted export from leaving the appliance frozen.
- Stable-copied and revalidated the master key, ADB trust pair, Android signing
  identity, and native Veyon identity before archiving. Clean hosts no longer
  treat the installer's empty Veyon bind placeholder as a configured identity,
  and retired Veyon proxy-container state is excluded from the portable contract.
- Started the Host Agent socket before interrupted-recovery reconciliation so
  Compose health checks cannot deadlock rollback. Preserved explicit trusted
  proxy configuration and bound pulled images to the expected Git revision via
  OCI metadata.
- Rechecked Morning Announcements priority at every display delivery, kept
  non-display automation steps running, retried failed release reconciliation
  before resuming Background Music, and tracked the player that actually owns
  Background Music playback across configuration or manual overrides.
- Encrypted the Morning Announcements URL at rest, scrubbed legacy plaintext,
  and deeply redacted URL credentials from controller/preview/status/audit and
  diagnostic projections while retaining the full URL only for the intended
  physical display. MQTT logs now emit endpoint-only information.
- Protected the Android configuration receiver with the platform DUMP
  permission, verified the installed APK's real signer against the protected
  keystore, installed from a private verified snapshot, repaired legacy signing
  layout migration, bound mDNS recovery to Android ID, and bounded Device Agent
  workers, queues, headers, bodies, and socket timeouts.
- Fixed saved announcement URL loading, fail-closed blank playback, query-safe
  client telemetry, masked Veyon credential entry, the manual direct-media
  policy control, and programmatic names for controller/setup form controls.

### Verification and supply chain

- Added Gradle dependency updates, full-history secret scanning, pull-request
  dependency review, blocking high/critical fixable image scans, verified Gradle
  distribution download integrity, complete tracked-shell syntax validation,
  and exact managed-integration catalog parity checks.
- Moved the esbuild browser bundler into a disposable build stage and removed
  npm/npx from the final Hub and maintenance runtime images so build tooling and
  its advisory surface are not shipped on the appliance.
- Expanded the regression suite to 296 tests covering recovery freeze/thaw,
  identity consistency, secret projections and migration, Android trust and
  resource limits, accessibility, controller behavior, and release policy.

## 1.0.0-alpha.80 - 2026-09-11

### Single-export full recovery

- Added passphrase-encrypted, authenticated `.rgbak` Full Recovery Export and
  clean-install Import Full Recovery orchestration for the active database and
  master key, application assets, Android inventory/ADB trust and signing
  identity, allowlisted managed-service state, and bounded native Veyon identity.
- Defined the recovery envelope as AES-256-GCM with per-export random salt and
  nonce, scrypt `N=32768/r=8/p=1`, authenticated canonical metadata, bounded
  input, and explicit passphrase length rules. Recovery secrets are no longer
  exported as a plaintext portable ZIP.
- Restricted passphrase-bearing browser operations to loopback or HTTPS so the
  temporary direct-HTTP LAN deployment cannot expose a recovery passphrase in
  transit.
- Added host-owned staging, a shared update/recovery mutation lock, complete
  safety snapshots, durable transaction journaling, interrupted-restore
  recovery, atomic per-root replacement, verification, and all-state rollback.
- Snapshotted the application-reported active database, normalized its target
  identity to `/app/data/classroom-control-hub.db`, reconciled the target
  `DATABASE_FILE`, and required successful SQLite integrity/schema checks plus
  decryption of every `secret_store` row before accepting the recovered
  database/master-key pair.
- Restored the named ADB volume as part of the ADB trust identity, preserved
  managed-device assignments without re-pairing, and treated Android signing
  keystore/password as one indivisible identity.
- Recreated only explicitly RoomGoblin-owned services with fixed reviewed image
  identities, preserved their saved running/stopped state, and failed closed on
  adopted/external ownership or same-name collisions.
- Added bounded native Veyon identity recovery without exposing an arbitrary
  host-filesystem restore surface.
- Added corruption, authentication, path/type/mode/ownership, capacity,
  lifecycle, restart, rollback, and interruption regression coverage plus an
  operator disaster-recovery drill.

## 1.0.0-alpha.79 - 2026-09-11

### Production readiness

- Aligned the canonical `wagnerks1990/RoomGoblin` repository and
  `ghcr.io/wagnerks1990/roomgoblin*` image names across installers, the web
  updater, release workflows, and operator documentation.
- Continued publishing the legacy `classroom-control-hub*` GHCR aliases during
  the compatibility transition so existing automation is not abandoned.
- Required every release-publishing path to wait for the complete validation
  matrix before publishing immutable images.
- Restricted the production bootstrap to validated `amd64` hosts; `arm64`
  remains unsupported until its application images and bundled Android/ADB
  toolchain are built and tested end to end.
- Consolidated command-line production updates through `install.sh` so backup,
  permissions, immutable-image selection, recreation, and component-version
  convergence use one audited path.
- Preserved the exact image tag and retained image IDs across failed updates and
  explicit rollback instead of allowing Compose to resolve a moving tag.

### Security, privacy, and recovery

- Made support diagnostic archives metadata-only and excluded databases,
  runtime data, managed-service state, device inventory, ADB identity, student
  records, environment files, and keys.
- Marked recovery backups containing site or student data as sensitive and
  required explicit confirmation before creating them.
- Repaired Morning Announcements release arbitration so each display receives
  only its newest currently applicable automation, failures cannot strand the
  announcement lock, and Background Music resumes only after display
  reconciliation completes.
- Removed school-specific names, addresses, endpoints, and classroom text from
  public examples and regression fixtures.
- Completed current-surface RoomGoblin naming while retaining documented
  compatibility identifiers required by installed appliances and endpoints.
- Added a database-first, single-export recovery acceptance contract with an
  explicit alpha.79 boundary; clean-host full import and Android-inventory
  migration remain future work and are not presented as implemented.

## 1.0.0-alpha.78 - 2026-09-11

- Fixed multiline title and body clipping when a managed TV loaded the current
  display module with a missing or stale companion layout stylesheet.
- Made the single layout engine enforce its containment-critical natural-height,
  non-shrinking child styles and timer geometry directly before measurement.
- Added the captured Schoology club-selection announcement as a browser regression
  fixture and verified it remains contained when the layout stylesheet is withheld.
- Bumped the display renderer/cache revision to `single-fit-20260911-5`.

## 1.0.0-alpha.77 - 2026-09-11

### Changed

- Adopted `org.roomgoblin.display` as the Android/Google TV application ID and
  `RoomGoblin-Display-Agent` as the staged APK identity.
- Updated the canonical source repository and primary GHCR image identities to
  RoomGoblin while retaining legacy deployment identifiers and transitional
  image aliases where upgrades depend on them.
- Renamed the root npm package for RoomGoblin. The maintenance package retained
  its legacy-compatible internal name until the production-readiness follow-up.

### Migration

- The old `org.classroomhub.display` Android app cannot be updated in place.
  Managed installation removes only that old package, installs RoomGoblin,
  preserves the server-side device record and ADB trust, and reapplies saved
  configuration and supported grants.
- Rollback across the package-ID boundary requires uninstalling the current app
  and installing the matching legacy APK; Android cannot cross-update between
  the two identities.

## 1.0.0-alpha.76 - 2026-09-11

- Fixed Morning Announcements live detection by passing protected Managed Display Gateway configuration into the Hub container.
- Report unreachable HLS probes as UNKNOWN instead of incorrectly presenting them as OFFLINE.
- Prevent successful periodic probes from rebuilding an already-playing announcement every 30 seconds.
- Changed production installation to pull the exact validated `sha-<commit>` images published by GitHub Actions instead of compiling on the appliance.
- Changed web-managed semantic releases to pull their matching immutable GHCR tags while preserving exact retained-image rollback.
- Kept local Docker/Gradle compilation behind the explicit `install.sh --build-local` development option.

## 1.0.0-alpha.75 - 2026-09-11

- Changed the project license from PolyForm Noncommercial to the MIT License;
  commercial and noncommercial use no longer requires a separate license.
- Converged package and Host Agent version metadata and repaired release
  validation after the initial RoomGoblin rebrand.
- Prepared production deployment to consume validated CI-built images instead
  of compiling the application and Android toolchain on the appliance.

## 1.0.0-alpha.74 - 2026-09-10

- Stopped the installer and application updater from changing executable bits on tracked scripts inside the production Git checkout.
- Kept executable permissions on the installed `/usr/local/libexec` copies, leaving `git status --short` clean after a supported installation.
- Added a regression test for clean-worktree preservation.

## 1.0.0-alpha.73 - 2026-09-10

- Restored stable URL-only access for enabled configured classroom displays as the default policy.
- Kept individual one-use enrollment and revocable credentials as an explicit administrator opt-in.
- Added a controller policy switch and a full-enrollment safety check before mandatory display authentication can be enabled.
- Kept unknown/disabled display rejection and short-lived signed protection for media and presentation assets in both modes.
- Documented the URL-only default across operator, contributor, wiki, configuration, and AI guidance so later security reviews do not silently make display enrollment mandatory.

## 1.0.0-alpha.72 - 2026-09-10

### Security and correctness review

- Restored one-use, individually revocable display enrollment and removed the production-only credential bypass that accepted any enabled display ID.
- Hardened the Managed Display Gateway to GET/HEAD, standard web ports, credential-free upstream requests, cookie-free responses, configured client allowlists, and sandboxed active content.
- Defaulted direct deployments to zero trusted proxy hops, rejected empty password reset/change requests, repaired disabled/demoted built-in Administrator profiles, and made uncaught exceptions fail for supervisor restart.
- Removed the school-specific gateway hostname/IP from public defaults; deployments now configure mappings explicitly in protected runtime `.env` state.

### Functional fixes

- Repaired manual video/web playback after the volume-control helper called functions that ES modules did not expose globally.
- Repaired managed Android remote shell, agent probes, app audit/minimal-mode actions, and offline-device polling.
- Prevented timer style changes from resending stale clock state to another display selection.
- Fixed application rollback on non-default maintenance ports and propagated custom service roots into the native Host Agent.
- Expanded release gating and version stamping so browser, Android, restrictive-image, controller, and host validations cannot be skipped by a release tag.

### Selective PR #22 Sendspin migration

- Rate-limit the touched Music Assistant status/configuration/attachment routes with independent polling and mutation budgets and HTTP regressions.

- Connect the existing ticketed Hub audio proxy to the configured dedicated Sendspin endpoint (default 8927), leaving token-authenticated Music Assistant API control separate.
- Preserve initial text/binary protocol frames, existing attachment checks and host-network compatibility; validate endpoint settings before saving/opening.
- Fix timeout, early-close and failed-send cleanup; bound pending/output buffers and include audio connections in per-IP accounting.
- Add real-WebSocket and deterministic lifecycle regressions; leave the renderer, SDK, autoplay and host-network deployment definitions unchanged.
- Record the selective PR #22 review and rejected legacy experiments in operational, wiki and AI documentation. No new release tag or database migration.

### Host installer group resolution

- Resolve or create the fixed host GID 10001 before data/key installation and pass its group name to `install`; preserve existing numeric ownership and fail on name conflicts or lookup errors. Add isolated regression tests and operational/wiki/AI recovery guidance.

### Host-network migration

- Rate-limit authenticated maintenance mutations across legacy and wrapped add-on routes, preserving health polling and returning HTTP 429 with Retry-After under write floods.

- Use host networking for both core containers and all reviewed managed add-on deployment templates; remove bridge DNS, host-gateway and port-publishing dependencies.
- Keep maintenance bound to loopback with a configurable port; preserve Hub bind/port settings and verify effective listeners during installation and updates.
- Resolve exact legacy local integration aliases without rewriting remote endpoints or secrets; fix browser links and display network modes/migration warnings in the controller.
- Map custom Mosquitto/Node-RED ports to actual service listeners. Require host mode in Host Agent container creation policy and preserve non-destructive adoption.
- Add regression tests, host-network preflight, real-container networking smoke tests with a fake native-agent fixture, and synchronized operational/wiki/AI documentation.
### PR #27 display correction

- Replace competing inline/observer fitters with one resolution-independent layout engine for title, subtitle, body and timer; grow short content, contain long content and preserve layout across timer ticks/reloads.
- Package same-origin fonts and add Chromium/Firefox geometry, reload, overflow and timer tests.
- Validate receiver media schemes/credentials and nested viewers; isolate external signage frames; restrict Music Assistant sockets to the ticketed same-Hub proxy.
- Bound and replace identification timers, including cancellation on display clear. Add unit and browser security/lifecycle coverage.
- Update display documentation, AI guardrails and the wiki mirror. Renderer revision `single-fit-20260909-2`; application version remains alpha.71 pending a separately tagged release.

## 1.0.0-alpha.71 - 2026-09-08

### Added

- Appliance-wide Docker discovery/lifecycle control for containers already present on the host while keeping new `docker run` operations restricted to reviewed integration images.
- First-class optional managed add-ons for Mosquitto (`eclipse-mosquitto:latest`), Govee2MQTT (`ghcr.io/wez/govee2mqtt:latest`), Music Assistant (`ghcr.io/music-assistant/server:latest`), and Veyon WebAPI (`veyon/webapi-proxy:latest`).
- Adopt-without-recreate, explicit deploy/recreate, and managed removal paths that preserve supported integration data outside container writable layers.
- Startup recovery for built-in access profiles whose capability arrays were lost during migration; Administrator is restored to `capabilities:["*"]` without overwriting valid non-empty custom capability lists.
- Regression coverage for punctuation-heavy passwords, active-database recovery, managed add-on contracts, setup receiver reconciliation, and maintenance startup ordering.
- Build-time release stamping for large controller/display/Windows-agent runtime surfaces and maintenance runtime diagnostics.

### Changed

- Removed the Caddy/TLS gateway from the active appliance architecture and standardized the current live-test deployment on direct HTTP port 3000 for trusted classroom/admin networks.
- Maintenance Compose health now validates the native Host Agent directly instead of calling a readiness path that could wait on the main application and deadlock startup.
- Host Agent startup now extends safe lifecycle/log/inspect control to Docker containers that already exist on the appliance while preserving an allowlist for new integration images.
- Music Assistant is no longer treated as permanently external-only: an existing container can be adopted in place or deliberately promoted to a Hub-managed deployment.
- Setup Wizard receiver IDs are editable, unique, and authoritative instead of being a disabled `tv1..tvN` preview.
- Production installation/update documentation now directs established appliances through `install.sh` so secrets, permissions, Host Agent code, database identity, and migration state are reconciled before container recreation.

### Fixed

- Prevented alpha.70 container recreation from silently switching between `classroom-hub.db` and `classroom-control-hub.db`; installer migration now snapshots every `data/*.db`, preserves the configured active database, validates migrated copies with `PRAGMA quick_check`, and retains old files for rollback.
- Repaired the alpha.70 Administrator profile that could exist/enabled with no capabilities and therefore authenticate successfully while receiving no authorization.
- Confirmed and regression-tested passwords containing shell-significant punctuation such as `!` and `#`; application JSON/scrypt handling treats them as opaque password characters while shell troubleshooting uses safe quoting.
- Fixed Setup Wizard display-count reductions leaving stale display-group members such as a group referencing a removed `tv3` receiver.
- Fixed Setup Wizard offering an adoption action for Music Assistant that called a backend path which rejected external-only integrations.
- Preserved the legacy master-key path during migration, generated missing maintenance secrets before recreation, and established shared data-root ownership compatible with both the non-root application and hardened maintenance container.
- Removed the legacy TLS container/orphan during migration and removed TLS/Caddy from update health gates.

## 1.0.0-alpha.70 - 2026-09-08

### Added

- A privacy-first browser-history opt-in, Windows agent capability/event telemetry, GUI removal of stored GitHub tokens, and capability-aware backup restore actions.
- End-to-end live-test quality gates covering release-version convergence, Windows command parity, strict schedule values, authorization boundaries, database readiness, rollback ordering, and bounded release checks.
- A GitHub Actions Compose smoke deployment that builds the appliance, starts the backend and Caddy gateway, and verifies HTTP and HTTPS health.
- Windows lab-agent screenshots, Chrome/Edge/Firefox history reporting, capability advertisement, bounded command execution, active-session lock/logoff handling, protected atomic configuration, and self-update rollback.
- SQLite integrity/readiness checks, WAL-aware size reporting, scheduler validation, and automatic retained-screenshot reconciliation.

### Changed

- Made initial administrator creation transactional, display enrollment URLs canonical, lab-computer removal revoke all agent access, and authenticated appliance maintenance available from the controller by default.
- Made class and automation changes validate and persist atomically, reject duplicate IDs and unsupported secondary actions, and protect referenced classes from deletion.
- Made school timezone and classroom identity database-backed operational settings instead of decorative GUI values.
- Split liveness/readiness behavior and removed classroom topology from the public health response.
- Bound fresh Compose backend access to loopback so Caddy remains the external HTTPS boundary.
- Preserved Caddy's sole executable file capability under the hardened container profile and included the release VERSION in the runtime image.
- Hardened installation targets, migration snapshots, immutable update runners, resumable update requests, backup checksums, pinned rollback points, and release tag/version preflight.
- Reordered first-run setup so the administrator exists before privileged integration discovery.
- Added capability-aware controller navigation and safer rendering of database and integration values.

### Fixed

- Disabled or missing assigned access profiles now fail closed and invalidate affected browser and WebSocket sessions.
- Rollback restores the matching database and data, with correct UID/GID ownership, before the older application starts.
- Active SVG uploads are rejected, CSV formula cells are neutralized, login throttling is bounded, password verification is asynchronous, and GitHub release checks time out.
- Strict clock and calendar validation now rejects impossible values such as `99:99` and invalid dates.
- Presentation and media conversion preserve the last known-good render on failure and use collision-resistant staging names.
- Removed the incomplete, site-specific legacy classroom-session experience and its missing assets; retired endpoints now return `410 Gone`.
- Removed stale classroom-specific announcement wording and obsolete frontend version labels while preserving the Built by Kyle Wagner attribution.

## 1.0.0-alpha.68 - 2026-09-08

### Added

- Database-backed school schedule profiles with configurable cycle days, day groups, anchors, period mappings, exception times, and continuation rules.
- SHA-256 manifests for Windows lab-agent installation and in-place agent updates.
- Unit coverage for generic schedule normalization, exception transforms, and legacy-profile isolation.
- Automatic GitHub Release creation after both tagged container images publish successfully.
- A one-click Caddy HTTPS gateway with an appliance-owned CA; fresh installs bind the backend’s maintenance port to loopback.

### Changed

- Replaced district-specific schedule editor language and presets with school-configurable controls while importing existing installations through a compatibility profile.
- Expanded teacher and technician access profiles and enforced granular capabilities on schedules, automations, media, diagnostics, lab control, integration checks, and controller WebSockets.
- Restricted web upgrades to the trusted upstream repository and made rollback points single-use so repeated reverts cannot pair source with the wrong backup.
- Reduced maintenance-container write access to application data and known integration data directories; the container is now read-only with all Linux capabilities dropped.
- Restricted native service actions/log access to classified units and replaced permissive Docker-run filtering with an explicit option parser.
- Persisted the display asset signing key and applied privacy retention immediately after startup.

### Fixed

- Protected integration status and scene endpoints that previously exposed operational details without authentication.
- Completed fragmented Windows WebSocket message assembly and prevented overlapping receive operations during heartbeat waits.
- Escaped all five HTML-sensitive characters in controller-rendered values.

## 1.0.0-alpha.67 - 2026-09-08

- Locked both Node dependency graphs and upgraded `adm-zip` and `pdfjs-dist` past their high-severity advisories; CI now uses `npm ci`, production audits, immutable action SHAs, and container SBOM/provenance attestations.
- Closed anonymous classroom topology, event, configuration, and media APIs. Enrolled displays receive renewable signed asset access while controller users continue using authenticated sessions.
- Activated database-backed capability profiles and protected browser history, screenshots, framebuffers, and monitoring alerts behind the `lab.sensitive.read` capability.
- Added GUI-managed student-data retention for browser history, screenshots, alerts, and audit records.
- Added one-time Windows lab-agent enrollment, per-computer credential hashing, rotation/revocation, DPAPI-protected local credential storage, installer/uninstaller scripts, and Authenticode publisher enforcement when configured.
- Removed Docker socket access from the maintenance container. Docker operations now cross the local host-agent socket and a pinned container/image/operation allowlist.
- Retired web-based source, `.env`, arbitrary shell, and source-ZIP mutation surfaces. Runtime configuration remains in structured database-backed forms.
- Corrected custom-port update health checks, verified the expected GitHub origin and `origin/main` ancestry, retained automatic database/source rollback, and documented detached-release recovery.
- Hardened containers with health checks, dependency ordering, no-new-privileges, a non-root read-only main application, and graceful SIGTERM/SIGINT shutdown with a SQLite checkpoint.
- Normalized default configuration keys, installation paths, service-root naming, integration versions, and removed the dead Portainer deployment branch.
- Began incremental modularization with dedicated version and security modules and expanded regression coverage for lab enrollment and capability isolation.

## Unreleased

### Individually enrolled classroom displays
- Replaced the normal shared display-token workflow with one-time, expiring enrollment links and a unique revocable credential for each display browser.
- Added controller coverage reporting, enrollment-link creation/cancellation, credential rotation/revocation, and a guarded switch for disabling legacy shared-token access.
- Stored only SHA-256 hashes of enrollment codes and display credentials in SQLite; raw credentials are returned once to the enrolling display and never exposed by administration APIs.
- Preserved display credentials across name and configuration changes while revoking them automatically when a display is removed.

### Database-backed classroom integration settings
- Added structured controller settings for MQTT/Govee, Pluto AV matrix, and Veyon classroom-computer connections.
- Stored connection settings in SQLite and MQTT/Veyon credential material in the encrypted secret store without returning secret values to browsers.
- Applied connection changes live, including MQTT reconnection and Veyon connection-pool invalidation, while retaining environment variables as bootstrap/migration fallbacks.
- Added validation for integration URL schemes, embedded credentials, Veyon scan ranges, timeouts, retries, and concurrency limits.

### One-command appliance deployment
- Added a clean-machine Ubuntu Server 24.04 bootstrap for `amd64` and `arm64` that installs Docker Engine and Compose from Docker's signed apt repository.
- Added safe temporary source staging, existing-installation refusal, and explicit repository/ref/target overrides.
- Made fresh and in-place installation idempotent, generated distinct setup/control/display/lab/maintenance secrets, and printed the token-bearing first-time setup URL after health and version convergence.
- Added the lab-agent credential to the Compose application environment and CI shell validation for the bootstrap.

### School and classroom identity and theming
- Added a public, secret-free branding contract backed by the SQLite site profile so login, setup, controller, embedded tools, and renderer surfaces share one identity.
- Added GUI settings for school/district name, classroom name, product name, logo, favicon, and theme mode/colors.
- Kept the product focused strictly on classroom and education workflows; removed the experimental organization/site/space and neutral-terminology model.
- Added revision metadata and validation for theme colors and brand asset URLs.

### Verified web updates and rollback
- Replaced the controller's arbitrary source-ZIP update workflow with GitHub release checks using configurable alpha, beta, or stable channels.
- Added database-backed automatic-update policy, maintenance windows, encrypted private-repository token storage, and update history.
- Added a native host application-update job that accepts semantic-version tags, preserves runtime state, rebuilds the Compose services, verifies application/version health, and automatically rolls back failures.
- Added a one-click controller action to restore the prior source commit and its matching pre-upgrade database/configuration backup.

### Documentation / migration hygiene
- Standardized the documented/default production checkout on `/opt/classroom-hub`.
- Corrected Host Agent service/install defaults to use `/opt/classroom-hub` and `/run/classroom-control-hub/host-agent.sock`.
- Added `AGENTS.md`, `docs/AI-CONTEXT.md`, and GitHub Copilot instructions so AI-assisted changes use the current architecture, production layout, release rules, and behavioral invariants.
- Updated the Git-tracked Wiki mirror and documentation indexes.
- Removed the completed `source-archive` migration payload and one-off alpha.65/alpha.66 materialization/release scaffolding now that direct source files are canonical.

## 1.0.0-alpha.66 - 2026-09-03

### Fixed
- Morning Announcements now perform a failsafe scheduler resync when the stream ends instead of restoring a snapshot or guessing one historical event.
- The newest currently applicable display automation is selected independently per display target.
- Class-linked automations are only eligible while their linked class occurrence is currently active.
- Deferred automations are consumed by the resync so they cannot double-fire after release.
- Winning automations are re-run oldest-to-newest so newer overlapping automation remains authoritative.
- Background Music resumes only after display automation reconciliation completes.

## 1.0.0-alpha.65

- Make Ant Media HLS the authoritative Morning Announcements live/offline probe.
- Treat primary HLS HTTP 200 plus a valid playlist as LIVE and HTTP 404 as OFFLINE.
- Stop treating blocked REST/WebRTC probes as stream-state evidence.
- Treat network/proxy failures as UNKNOWN so transient failures do not consume offline confirmations.
- Preserve two confirmed OFFLINE checks before automatic release.
- Report HLS media sequence when available for diagnostics.

## 1.0.0-alpha.64

- Morning Announcements now use a same-origin integrated Ant Media/HLS player on classroom displays.
- Announcement Mute, 50%, 75%, 100%, slider, Retry/Unmute, and Reload/Unmute controls now act on the real HTML5 media element instead of a cross-origin iframe.
- Added HLS.js for Chromium-compatible HLS playback while retaining the configured Ant Media `play.html` URL as the source-of-truth.
- Preserved announcement priority takeover, Background Music pause/resume, and deferred automation behavior.

## 1.0.0-alpha.63

Initial public GitHub/Docker migration of Classroom Control Hub.

- Renamed the project for general classroom/lab use.
- Removed production site-specific hardware mappings and defaults from the public source tree.
- Moved announcement stream configuration to environment/runtime configuration.
- Added public `.gitignore`, `.dockerignore`, and `.env.example` files.
- Added GitHub Actions workflows for validation and GHCR container publishing.
- Preserved the existing modular display, automation, announcement-priority, background-music, AV, lighting, lab, maintenance, and host-agent architecture.\n- Exclude every top-level SQLite database identity (`*.db`, `*.db-wal`, `*.db-shm`) from the streaming filesystem pass and add back only the canonical SQLite-safe snapshot, so stale legacy database files cannot fail or contaminate operational backups.
