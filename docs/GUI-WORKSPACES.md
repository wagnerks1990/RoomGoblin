# Operator workspaces

## Displays & AV

Use the [TV Routing Matrix](TV-ROUTING-MATRIX.md) and its TV/source drawers. Room topology has
been removed. Existing names, receiver IDs, mappings, labels, groups and credentials
are preserved. Receiver setup uses count/IDs again; Settings manages receivers
and AV mappings. Reload the controller after upgrading.


The GUI redesign organizes RoomGoblin around daily classroom work while keeping
configuration and maintenance available through grouped navigation and expandable
sections. These changes are recorded under **Unreleased**; this document does not
claim a production deployment, release, or live-device acceptance.

## Finding a control

The controller's initial page is labeled **Today**. Existing internal page IDs and
API routes remain unchanged.

| Navigation group | Workspaces |
| --- | --- |
| Room controls | Displays & AV, Lighting, ESPHome devices, Display content, Background music, Weather, Sports, Lab computers |
| Content library | Presentations, Media library |
| Planning | Calendar & Timetables, Classes, Automation |
| Administration | Settings, Diagnostics, Infrastructure & recovery, Managed displays |

Use **Find a workspace** to filter navigation labels. The current workspace opens
its navigation group automatically. On smaller screens, **Menu** opens the
navigation drawer; Escape or the backdrop closes it, and choosing a workspace
moves focus to the main content. The controller also has a skip-to-content link.

Opening My Account or showing the login prompt closes the mobile drawer first.
Account and login dialogs contain keyboard focus and make the surrounding shell
inert. Closing My Account clears its password fields and returns focus to its
visible opener, or to Menu when that opener is inside the closed mobile drawer.
Session loss hides capability-bound navigation immediately. Repeated expired
requests keep an unfinished login field focused rather than restarting entry.
My Account establishes initial focus synchronously when it opens; no delayed
opening callback may move focus after keyboard navigation or a later reopen.

Weather combines current/seven-day forecasts, after-school/evening details,
selectable date ranges and editable overlay fields. Preview is local; explicit
targets are required before sending a full screen. Scheduled screens and shared
overlays use the reviewed Planning editors. See [Weather workspace](WEATHER-WORKSPACE.md).

Navigation search is presentation only. `public/controller/app.js` retains page
activation and capability-based visibility; `workspace.js` must never unhide an
item hidden by authorization. The shared stylesheet explicitly preserves the
`hidden` attribute. Backend authentication and authorization remain authoritative.

## Surface behavior

Managed Displays also contains an independent Ubuntu computer inventory. Its
wizard verifies SSH identity, checks readiness, assigns each physical output,
reviews installation changes and reports asynchronous progress. Computer-level
maintenance is distinct from per-screen controls; failed ADB probes do not disable
Ubuntu management. Computer cards include resource health, software versions,
alerts, history, metadata editing and explicit immediate/scheduled maintenance.
Polling preserves focused controls and open dialogs. Ubuntu refreshes share one
pending read and discard responses predating a write. Pending computer commands
stay disabled across redraws, and their results remain on the originating card.
Metadata/maintenance completion keeps newer unsaved choices open. A preview can
be closed while capturing; late captures cannot reopen it or replace a newer one.
Closing restores focus to its available preview button or the computer search.
Ubuntu screen cards and
wizard controls use the shared light/dark contrast tokens. See [Ubuntu managed displays](UBUNTU-MANAGED-DISPLAYS.md).

| Surface | Organization |
| --- | --- |
| Main controller | Grouped, searchable navigation; consistent cards, controls and spacing; existing workspace IDs and operations retained |
| Display content editor | Target/content workflow, expandable preview and appearance/playback options; existing send and announcement controls retained |
| Windows agent lab | Inventory summary, selection count, common classroom actions; expandable AI usage monitoring and power/maintenance controls |
| Veyon lab | Student/teacher filters, selection count, daily actions; expandable broadcast and maintenance controls; live-view dialog keyboard handling |
| Managed displays | Inventory first; expandable enrollment, device maintenance, agent details and remote shell; open device sections retained during inventory redraws |
| Setup | Responsive form layout and consistent operator styling; existing configuration, receiver identity and save behavior retained |

Expandable sections use native `details` and `summary`, so keyboard users can open
and close them without a custom accordion dependency. Existing destructive-action
confirmations remain in place. Veyon's custom live and information modal containers
receive focus containment, Escape-to-close and return-focus handling through
`public/controller/lab-accessibility.js`; native dialogs retain browser behavior.

Veyon feature and connection-pool dialogs discard replies from an earlier
computer or a closed dialog. Closing cached connections keeps its confirmation
and one pending action; a late completion refreshes inventory without closing
a newer dialog. Escape and return-focus behavior remain available.

## Refined operator workflow

Today puts the school-day and display summaries first, with integration health in
one compact strip. Permission-aware shortcuts open display content, lab computers
and Background Music. Everyday room power controls stay visible; classroom reset
and display reload operations remain in the maintenance disclosure.

Today loads the room inventory and class information independently of optional AV
probes. **Refresh status** retains unchanged preview sessions and keyboard focus;
**Refresh previews** explicitly reloads them. Failed reads show unavailable or
last-known data rather than an empty room. MQTT reports broker connectivity only.
Receiver online/offline status does not establish physical TV power or playback.

Mapped TV power remains available when a receiver is offline. Test Image requires
one enabled receiver uniquely assigned to its AV output and a successful inventory
read. Missing mappings and command errors are visible. Automation read failures
appear on Today; Pause requires automation management and Resume requires classroom
control, matching the existing server guards.

Scheduled Automation uses an inline class-schedule multi-select. Its closed state
shows the number of linked classes; opening it exposes a scrollable checkbox list
with schedule details and explicit Save, Clear All and Cancel actions. Closing the
dropdown without saving restores the previous selection.

On desktop, **Focus workspace** hides the navigation and widens the current tool
without replacing or reloading its iframe. **Show navigation** restores it.
The lab's **Open full workspace** link follows the selected Veyon/Windows console.
The mobile drawer makes background content inert until it closes, and its backdrop
is visible and clickable. New shortcuts obey the existing authorization state.

| Inventory | Find and filter | Density and selection |
| --- | --- | --- |
| Veyon computers | Name, hostname, address or user; student/teacher; online/offline/needs attention | Compact, comfortable or list; select visible online computers; hidden selections remain explicitly counted |
| Windows agent computers | Name, hostname, ID, user or address; online/offline/selected | Compact or comfortable; select visible or visible online; clear selection removes hidden selections too |
| Managed displays | Name, assignment, profile or address; online/offline or unknown | Comfortable or compact; filter remains applied after inventory redraws |

Windows agent inventory refreshes retain keyboard focus, selections, filters and
open device details. Failed reads keep the last available inventory with visible
stale feedback; an initial failed read shows unavailable rather than an empty
lab. Name/group saves run in accepted order and older reads cannot restore
previous metadata. Agent command delivery and monitoring permissions are unchanged.

Windows history and saved-screenshot reads belong to the open computer and latest
filter/refresh request. Closing a monitoring dialog, including Escape, clears
its sensitive content and invalidates late replies. Changing computers clears
the previous image before requesting a new capture. Screenshot feedback checks
command delivery and reports a request, not confirmed capture/save completion;
the latest available image can predate that request. Saved history remains the
record of received screenshots. Permissions and retention are unchanged.
Profile discovery belongs to the computer/dialog independently of filtered row
reads, so early filter changes cannot remove the User choices. Viewing a saved
screenshot explicitly restores image visibility after an unsuccessful live
capture; changing or closing the computer still clears that image.

AI-alert summaries and filtered lists discard older replies. Close/Escape clears
alert content and cancels delayed refreshes; action responses cannot refill a
closed dialog. One alert action may be pending at a time, with visible errors
and no automatic write retry. Current filters refresh after a status change.
Windows screen refreshes issue no capture requests while the document or embedded
workspace is hidden and resume on the normal interval when visible. An already
accepted capture is not cancelled on the workstation.

Inventory filters change presentation only. A selection hidden by a Veyon or
Windows filter still participates in an explicitly issued bulk command; the
selection count warns about those targets. Destructive confirmations and all
existing commands remain available. Expanded device tools survive inventory
refreshes. Managed-display enrollment and trust are unaffected by filtering.

Setup uses a static sequence: room, displays, administrator access, optional
services, and save. It no longer rearranges cards by matching their displayed
headings. Display content uses a compact target rail; classroom-wide session
controls expand separately from normal content editing.

Veyon's implementation is split into `veyon.html`, `veyon.css` and `veyon.js`.
Its preview queue limits concurrency to four visible-screen requests, decodes each
frame before replacing the last valid image, and backs off on errors. List view,
paused previews, a hidden document and an open live view suspend wall polling.
Failures show text and a Retry action, not an unexplained broken-image icon.
Live view has one request at a time, keeps the last good frame with an error label,
and releases object URLs when replaced or closed. A valid frame's update time is
shown; a cached image is not evidence of a currently connected computer.

The canonical supplied 192px mascot and readable product text are the permanent
operator lockup. Corrupt legacy asset paths are retained as valid compatibility
copies. School/room labels and colors remain configurable; product name, text,
logo and favicon are fixed to RoomGoblin. See
[Brand and compatibility](ROOMGOBLIN-REBRAND.md) for the asset contract.

## One scroll area for embedded lab consoles

Veyon and Windows lab frames expand to their content and use the controller page's
scrollbar. Filters can shrink the frame again. The helper preserves frame sessions
and keeps live/info/login dialogs within the visible parent viewport. The Veyon
preview queue uses that same viewport to request only nearby screens; hidden
consoles suspend previews. Standalone lab pages keep normal document scrolling.

## Compact Govee lighting

Lighting keeps group power and brightness first, followed by a searchable device
inventory. Filter by name, alias, model or group, connection state, and group
membership. Filters affect the device inventory only: **All on/off** and group
commands still target their complete groups, with the scope stated above them.

Each compact card exposes On, Off and brightness. **More controls** expands color,
color temperature, scenes and device metadata; **Edit device** expands the saved
friendly name and group assignments. **Discovery & setup** contains automatic
enrollment settings. Unknown presence means no report is available, not online.

Scene lists load only when controls expand, with visible loading/error/empty
states and a retry action. Empty or failed scene lists cannot send a scene command.
Inventory refresh retains existing cards, keyboard focus, open controls and unsaved
edits. Command status reserves a line even when empty, so acknowledgement clearing
does not move an Apply button between pointer down and pointer up. Failed refreshes retain the inventory with an explicit stale-data message.
Existing Govee endpoints, MQTT payloads and schedule/device identity remain unchanged.

Lighting and the scheduler share inventory read ownership, so an older refresh
cannot replace newer readings. Late refreshes and command/save replies preserve
the latest action message. A successful device save followed by a failed refresh
reports both outcomes and retains the last inventory; newer editor drafts remain
intact.

Within one controller, device metadata, automatic enrollment and cleanup writes
run in accepted order. Form values are captured when Save is selected; later
drafts remain editable. Inventory reads wait for accepted configuration writes,
and responses predating a newer write refresh before publishing. Discovery
checkboxes retain the latest pending choice. Setting and cleanup results appear
inline, including successful writes whose follow-up refresh fails. Failed writes
release the queue without an automatic mutation retry. This does not serialize
independent administrators in other browser sessions.

## Styling ownership

`public/shared/workspace.css` is the operator-only design layer. It is opt-in via
`body.rg-workspace`. The main variables are `--rg-bg`, `--rg-surface`, `--rg-text`,
`--rg-muted` and `--rg-line`; existing `--text`, `--muted` and `--border` variables
are mapped for compatibility. Runtime brand primary/background/surface/text tokens
remain inputs. Dark slate surfaces, teal primary controls, explicit status labels,
visible keyboard focus, restrained borders and reduced-motion rules provide the
common visual treatment. Light and system brand modes have operator overrides. `--rg-code`, `--rg-warning`
and `--rg-focus` provide readable semantic text and keyboard outlines in either
mode; compact brand lockups inherit the operator text color. These corrections
are scoped to `body.rg-workspace` and do not restyle playback renderers.

The HTML explicitly loads the enrollment and update presentation modules after
`app.js`. Navigation does not generate credentials or replace feature handlers.
`app.js` retains the API helper, authorization, update requests and account/login
lifecycle. Existing feature IDs and inline actions are preserved.

Page-specific layout lives in:

- `public/controller/workspace.css` and `workspace.js` for navigation and shell layout;
- `public/controller/system-updates-workspace.{css,js}` for update presentation;
- `public/controller/lab-enrollment.js` as the single Windows enrollment UI owner;
- `public/controller/embedded-workspaces.js` for same-origin lab frame sizing and visible viewport reporting;
- `public/controller/display-workspace.css` for the content editor;
- `public/controller/lighting.css` for compact Govee controls;
- `public/controller/lab-workspaces.css` for both lab consoles;
- `public/setup/workspace.css` for setup; and
- `public/managed-displays/styles.css` for managed-device layout.

Keep shared styles scoped to operator pages. Preserve page-specific control IDs,
inline handlers, delegated data attributes, form names and iframe URLs when moving
controls. These are binding contracts, even when the visible labels change.

At phone widths, multi-column content becomes a single column, toolbars wrap and
forms stay within the viewport. Wide diagnostic/history tables retain local
scrolling. Do not shrink text or whole workspaces with transforms to force them
onto a phone screen.

## Playback and compatibility boundaries

The physical display renderer is not part of the operator layout system.
`public/display/layout.css` remains the single display-layout authority; this
redesign does not replace it or add a second fit/scale engine. Document and Ant
Media playback surfaces retain their canvas/video geometry. The retired Schoology
page remains informational and must not regain unauthenticated classroom controls.

Preserve Morning Announcements priority, scheduler reconciliation after priority
content, Background Music recovery, timer continuation, stable display IDs,
optional enrollment, Android/ADB trust and legacy deployment/storage identifiers.
Changing visual grouping does not authorize changing any of these behaviors.
Kyle Wagner attribution remains present through the existing shared attribution.

## Verification and review

Before merging changes to these workspaces, run `node tools/validate-controller.js`
and the relevant repository tests. Inspect phone and desktop layouts, navigation
search with restricted access profiles, keyboard traversal, modal Escape behavior,
selection counts, disclosure state across polling, and live preview/control
bindings. Physical displays, Veyon sessions and Android actions require live-device
acceptance to validate hardware behavior. Static or simulated browser checks do
not establish those results; record actual checks in the PR or release notes.

## Image publication and install recovery

The browser workflow remains named `Display browser regression` even though it
also checks operator workspaces. Both image publishers require that exact name.
The initial GUI merge (`5dc717c`, PR #72) accidentally renamed it and cannot
complete the original publication gate. The follow-up restores the stable name
and adds a regression comparing publisher requirements to real workflow names.

If the installer reports `sha-5dc717...: not found`, stop its image-wait retry loop
with Ctrl+C. This check occurs before installer service/data mutations. Wait for
**Publish Main Images** for the corrected commit to finish, then use the
[published-source updater](PRODUCTION-UPDATES.md). Do not relabel older images with the missing
commit tag or bypass revision verification. The source and both images must agree.

## ESPHome device workspace

The native device workspace is described in [ESPHome integration](ESPHOME-INTEGRATION.md).
Keep forms and expanded entity cards stable across polling, mark cached inventory
stale after failed reads, and never infer physical confirmation from socket writes.

One controller admits one ESPHome enrollment/management write at a time. Polls
pause during those writes and discard replies from earlier management or
permission revisions. Discovery has the same revision checks. A late reply
cannot repopulate inventory after read access is removed. Management feedback
survives ordinary polling; current read failures separately mark retained
inventory stale and disable controls.

Successful enrollment clears only the submitted draft. Newer field edits remain
and retain the saved device identity for the next verified edit. Submitted API
keys are cleared from the field and transient payload; a separately typed new
key remains a new draft until submitted or explicitly cleared by existing
cancel, navigation, disclosure and permission behavior. No device mutation is
automatically retried.

## Planning rebuild (Unreleased)

Calendar & Timetables joins Classes and Automations through shared, permission-aware
Planning tabs. The new page retains `classes` and `schedules` nodes and handlers.
Class fallback times move into a disclosure; automation editing uses When, Actions
& targets, and Timer overlay sections. Calendar changes remain drafts until preview
and a revision-checked save. See [Planning](PLANNING.md) for the cycle model, split segments,
CSV calendar import, migration and rollback.

Planning now uses compact timetable rows, a searchable class library and focused
automation/scene dialogs. See [Planning and Scene Studio](PLANNING-STUDIO.md).
Shared workspace styles remain scoped to `body.rg-workspace`; receiver scenes
load only their shared scene renderer and existing display layout engine.

## Timer overlays

Timer & advanced includes optional staged timer effects, copied reusable presets
and a silent receiver-renderer preview. Stages retain the original deadline and
do not restart content. See [Staged timer overlays](TIMER-EFFECTS.md).

## Background Music Studio

Background Music uses Now playing, Find music, Favorites, Schedule and Outputs & connection tabs. Listening controls and queue stay separate from saved schedule edits. Polling preserves drafts and focused controls. See [Music Studio and recovery](BACKGROUND-MUSIC-STUDIO.md) for recovery, priority and physical acceptance limits.

Sports combines saved team boards, reviewed PDF/CSV rosters, previous/next events,
approved cached media and administrator-managed sources. See [Sports boards](SPORTS.md).
