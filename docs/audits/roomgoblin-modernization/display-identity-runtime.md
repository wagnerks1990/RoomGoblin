# Receiver identity admission and media access

[Finding classification and immutable source locations](finding-metadata.md#display-identity-runtime).

RG-AUTH-IDENTITY-001 is reproduced with real application HTTP and WebSocket
listeners and isolated SQLite identities. Exact uppercase IDs were lowercased
into a different configured receiver, breaking lookup, enrollment and existing
credentials and misdirecting direct commands. Legacy dotted IDs authenticated
but their signed asset token could not be parsed. Nine of eleven initial
integration cases failed; unknown/disabled rejection and cross-credential denial
passed.

Receiver admission now selects the exact configured ID, then only an unambiguous
case-insensitive match. Malformed aliases are rejected without stripping their
characters. HTTP lookup/configuration, enrollment/cancellation, physical and
preview WebSockets and direct command routing retain the selected identity.
Signed media access preserves the exact ID and parses its fixed suffix while
allowing dots inside the legacy receiver ID. Its HMAC, expiry, policy and credential
revocation checks remain in force; forged case changes cannot transfer access.

Save-time normalization now preserves target casing for announcements, automation
steps/overlays and class defaults. Scheduler expansion retains exact receiver and
long group identities, ignores missing group members and rejects ambiguous aliases.
Media/audio controls, AV mapping, physical announcement locks and MQTT observations
use the same receiver resolver. Music Assistant tickets, player observations and
audio state retain exact identities; unambiguous legacy lowercase audio preferences
remain readable without rewriting them or sharing state across case peers.

No stored ID, credential, group reference or schema is migrated. Existing signed
tokens keep their format. Optional trusted-network display access remains the
default, and previews never count as physical command deliveries. The legacy
Music Assistant player prefix and physical TV transport identifiers stay intact.

The initial real-runtime/presentation suite passed 42 cases. The follow-up has
six reproduced scheduler/lock/ticket failures, four HTTP save failures, two
media/audio-control failures, an MQTT observation failure and two player/audio
state failures. An isolated committed-source AV probe also confirmed that an
uppercase receiver selected its lowercase peer's output. All 266 focused
targeting, scheduler, media and music cases pass, plus all 46 expanded real-runtime
and presentation compatibility cases. The final full Linux snapshot passes
2,509 tests, zero failures and two root-only skips (2,511 total), plus all
23 Host Recovery cases, all 55 Android JVM cases and Node/controller/Python/Bash
checks. Checked PR/main gates and exact-image delivery remain pending.

The first full snapshot exposed eight media fixture failures because their VM
omitted the new production resolver. Those fixtures now load the actual helper;
their assertions remain unchanged. No production receiver configuration,
enrollment or physical commands were exercised.

A later full run passed 2,508 cases with one fixture setup failure and two
root-only skips. The lab disconnect failure-injection fixture attempted to
install its SQLite trigger while an application writer held the database.
Both trigger creation and removal now use the application's bounded five-second
busy timeout. All 20 consecutive failure/recovery fixture repetitions pass;
the shutdown assertions and production lock policy are unchanged.

PR review exposed two additional identity paths. The actual receiver browser
lowercased both canonical and legacy query URLs before its WebSocket hello, and
scheduled expansion preferred a group alias over a uniquely resolved receiver.
The browser now retains the configured URL identity. Direct and scheduled
dispatch prefer the same receiver, reject ambiguous receiver aliases before any
group fallback, and resolve group members through the same unique-alias policy.
Punctuation is never stripped to manufacture a group match.

Three baseline target-collision cases and two baseline browser cases failed.
All 79 focused cases now pass, and all 33 receiver cases pass in each of Chromium
and Firefox, including three actual browser hello/enrollment URL regressions.
The [enrollment admission repair](display-enrollment-admission.md) also addresses
the two CodeQL findings with a shared authorized-administrator quota. The combined
development snapshot passes 2,544 Node cases, zero failures and two root-only
skips, all 23 Host Recovery and 55 Android JVM cases, and syntax/controller checks.
That snapshot includes the separately queued diagnostics, retention and
publication batches. Updated exact-head PR gates remain required before merging.
