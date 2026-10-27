# Shared frontend and navigation review

Baseline: `40b88c197b2e4d4dbed448348a9d1a9805949dbf`, alpha.85.
Status: scoped source review and local validation complete; CI and delivery pending.

## Source scope

Reviewed the controller navigation shell, shared workspace and brand styles,
brand initialization, controller script composition, page/capability activation,
account/login focus handling, and embedded-frame sizing ownership. Examined the
updater and enrollment implementations while separating their source ownership.
Their backend/deployment and agent protocols remain assigned to later units.
Today preview behavior and individual feature layouts remain in their own units;
this review does not claim every function in the large `app.js` is audited.

Retain the framework-free browser architecture, runtime branding, existing
control IDs, and same-origin embedded tools. Native details/summary already
provides progressive disclosure. Shared operator styling remains opt-in through
`body.rg-workspace`, outside the physical display/document/video layouts.

## Findings and resolution

### RG-UI-001: feature behavior lived in the navigation shell

`workspace.js` claimed presentation-only navigation ownership but also rebuilt
the updater and replaced the global Windows enrollment handler defined in
`app.js`. This contradicted the documented ownership boundary and left two
implementations of the same enrollment action.

Move updater presentation and its styles to `system-updates-workspace.{js,css}`.
Make `lab-enrollment.js` the single enrollment UI implementation and remove the
superseded legacy-only function. Load both explicitly after `app.js`. Keep
enrollment payloads, preferred HTTPS/LAN fallback, one-time download and verified
native/legacy fallback commands unchanged. Preserve updater IDs and existing
request handlers. Keep AV group wrapping in the original workspace stylesheet.

Composition tests enforce one feature owner and explicit script ordering. A real
browser fixture clicks the existing enrollment control, downloads and inspects
its JSON, verifies opaque token/PowerShell quoting and HTTPS/HTTP fallback, then
saves updater settings through the retained controls. It issues no live device
or appliance requests.

### RG-UI-002: drawer and authentication dialogs competed for focus

Opening Account from the mobile drawer left the drawer open and its keyboard
handler active. Account/login dialogs lacked a complete Tab loop; returning focus
to an offscreen drawer control lost visible focus. Session loss also retained
stale navigation authorization metadata until another user signed in.

Close navigation on an explicit modal-open event and on session loss. Account
and login dialogs make the surrounding shell inert and contain keyboard focus.
Account close clears password fields and returns focus to a visible opener or
Menu. Login remains mandatory; Escape does not dismiss it. Concurrent expiry
responses do not steal focus from unfinished login entry. Recompute capability
visibility even when the authenticated user becomes null. Backend authorization
is unchanged and remains authoritative.

The new browser regression failed on the baseline because Menu remained expanded
after opening Account. It now verifies focus wrapping, Escape, field clearing,
visible focus restoration, expired-session navigation and retained login entry.
Existing restricted-role search and iframe-preserving focus-mode tests remain.
Account/login field spacing now leaves room for visible focus outlines.

### RG-UI-003: dark-only colors leaked into light operator surfaces

Rendered default light-mode contrast was 1.13:1 for inline code, 1.59:1 for warning
text, 2.28:1 for the focus outline and 1.05:1 for compact brand text. Global
attribution styling also overrode the operator body background/text when only the
light mode was selected, mixing a dark page with light panels. Existing tests
provided a complete custom light palette and did not expose that default-mode
conflict. Manual screenshot inspection identified the mismatch.

Give the operator body rule precedence over global attribution styling and keep
status notifications on a matching surface. Use operator-scoped code, warning
and focus tokens with light/system-light overrides. Compact lockups inherit operator text. The measured corrected code,
warning and focus colors are respectively 5.47:1, 6.85:1 and 5.02:1 against a
white panel. Browser checks cover dark, light and system-light body colors and
code/warning/brand/status text
at 4.5:1 and focus at 3:1. This is targeted contrast evidence, not a claim of
complete WCAG conformance or arbitrary custom-theme accessibility.

## Validation harness correction

The first full Linux run had one startup-recovery timeout. The isolated case
passed, and its failed duration was shorter than the combined explicit sleep and
wait budget. The helper used wall-clock deadlines; a deterministic forward-clock
correction reproduced premature expiry. Change that test helper to monotonic
`performance.now()` while retaining its ten-second budget and 40ms polling.
The new helper regression fails before the correction and passes afterward.
This does not change application scheduler time or production deadlines. The
specific host clock-adjustment source was not independently established.

## Preserved boundaries and later review

- Capability visibility and page activation remain owned by `app.js`; search
  cannot unhide authorization-hidden navigation.
- Desktop focus mode and mobile navigation do not replace embedded iframe nodes.
- Physical receivers retain their own layout engine and persistent media sessions.
- Enrollment and updater API/security contracts are unchanged. Updater status
  text parsing remains feature-owned and is queued for the updates review.
- Native device behavior, classroom actions and production failure injection
  have not been exercised by these browser fixtures.

Validation and delivery results are recorded in [validation.md](validation.md)
and the associated pull request after completion.
