# Today and live-display monitoring review

Baseline: `b3ba0afb2c06f12df7be8ff98c3953cfd00f6957`, alpha.85.
Status: source review and local validation complete; CI, merge and delivery pending.

## Scope and decisions

Fully inspected the Today-specific helpers, rendering, loading and command handlers
in `public/controller/app.js:106-209,230-286`, the Today markup in
`public/controller/index.html:339-390`, and the preview observer in
`public/controller/embedded-workspaces.js:58-94`. Targeted inspection covered
shared API/capability handling, automation status painting, Pluto command feedback,
receiver configuration projections, and status/AV endpoints in `src/server.js`.
Reviewed corresponding controller styles, GUI/matrix/media contracts and existing
browser/manual-media regression coverage. These are precise UI and projection
boundaries, not a complete audit of either large application file.

Retain the existing framework, control IDs, preview renderer and stable receiver
identities. No database, device protocol, physical playback, scheduler policy or
AV routing changes are needed. Density/filter modes remain optional product ideas:
this review found no evidence requiring another preference/editor to solve these
failures. Physical receiver playback and matrix controls are the next review unit.

## RG-TODAY-001: optional probes blocked the dashboard and erased read failures

| Field | Assessment |
| --- | --- |
| Subsystem / category | Today / Reliability and Correctness |
| Priority / confidence | P1 / Confirmed |
| Baseline locations | `public/controller/app.js:241-285`; `src/server.js:5330-5336,5395-5400` |
| Complexity / compatibility risk | Medium / Low; browser read ownership only |
| Expected benefit | Usable initial room status and accurate independent service/error signals |
| State | Identified, reproduced, planned, implemented, locally tested; CI and delivery pending |

The old loader waited for five requests together, including six sequential Pluto
probes. A stalled optional probe blocked display inventory and class information.
The integration endpoint returns 503 if either MQTT or Pluto fails; the generic
API helper discarded that response and Today painted both services offline.
Failed inventory/class reads were replaced with empty success-shaped objects,
showing "No displays configured" or "No active or upcoming class".

The baseline browser run reproduced the blocked initial dashboard and lost
inventory. Load status, inventory and classes independently with ten-second
browser deadlines. Read MQTT from the existing fast authenticated status response;
remove Today's redundant integration-control probe. Run the AV
read separately with a thirty-second browser deadline and one in-flight request.
Coalesce repeated core refreshes. Retain successful inventory/content snapshots,
label failed reads unavailable/last-known and allow explicit retry. Label the MQTT
signal as broker connectivity rather than claiming every Govee device is online.

Verification: held AV requests cannot delay inventory/classes, repeated refreshes
do not duplicate the held probe, AV failure does not change healthy MQTT, initial
failures remain unknown, and a failed inventory refresh preserves known displays.
These fixtures do not measure production network latency or device availability.

## RG-TODAY-002: status refresh destroyed preview sessions and focused controls

| Field | Assessment |
| --- | --- |
| Subsystem / category | Live monitoring / Performance and UI/UX |
| Priority / confidence | P2 / Confirmed |
| Baseline locations | `public/controller/app.js:133-151,156-202` |
| Complexity / compatibility risk | Medium / Medium; DOM identity and preview lifecycle |
| Expected benefit | Stable keyboard focus and no redundant preview document reload on status reads |
| State | Identified, reproduced, planned, implemented, locally tested; CI and delivery pending |

Every refresh replaced the complete card grid, including all live preview iframes
and buttons. The baseline regression confirmed changed iframe identity and lost
focus. The resolution parser also accepted zero and arbitrarily large dimensions.

Reconcile cards by stable receiver ID, mutate their labels/control availability,
and retain unchanged frames. Insert new cards in sorted DOM order without moving
existing iframe documents. Remove only deleted/disabled receivers; reconnect a
preview when its receiver returns online. Keep the explicit Refresh previews action.
Bound reported logical dimensions to 1-16384 pixels with the existing 1920x1080
unknown fallback. Separate receiver connection from TV power in visible labels.

Verification checks node identity, focused control identity, preview request count,
insert/remove ordering, explicit preview refresh, invalid resolution fallback and
390px layout. Screenshot inspection caught and removed the original loading
placeholder after the first keyed render. Existing receiver preview code already
short-circuits video/protected content before loading media; it is unchanged.
Browser tests use lightweight preview documents and do not claim physical video QA.

## RG-TODAY-003: receiver tools lacked mapping guards and visible command errors

| Field | Assessment |
| --- | --- |
| Subsystem / category | Today controls / Correctness and UI/UX |
| Priority / confidence | P2 / Confirmed |
| Baseline locations | `public/controller/app.js:153-155,193-196,556-563` |
| Complexity / compatibility risk | Small / Low; existing commands and target IDs retained |
| Expected benefit | Clear recovery controls and no ambiguous test-image assignment |
| State | Identified, validated, planned, implemented, locally tested; CI and delivery pending |

Missing output mappings silently returned; duplicate mappings could send a
port-numbered test image without the required unique enabled receiver assignment.
Command rejections escaped the click handlers. Power errors appeared only in the
hidden AV workspace. Add valid-port checks, a unique enabled mapping guard for
receiver test images, disabled-control explanations and visible Today notifications.
Unknown inventory blocks test-image dispatch. Physical port power remains usable
for offline receivers and does not require a unique receiver assignment.

Verification covers duplicate mapping rejection without a request, a power request
from an offline receiver, exact output/transport, and visible power/test-image
failure. Power acknowledgments are described as command results, not proof that a
TV is physically on. No real command was sent during this review.

## RG-TODAY-004: automation errors and permissions were absent from Today

| Field | Assessment |
| --- | --- |
| Subsystem / category | Today automation summary / UI/UX and Correctness |
| Priority / confidence | P2 / Confirmed |
| Baseline locations | `public/controller/app.js:1153-1158,2341-2351`; `public/controller/index.html:342` |
| Complexity / compatibility risk | Small / Low; backend guards unchanged |
| Expected benefit | Visible unavailable state and controls consistent with existing authorization |
| State | Identified, validated, planned, implemented, locally tested; CI and delivery pending |

A failed automation read updated only the hidden scheduling workspace, leaving
Today's "Automation..." indicator and Pause button unchanged. Toggle/Resume were
absent from the shared action capability map. The backend already enforces
`automation.manage` for Toggle and `classroom.control` for Resume; this was not an
authorization bypass. Bound the read, show Automation unavailable on failure,
disable the unknown-state toggle and restore it after a successful read. Apply
the same backend capabilities to the existing controls.

Verification covers failed reads, read-only users, classroom controllers and
administrators, including recovery of the enabled toggle after valid status.
Scheduler execution, announcement priority and takeover behavior are unchanged.

## Validation and delivery

The first three baseline tests failed (two assertions, one blocked-load timeout).
All eight focused browser cases pass. Full native Linux passed 1,036 tests with
two root-only skips; Host Recovery passed 23; Chromium and Firefox each passed
123 browser tests. CI/image qualification and normal backed-up deployment are tracked in
[validation.md](validation.md) and the delivery PR. Unverified stages stay open.
