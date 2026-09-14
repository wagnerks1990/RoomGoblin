# Operator workspaces

The GUI redesign organizes RoomGoblin around daily classroom work while keeping
configuration and maintenance available through grouped navigation and expandable
sections. These changes are recorded under **Unreleased**; this document does not
claim a production deployment, release, or live-device acceptance.

## Finding a control

The controller's initial page is labeled **Today**. Existing internal page IDs and
API routes remain unchanged.

| Navigation group | Workspaces |
| --- | --- |
| Room controls | Displays & AV, Lighting, Display content, Background music, Lab computers |
| Content library | Presentations, Media library |
| Planning | Classes, Automation |
| Administration | Settings, Diagnostics, Infrastructure & recovery, Managed displays |

Use **Find a workspace** to filter navigation labels. The current workspace opens
its navigation group automatically. On smaller screens, **Menu** opens the
navigation drawer; Escape or the backdrop closes it, and choosing a workspace
moves focus to the main content. The controller also has a skip-to-content link.

Navigation search is presentation only. `public/controller/app.js` retains page
activation and capability-based visibility; `workspace.js` must never unhide an
item hidden by authorization. The shared stylesheet explicitly preserves the
`hidden` attribute. Backend authentication and authorization remain authoritative.

## Surface behavior

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

## Refined operator workflow

Today puts the school-day and display summaries first, with integration health in
one compact strip. Permission-aware shortcuts open display content, lab computers
and Background Music. Everyday room power controls stay visible; classroom reset
and display reload operations remain in the maintenance disclosure.

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
edits. Failed refreshes retain the inventory with an explicit stale-data message.
Existing Govee endpoints, MQTT payloads and schedule/device identity remain unchanged.

## Styling ownership

`public/shared/workspace.css` is the operator-only design layer. It is opt-in via
`body.rg-workspace`. The main variables are `--rg-bg`, `--rg-surface`, `--rg-text`,
`--rg-muted` and `--rg-line`; existing `--text`, `--muted` and `--border` variables
are mapped for compatibility. Runtime brand primary/background/surface/text tokens
remain inputs. Dark slate surfaces, teal primary controls, explicit status labels,
visible keyboard focus, restrained borders and reduced-motion rules provide the
common visual treatment. Light and system brand modes have operator overrides.

Page-specific layout lives in:

- `public/controller/workspace.css` and `workspace.js` for the main shell;
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
**Publish Main Images** for the corrected main commit to finish, then pull main
and rerun `sudo bash install.sh`. Do not relabel older images with the missing
commit tag or bypass revision verification. The source and both images must agree.
