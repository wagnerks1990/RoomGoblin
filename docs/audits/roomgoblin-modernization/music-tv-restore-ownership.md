# TV audio restore ownership

Baseline: `a767b65711d4bcef03e29514630aa9cc884a1e5a`. Three real-function
reproductions sent an obsolete mute mutation after socket close, saved-audio
replacement or Music Assistant connection replacement. The initial review
fixture had a CRLF extraction error; the corrected fixture produced three
assertion failures against actual dispatched commands.

## RG-MUSIC-012: Delayed restore outlived its receiver and saved audio

The restore loop captured desired audio, checked socket readiness only before
volume and then sent mute after an asynchronous volume response. A delayed mute
response could also mark the old restore successful. This is P1.

Recheck the receiver connection, explicit Music Assistant connection generation,
saved volume/mute/revision, shutdown and Full Recovery freeze before mutations,
after each response and before retries. Retired work stops without marking
restoration complete or recording a misleading success/current error.
Current restore, stable player IDs, bounded registration retries, default audio,
ticket transport and tracked writer draining remain unchanged.

## Qualification and remaining review

All 22 new real-function cases and all 75 focused restore/socket/session checks
pass. Coverage includes retirement at both mutation boundaries, current success,
successful retry, bounded failure, retirement during retry wait and replacement
before dispatch. The supported Linux active-worktree suite passes 1,567 tests,
zero failures and two root-only ownership skips, plus all 23 Host Recovery tests
and Node/controller/Python/Bash checks. This change's checked PR, immutable images
and backed-up delivery remain pending.

Uncertain-write retry behavior, reconnect scheduling ownership and named-player
audio persistence are handled by the [recovery follow-up](music-tv-recovery.md).
No production audio command, receiver
reload or fault injection was used. The broader modernization remains active.
