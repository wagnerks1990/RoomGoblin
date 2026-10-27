# TV Routing Matrix

Displays & AV uses the TV Routing Matrix and its TV/source drawers. The room
topology editor and its browser target overrides have been removed from both
Displays & AV and Setup at the operator's request.

## Everyday controls

- Click a routing cell to select a source for a TV. The existing hardware
  read-back check distinguishes verified routing from an unconfirmed command.
- Click a TV name to open its name, power, source, groups and display tools.
  An output without a content receiver can still be renamed; this saves its
  matrix label without creating a receiver or enrollment identity.
- Click a source heading to edit its name and browser/kiosk endpoint ID.
- Use Receiver names, mappings & groups under Displays & AV for receiver settings.
  Setup again exposes the receiver count and editable stable receiver IDs.
- Matrix & Diagnostics contains the existing hardware system/network controls.

The Pluto matrix has eight input/output ports regardless of the number of
RoomGoblin receivers. Receiver URLs and credentials are separate from hardware
ports. Display tools still require a configured receiver; AV routing does not.

## Saving and refresh

Receiver configuration is owned by the normal database-backed `devices` and
`displayGroups` configuration. Pluto labels and source endpoint IDs are owned by
the existing AV-label API. No topology editor, API wrapper, target-picker override
or page-wide topology ordering observer participates in normal reads or saves.

A mapped TV name save updates its existing receiver and matrix label. The UI
reports a partial failure if the receiver was saved but the label request failed;
retry the save instead of assuming both completed. Source save errors are also
shown explicitly. A matrix output with no receiver updates only its label.

Matrix polling builds the grid once per changed state, keeps unchanged routing
buttons in place, and no longer rebuilds hidden legacy configuration inventories.
Polling does not replace the open TV/source drawer's unsaved inputs.

## Upgrade and recovery

No database reset or automatic rollback of operator edits is performed. Previously
saved receiver IDs/names, groups, AV mappings, output/input labels, source endpoint
IDs and optional enrollment credentials remain in their existing stores. Android
package identity, management state, ADB keys and native Sendspin are unchanged.

The old `system_preferences` entry named `room.topology` is retained untouched as
historical data for backup/recovery. It is no longer read, written or projected by
the application. Do not use it to restore names or inventory automatically: it
may be stale. Cached topology submissions receive HTTP 409 with a reload message
instead of silently changing current receiver configuration.

After installing the exact validated Hub/maintenance image pair, reload the
controller (Ctrl+Shift+R if the previous editor is still present). No Android APK
reinstallation is needed for this change. Use the normal backed-up updater in
[Production updates](Production-Updates); preserve its image checks and rollback.
A source rollback reactivates the earlier topology behavior and may consult stale
historical data, so use the updater's coordinated source/database backup rollback
and verify names/mappings before routing hardware.

## Verification

### Missing receiver names and long group keys

The matrix always shows eight physical ports; class/content targets list configured
receivers. A label does not create a receiver. Check the stable ID, enabled state
and AV Output in Settings against physical wiring. Never infer identity from a
friendly name or `tvN`. Display tools and group saves require one enabled receiver
mapped to the output; missing/duplicate mappings fail closed. Physical routing,
power and label-only saves remain independent of receiver availability.

The retired topology browser fallback prefixed group IDs with `display-`, and
backend projection persisted those IDs as legacy keys. Repeating that cycle could
accumulate prefixes. The removed code no longer does this, but stored keys remain.
Each full key now wraps separately in the drawer. Do not strip/merge names without
a database-safe backup and reference-aware migration: schedules may use them and
similar names can have different memberships. Archived topology stays untouched.

Automated fixtures cover long keys on mobile/desktop, exact-key saves, disabled or
duplicate mappings, and unmapped ports whose guessed `tvN` exists elsewhere. They
do not establish which receiver belongs to a missing physical TV; that requires
the installation's saved configuration and physical mapping evidence.

Regression coverage includes matrix-only desktop/mobile layouts, unchanged grid
identity across refresh, unsaved drawer edits, mapped and unmapped TV renames,
source endpoint/name saves, visible save failures, and read-back after reload.
Backend coverage verifies stale topology requests fail without modifying receiver
state, archived topology remains untouched, and ordinary display/label saves and
credential preservation continue to work. Existing scheduler, Morning
Announcements, Background Music and Android compatibility suites remain required.
Browser fixtures do not establish physical TV/Pluto acceptance. After upgrade,
verify routing on one output, names after refresh, remote controls and uninterrupted
native audio; report hardware tests separately from automated results.

## Receiver mapping recovery

Open **Displays & AV → Receiver names, mappings & groups** (also linked from
Settings and the TV drawer). The earlier rollback left the editor functions in
place without their visible form. This form lists every stored receiver once,
including independent receivers and multiple receivers sharing an output.

Edit a receiver's name and AV Output, or leave AV Output blank for an independent
display. Stable IDs, optional enrollment credentials, connection metadata,
lighting mappings and unrelated receiver fields remain intact. Save with
**Save Receivers & Groups**. Saving updates target names immediately and does not
send routing, power or display commands. Polling and reopening the disclosure
preserve drafts; **Reload Saved Settings** explicitly discards them.

The matrix now reports missing and shared receiver assignments. It never guesses
`tvN` from output N. Test Image, Clear, Reload and drawer group saves require a
unique mapped receiver. Hardware routing/power remain available for every port.
A shared or unmapped output name changes only its matrix label; individual
receiver names can be edited in the form. No automatic physical reassignment is
performed, because receiver identity and matrix output numbers can differ.

Full group IDs remain visible and wrap in the TV drawer. In the receiver
editor, **Remove Empty Legacy Groups** removes only empty group IDs starting with
two or more `display-` prefixes from the draft. Review the confirmation and save
to apply. Nonempty groups, custom empty groups and `all` remain intact. Existing
schedule references are not rewritten; review schedules before removing any
referenced group. Individual groups can also be removed using their own button.
Names wrap instead of running together. No new group names are synthesized.

Browser regressions cover shared/missing mappings, draft retention, field and
membership preservation, reload persistence, save errors, administrator-only save
controls and absence of command writes from configuration changes. Physical
receiver assignments and routing still require operator verification.

## Independent hallway audio

Set **Audio priority → Independent (hallway)** in the receiver editor for an
out-of-room display. Ordinary playback then leaves classroom Background Music
and manual classroom scheduling alone. Morning Announcements retain priority.
AV ports, group memberships and automation targets are unchanged. See
[Background Music Studio](Background-Music-Studio#independent-hallway-displays).


## Status, command feedback and keyboard use

The operator controller loads matrix controls from `av-workspace.js` and scoped
`av-workspace.css`. Configuration and receiver health refresh independently of
matrix status. A failed read retains the last inventory with an unavailable/stale
message; receiver tools and mapping-dependent saves require available receiver
configuration/status. Repeated Refresh clicks share one active browser read;
the backend independently bounds and shares its hardware scan as described below.

Missing power/signal values remain Unknown. A rejected matrix acknowledgement is
an error and does not update saved power intent. A successful acknowledgement or
last command is still not physical panel confirmation. Polling preserves routing
button identity/focus even when another receiver changes status, and command
feedback remains separate from read health.

TV/source drawers are keyboard modals: focus starts in the name field, Tab stays
inside, and Escape/Close returns to the initiating control. Login/account dialogs
close an open drawer. Power and route changes preserve unsaved names and group
choices. Controls reflect existing server permissions: classroom control for
commands/labels and administrator access for receiver/group configuration.

Setup validates receiver IDs before any save and reports errors beside the form.
IDs use 1–40 letters, numbers, underscores or hyphens; existing casing and group
keys are preserved. Invalid input is not silently renamed. Current backend
identity normalization is unchanged; any future migration requires explicit
compatibility and credential-preservation coverage.


## Backend matrix read bounds

The status endpoint shares one six-query scan across callers and retains its
result for two seconds using a monotonic expiry. The whole scan has an eight-second
budget, including fetch bodies and retry delays. Named diagnostic/read-back
queries outside that scan have the same total budget. The configured per-attempt
timeout and read retry count apply inside this ceiling; writes keep one attempt.
An unconfigured optional matrix fails immediately without network retries.

Partial scans remain HTTP 207 with individual query errors and an `observedAt`
timestamp. Labels are read fresh even when the hardware snapshot is cached.
Command admission/completion and connection changes invalidate the cache and
abort an older scan; a cancelled scan cannot populate the new cache. One browser
disconnecting does not cancel a scan shared with others, but the server budget
still terminates it and lifecycle tracking retains its returned promise.

Matrix responses are limited to 64 KiB by both declared and streamed size. Error
responses are cancelled, and malformed JSON errors do not reproduce raw upstream
text. These are control/status safeguards, not physical power confirmation.
No stored configuration, CEC write retries or announcement lock policy changes.

Matrix requests reject redirects, including same-host redirects, so neither a
read nor a command can be forwarded beyond the explicitly configured endpoint.
Configure the final HTTP(S) matrix URL. Only an enabled full administrator or
the authenticated internal maintenance service can change this destination;
normal classroom commands cannot supply a URL.
