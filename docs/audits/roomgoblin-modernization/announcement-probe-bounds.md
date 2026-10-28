# Announcement playlist deadlines and size bounds

Baseline: `4054c06433e78773b931ef88f5411b7e526ecc26`, the checked-main integration
of the qualified announcement lifecycle patch. Probe transport is unchanged
from main `fe8b68a`.

## RG-ANN-007: Headers ended the deadline before the playlist body arrived

| Field | Assessment |
| --- | --- |
| Subsystem / category | Announcement monitoring / Bounded network reads |
| Priority / confidence | P1 / Reproduced against a local server that stalls after headers |
| Baseline locations | `src/server.js:843-861,878-886` |
| Complexity / compatibility risk | Small / Oversized playlists now report unknown |
| Expected benefit | Release the lifecycle queue after stalled or oversized responses |
| State | Implemented; native qualification passed |

The helper cleared its abort timer as soon as response headers arrived. Reading
the body happened afterward, allowing a stalled publisher to pin the serialized
announcement lifecycle indefinitely. Success bodies were also unbounded, while
redirect and unsuccessful bodies were not explicitly released.

The same 3.5-second request deadline now covers redirects and body consumption.
Successful responses buffer at most 512 KiB, checking both declared and actual
bytes. Redirect and error bodies are cancelled; every exit aborts the upstream
transport. Buffered responses remain readable afterward. Each redirected URL
still passes the existing outbound allowlist. Primary 404 remains authoritative
offline evidence; timeouts and size errors remain unknown and do not release an
active announcement. Primary/adaptive fallback behavior is preserved.

## Evidence and delivery boundary

The 11-case suite passes four controls and fails seven cases on the exact
baseline. It includes a real loopback server with a stalled response body and
bounded fixture streams for size, redirect, cancellation and cleanup behavior.
All 11 pass with the patch; the expanded announcement/music/Sports suite passes
126 checks. No production publisher or classroom device was contacted.

The native active-worktree snapshot passes 1,350 tests, zero failures and two
root-only ownership skips (1,352 total), plus all 23 Host Recovery tests and
Node/controller/Python/Bash checks. Checked integration, required CI, exact
image publication and normal backed-up delivery subsequently completed in PR #297. Release retry ownership and music
editor saves remain separate follow-ups; this does not close the subsystem.

## Combined integration qualification

The probe patch and Music save patch were integrated onto merged main `ac1ae40`.
Their implementation and regression files are byte-identical to their qualified
commits; integration conflicts were limited to additive changelog/audit links.
The combined native snapshot passes 1,365 tests, zero failures and two root-only
ownership skips (1,367 total), plus all 23 Host Recovery tests and
Node/controller/Python/Bash checks. All 40 focused probe/policy/configuration
checks pass. Required CI, exact images and appliance delivery are verified at
`ce31357`; see the [combined delivery receipt](music-save-ownership.md#verified-probemusic-appliance-delivery).
Release retry/clear ownership and deferred-bookkeeping recovery remain open.
