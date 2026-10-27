# Displays & AV review

Baseline: `e7534eced5a8a803f524e46e7667f06bc7ab5deb`, alpha.85.
Status: operator-workspace changes implemented and locally qualified; CI and delivery pending.
The backend status-budget follow-up below remains part of this review unit.

## Inspection and ownership

Fully inspected the AV-owned controller functions at baseline
`public/controller/app.js:609-786,2346-2377`, their markup at
`public/controller/index.html:607-624`, AV/receiver styles at lines 162 and 228,
and receiver setup handling at `public/setup/index.html:15-20,37`.
The complete new `av-workspace.js` and `av-workspace.css` own those controls,
polling and receiver drafts. The setup file and stylesheet were read in full;
Cloudflare and optional-service behavior remain assigned to their later units.

Targeted boundary inspection covered `src/server.js:570-579,4433-4537,5394-5419,
6305-6323`, authentication guards, the AV/Today browser fixtures, composition
checks and matrix/TV-power guidance. This is not a whole-server review. Legacy
hidden editor helpers remain available for compatibility; ordinary polling does
not activate them. Archived topology, existing stores, IDs, enrollment, AV ports,
announcement priority and native management are unchanged.

The workspace uses existing classic scripts and shared transport/authorization.
It does not replace APIs, introduce a framework, infer physical mappings or issue
commands from a configuration refresh. The scoped stylesheet is operator-only.

## RG-AV-001: Rejected matrix acknowledgements appeared successful

| Field | Assessment |
| --- | --- |
| Subsystem / category | Matrix commands / Correctness |
| Priority / confidence | P2 / Confirmed |
| Baseline locations | `public/controller/app.js:609-617,668,690` |
| Complexity / compatibility risk | Small / Low |
| Expected benefit | Do not record rejected power intent or tell the operator it succeeded |
| State | Identified, validated, planned, implemented, local qualification passed; CI and delivery pending |

The adapter returns an HTTP-success response containing `ok:false` for an explicit rejection. The UI ignored that field, labeled the response acknowledged and allowed callers to cache a new power value. Both the extracted real helper and browser fixture reproduced this. Reject the result before recording power intent, use the actual acknowledgement field, and surface failures in direct drawer controls. Acknowledgement still does not prove physical panel state.

Verification: Browser fixtures reject row and drawer commands and assert visible errors, no power-cache write and no unhandled error.

## RG-AV-002: Missing power and signal readings became known states

| Field | Assessment |
| --- | --- |
| Subsystem / category | Matrix telemetry / Correctness |
| Priority / confidence | P2 / Confirmed |
| Baseline locations | `public/controller/app.js:644-650,678,689,728` |
| Complexity / compatibility risk | Small / Low |
| Expected benefit | Keep unknown physical state distinct from Off or detected signal |
| State | Identified, validated, planned, implemented, local qualification passed; CI and delivery pending |

Number(null) and Number('') produced zero. Power therefore became known Off, and input signal could become detected without evidence. The baseline real helper and browser case confirmed the power defect. Accept only explicit boolean/0/1 values and their numeric strings; otherwise show unknown. A failed matrix read cannot promote cached power to live verified state.

Verification: Browser cases cover null, empty and unknown readings while existing explicit-value paths retain their meaning.

## RG-AV-003: Polling coupled unrelated failures and duplicated reads

| Field | Assessment |
| --- | --- |
| Subsystem / category | AV polling / Reliability and Performance |
| Priority / confidence | P2 / Confirmed |
| Baseline locations | `public/controller/app.js:628-635` |
| Complexity / compatibility risk | Medium / Medium |
| Expected benefit | Independent availability, bounded browser reads and one refresh at a time |
| State | Identified, validated, planned, implemented, local qualification passed; CI and delivery pending |

A Promise.all made a receiver-config failure label the matrix Offline; a failed device read silently became an empty status map. Manual and timer refreshes could overlap. Baseline cases reproduced the wrong health label and two simultaneous matrix reads. Share one refresh promise, apply each response independently, preserve last-known values with a visible stale-data message and reject malformed responses. Browser budgets are 30 seconds for matrix status and 10 seconds for each receiver read. Failed receiver reads prevent receiver commands or mapping-dependent saves. Background/unauthorized pages do not poll. Backend work after a client timeout is addressed by the queued follow-up, not claimed fixed here.

Verification: Fixtures cover config failure with a healthy matrix, duplicate refreshes, malformed status, retained inventory and absence of receiver command writes after unavailable configuration.

## RG-AV-004: Unrelated matrix changes detached focused controls

| Field | Assessment |
| --- | --- |
| Subsystem / category | Routing matrix / Usability and Accessibility |
| Priority / confidence | P2 / Confirmed by source and post-fix browser coverage |
| Baseline locations | `public/controller/app.js:653-666` |
| Complexity / compatibility risk | Medium / Low |
| Expected benefit | Keep a focused routing control attached when another status changes |
| State | Identified, validated, planned, implemented, local qualification passed; CI and delivery pending |

The old markup cache preserved nodes only while the whole grid was identical. Any changed receiver/power/label rebuilt every matrix control. Reconcile the fixed port positions and existing child nodes, updating attributes/text only where changed; preserve independently managed capability attributes. This does not reorder ports or create a second inventory.

Verification: An actual receiver status change retains the original route button and keyboard focus; existing desktop/mobile and unchanged-poll tests also pass.

## RG-AV-005: Power and routing discarded drawer drafts

| Field | Assessment |
| --- | --- |
| Subsystem / category | TV drawer / Correctness |
| Priority / confidence | P2 / Confirmed |
| Baseline locations | `public/controller/app.js:670,689-707` |
| Complexity / compatibility risk | Small / Low |
| Expected benefit | Keep unsaved names and group choices through unrelated commands |
| State | Identified, validated, planned, implemented, local qualification passed; CI and delivery pending |

Power and route completion called the full drawer renderer, replacing unsaved fields and group checkboxes. The baseline browser case lost a draft name. Render status separately from draft initialization and preserve the draft after power, routing and name-save feedback. Opening a different drawer still loads that target's saved settings.

Verification: Browser case edits the name and a group, sends fixture power and routing, and confirms both drafts survive while the current source changes.

## RG-AV-006: Drawer keyboard focus escaped the overlay

| Field | Assessment |
| --- | --- |
| Subsystem / category | TV/source drawers / Accessibility |
| Priority / confidence | P2 / Confirmed |
| Baseline locations | `public/controller/app.js:674-677; public/controller/index.html:624` |
| Complexity / compatibility risk | Medium / Low |
| Expected benefit | Keyboard access, Escape and focus return match the visible modal |
| State | Identified, validated, planned, implemented, local qualification passed; CI and delivery pending |

The backdrop blocked pointer access but the aside had no modal focus behavior, initial focus or Escape handling. The baseline browser case did not focus the name field. Use native dialogs with existing IDs/handlers, named close controls and scoped drawer styling. Close them before account/login overlays. Native modal behavior confines focus and restores it on close.

Verification: Browser tests cover initial focus, Shift+Tab containment, Escape/return and expired-session handoff. Mobile screenshots retain the source/group controls.

## RG-AV-007: Setup rewrote or accepted unusable receiver ID input

| Field | Assessment |
| --- | --- |
| Subsystem / category | Receiver setup / Correctness and Compatibility |
| Priority / confidence | P2 / Confirmed |
| Baseline locations | `public/setup/index.html:15-20,37` |
| Complexity / compatibility risk | Small / Low |
| Expected benefit | Validate before side effects and preserve entered stable IDs |
| State | Identified, validated, planned, implemented, local qualification passed; CI and delivery pending |

The setup sanitizer lowercased IDs and permitted dots/80 characters even though the display-save route accepts letters, digits, underscores and hyphens up to 40 characters. Save wrote site settings before that later rejection. Validate the receiver list before administrator/site writes, preserve the casing of existing IDs and show validation failures at both blur and Save. Do not silently rewrite identity.

Verification: The baseline reached the display-save rejection after site mutation. The corrected browser flow clicks Save, checks visible feedback and zero writes, and confirms count expansion preserves an existing mixed-case ID. The backend normalization question below remains separate.

## RG-AV-008: Object-property keys could disappear from receiver saves

| Field | Assessment |
| --- | --- |
| Subsystem / category | Receiver/group drafts / Data preservation |
| Priority / confidence | P2 / Confirmed by source and post-fix browser coverage |
| Baseline locations | `public/controller/app.js:2366-2371; public/setup/index.html:37` |
| Complexity / compatibility risk | Small / Low |
| Expected benefit | Preserve every existing receiver and group key during serialization |
| State | Identified, validated, planned, implemented, local qualification passed; CI and delivery pending |

Collectors assigned operator-controlled IDs into plain objects. An own __proto__ key became a prototype setter rather than a serialized entry, potentially dropping that receiver/group on save. Use null-prototype dictionaries for active receiver and setup output maps; do not rename or remove historical keys.

Verification: The browser editor round-trips an existing __proto__ receiver and group without dropping either. Backend identity validation is retained unchanged.

## RG-AV-009: Visible controls did not match their server permissions

| Field | Assessment |
| --- | --- |
| Subsystem / category | AV controls / Authorization UX |
| Priority / confidence | P2 / Confirmed by source and post-fix browser coverage |
| Baseline locations | `public/controller/app.js:2394-2404; src/server.js:3864-3875,5394-5404,6305-6323` |
| Complexity / compatibility risk | Small / Low |
| Expected benefit | Explain unavailable actions before a predictable server rejection |
| State | Identified, validated, planned, implemented, local qualification passed; CI and delivery pending |

Several AV commands were mapped to integrations.control while the endpoint requires classroom.control; group saves require admin. Align the existing action map. A mapped TV name needs administrator access because it also writes receiver configuration; an unmapped output label remains available to a classroom controller. The server remains the authorization boundary.

Verification: Browser cases compare integration-only, classroom-controller and administrator behavior, including label-only renaming and source controls.

## Remaining AV boundary work

**RG-AV-010 — identified, queued; P2; strong source evidence.** Backend matrix
status / Reliability and Performance. Baseline `src/server.js:4480-4523,5395-5401`.
Status performs six serial retrying reads, each with a per-attempt timeout, without
an aggregate budget or shared status owner. Multiple browsers can duplicate that
work, and aborting a browser request does not cancel its backend sequence. Reproduce
with a deterministic slow/stale adapter, then bound/share status work without
retrying writes or changing announcement/CEC policy. Benefit: predictable probe
cost and response time. Complexity/risk: Medium/Medium. This remains part of the
current Displays & AV review, before advancing to the scheduler unit.

**RG-AUTH-IDENTITY-001 — identified, queued; P2; strong source evidence.** Stable
receiver identifiers / Compatibility. Baseline `src/server.js:3833-3838,6312`.
Display-save admission allows uppercase IDs while cleanId lowercases runtime input.
Reproduce with real enrollment/WebSocket identity in the authentication unit before
any migration. Preserve existing IDs, credentials and references; do not claim the
frontend casing-preservation fix resolves the backend mismatch. Complexity/risk:
Medium/High; benefit: one tested identity contract across entry points.

## Verification boundary

Seven initial browser regressions failed on the exact baseline. The corrected
focused suites progressed through 25, 28, 30 and 31 passing AV/Today cases as the
additional ownership, permission and malformed-response checks were added. These
are real DOM/controller tests with deterministic transport, not hardware commands.
The full native Linux snapshot passed 1,036 Node tests (0 failed, 2 root-only
ownership skips), 23 Host Recovery tests and syntax checks. Chromium and Firefox
each passed all 140 browser cases. Those snapshots include merged receiver
baseline `ed8135b9bd8fd9f340a6360611a7db2767da08e4` plus the patch. The final setup
blur-error guard and real Save-click test were then qualified on the current tree
by all 31 AV/Today cases in each browser. CI, publication, Wiki sync and normal
backed-up deployment remain pending. No physical routing, power,
receiver reload or production fault injection has been performed.
