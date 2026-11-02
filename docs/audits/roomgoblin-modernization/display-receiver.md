# Display receiver browser-runtime review

Baseline: `b3ba0afb2c06f12df7be8ff98c3953cfd00f6957`, alpha.85.
Status: source review, local/CI qualification, merge and appliance delivery complete.
New renderer identifier: `dynamic-fit-20261027-1`.

## Inspection scope

Fully inspected `public/display/index.html`, `layout.mjs`, `layout.css`,
`security.mjs`, `timer-effects.mjs`, `sendspin-entry.js` and `public/shared/common.js`.
Targeted inspection covered existing receiver/audio browser fixtures, layout policy
checks, authenticated media routes and server state application. The shared Scene,
Sports, Music Assistant SDK and backend media persistence remain owned by their
later review units. Native Android/Ubuntu management is queued with managed displays;
the host-side Securly console is independent of this browser runtime. Displays & AV
is the next part of review group 4. No entire-server or physical-TV audit is claimed.

Preserve the fixed 1920x1080 canvas, single fitter, all three containment checks,
whitespace, bounded pathological-fit recovery, timer geometry, priority rules,
optional enrollment, stable IDs and persistent media elements. No framework or
protocol migration is needed. Revision/cache keys and corresponding guidance move
together, including Scene Studio and Weather's shared-fitter imports. Historical
live-TV observations retain their original revision and are not relabeled as new
production acceptance.

## RG-DISPLAY-001: explicit playback was blocked by initial autoplay preference

| Field | Assessment |
| --- | --- |
| Subsystem / category | Receiver video / Correctness |
| Priority / confidence | P2 / Confirmed |
| Baseline locations | `public/display/index.html:158-162,206-216` |
| Complexity / compatibility risk | Small / Low |
| Expected benefit | Play and Restart work for intentionally paused initial content |
| State | Identified, reproduced, planned, implemented, local/CI qualification passed; merged and appliance delivery verified |

The shared start helper returned immediately whenever the original media payload
had `autoplay:false`, including explicit Play and Restart. The baseline browser
fixture observed zero play attempts after Play instead of one. Allow those explicit
controls to override initial autoplay for the requested operation. Keep muted-first
startup, real browser autoplay policy and existing audible-playback fallback.
Verification covers initial autoplay disabled, explicit Play, Pause and Restart on
the same receiver element, plus existing persistent-session/audio regressions.

## RG-DISPLAY-002: a late playback attempt could undo Pause

| Field | Assessment |
| --- | --- |
| Subsystem / category | Receiver media lifecycle / Reliability and Correctness |
| Priority / confidence | P1 / Confirmed |
| Baseline locations | `public/display/index.html:158-184,186-204,206-216` |
| Complexity / compatibility risk | Medium / Medium; asynchronous playback ownership |
| Expected benefit | The latest explicit stop/pause remains authoritative |
| State | Identified, reproduced, planned, implemented, local/CI qualification passed; merged and appliance delivery verified |

The helper checked video identity after awaiting play, but a Pause on the same
video did not change identity. The pending helper could unmute, notice the paused
state and call play again as an autoplay fallback. The baseline test observed two
play calls and resumed state after Pause. Later canplay events could also restart it.

Track the playback operation within the persistent session. Pause/Stop invalidate
older operations and mark the session operator-paused; automatic canplay/loop
recovery respects that state. Explicit Play/Restart starts a new operation. Same
session configuration preserves its owner, while replacement still retires it.
Verification holds a play promise across Pause, then resolves it and triggers late
canplay; no second play occurs. Existing retired-video, volume/mute, website and
Sports audio tests remain passing. Media play is controlled in this fixture; this
is not hardware decoder or acoustic acceptance.

## RG-DISPLAY-003: cleared images retained retry work

| Field | Assessment |
| --- | --- |
| Subsystem / category | Receiver images / Reliability and Performance |
| Priority / confidence | P2 / Confirmed |
| Baseline locations | `public/display/index.html:142-150,245` |
| Complexity / compatibility risk | Small / Low |
| Expected benefit | Replaced content stops generating obsolete image requests |
| State | Identified, reproduced, planned, implemented, local/CI qualification passed; merged and appliance delivery verified |

Image load errors scheduled anonymous timeouts. Clear removed the DOM but did not
cancel those callbacks; the baseline fixture made a second request after Clear.
Own one retry timer, clear it on replacement/clear, detach error callbacks and
remove the old source. Both scheduling and execution require the image to remain
owned by the media root. Keep the three-retry limit and use URL query handling so
cache-busting remains before any fragment. Verification counts actual intercepted
requests before/after Clear and retains the empty media root.

## RG-DISPLAY-004: browser storage errors discarded enrollment credentials

| Field | Assessment |
| --- | --- |
| Subsystem / category | Receiver enrollment / Reliability |
| Priority / confidence | P2 / Confirmed |
| Baseline locations | `public/display/index.html:58,271` |
| Complexity / compatibility risk | Small / Low; server verification unchanged |
| Expected benefit | Explicit enrollment works in the current page when storage is unavailable |
| State | Identified, reproduced, planned, implemented, local/CI qualification passed; merged and appliance delivery verified |

One broad try/catch parsed the enrollment fragment, cleared the URL, then read local
storage. A SecurityError discarded the already-extracted one-use token and returned
an empty authentication object. The baseline handshake had an empty enrollment
field. Separate fragment parsing from best-effort storage reads/writes and retain
supplied credentials in memory. Never log them or weaken server authentication.
Verification makes localStorage unavailable, reloads an enrollment URL, checks the
hello payload and confirms the fragment is removed. An unpersisted credential is
page-local; a future reload can require a fresh enrollment link.

## RG-DISPLAY-005: a literal newline escape broke the body-text CSS selector

| Field | Assessment |
| --- | --- |
| Subsystem / category | Receiver styles / Correctness |
| Priority / confidence | P3 / Confirmed source defect; runtime fitter masked it |
| Baseline location | `public/display/layout.css:16` |
| Complexity / compatibility risk | Small / Low |
| Expected benefit | Packaged defaults match the canonical body whitespace policy |
| State | Identified, validated by source inspection, implemented; local/CI qualification passed; merged and appliance delivery verified |

A literal backslash-n separated the heading rule from `#text`, becoming part of the
selector rather than a line break. The module subsequently reapplied body styles,
so this review does not claim an observed live text-fit failure. Replace it with an
actual newline; retain break-spaces, wrapping and zero padding. Existing real-browser
whitespace, missing-stylesheet and geometry suites qualify the resulting stylesheet.
No new algorithm or containment exception is introduced.

## Cross-subsystem evidence to resolve later

**RG-MEDIA-001 — identified, queued, P2, strong evidence.** Media playback /
Correctness. Baseline `src/server.js:3962-4037,5968-5979` and
`public/display/index.html:242-243`. The media-control route dispatches commands,
but the inspected state switch has no `display.media.control` branch. A reconnect
snapshot may therefore restore old control fields. Signed asset-token renewal also
changes the URL used by same-session identity checks. Reproduce both behaviors with
real backend state and receiver reconnect before deciding the persistence/renewal
fix. Expected benefit: control intent survives reconnect without an unwanted restart.
Complexity/risk: Medium/Medium. Keep token authorization and priority policy intact.
This is not yet a confirmed runtime regression and has not been marked implemented.

## Validation and release boundary

All four initial browser regressions failed on the baseline and passed after the
fixes. The first expanded audio run had eight passes and one environment error:
Node was absent from the direct WSL shell PATH. Sourcing the installed nvm runtime
produced nine passes. The final focused run, including explicit Restart and late
canplay checks, passed seven selected cases. Full Linux and browser discovery,
CI/image publication, Wiki sync and normal backed-up deployment remain required.
No physical display reload, classroom command or production fault injection has
been performed. Existing open receivers are not claimed to have loaded this patch.

The first full Node run reported 1,035 passed, one failed and two skipped: an
existing source-contract assertion still required the old playback helper signature
and session literal. Its expectations now retain the same checks with explicit-play
and persistent-session ownership; all 12 selected policy checks pass. Four browser
revision assertions also retained the old cache key. Their expected revision was
updated without changing geometry assertions. Fresh full runs include merged Today
commit `e7534eced5a8a803f524e46e7667f06bc7ab5deb` and the corrected tests.

Final active-worktree validation passed: 1,036 Node tests, zero failures and two
root-only skips; 23 Host Recovery tests; all Python/Bash/controller checks;
127 Chromium and 127 Firefox browser tests. The browser snapshot includes the
merged Today changes and all receiver logic/tests. Later edits record evidence only.
No Docker runtime is available locally; required CI retains Compose, both image
builds/scans and platform artifacts before merge.


## Verified delivery

PR #274 merged as `ed8135b9bd8fd9f340a6360611a7db2767da08e4`. All PR/main gates,
Wiki sync and exact image publication succeeded. The normal backed-up updater
completed on 2026-10-27 at 05:59:48 UTC. Clean main and the healthy Hub image
match that commit; the healthy maintenance container was retained. Control/media
and Host Agent health, readiness, canonical SQLite, eight secret decryptions,
DB/ADB permissions, authorization and served receiver/layout/editor assets passed.
Backup checksum, ZIP CRC and extracted SQLite checks passed, with rollback to
`e7534eced5a8a803f524e46e7667f06bc7ab5deb` available and no pending request.
PR #274 records the complete receipt. Existing physical receivers were not forced
to reload and their currently loaded browser revision remains unverified.
